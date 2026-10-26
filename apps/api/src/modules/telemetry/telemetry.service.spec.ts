import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { MQTT_TOPICS, type TelemetryReading } from '@vitalia/contracts';
import { randomBytes } from 'node:crypto';
import type { Repository } from 'typeorm';
import type { Env } from '../../config/env.schema';
import { sealReading } from '../../testing/telemetry';
import type { AlertsService } from '../alerts/alerts.service';
import type { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import type { MqttService } from '../mqtt/mqtt.service';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import type { TicketsService } from '../tickets/tickets.service';
import type { IngestWearable, WearablesService } from '../wearables/wearables.service';
import { TelemetryService } from './telemetry.service';

const KEY = randomBytes(32);
const CODE = 'wb-02-5e0002';
const TOPIC = MQTT_TOPICS.wearableData('sala1', CODE);
const WEARABLE: IngestWearable = {
  id: '0f0e0d0c-0000-4000-8000-000000000002',
  code: CODE,
  ticketId: '1a1a1a1a-0000-4000-8000-000000000001',
  ticketCode: 'A-003',
  patientId: '2b2b2b2b-0000-4000-8000-000000000001',
};

let seq = 1000;
const reading = (patch: Partial<TelemetryReading> = {}): TelemetryReading => ({
  wearableId: CODE,
  seq: seq++,
  ts: Date.now(),
  hr: 78,
  spo2: 98,
  temp: 36.6,
  accPeakG: 1.02,
  fall: false,
  ...patch,
});

function setup(keyHex: string | null = KEY.toString('hex')) {
  interface Qb {
    insert(): Qb;
    into(): Qb;
    values: jest.Mock<Qb>;
    orIgnore(): Qb;
    execute: jest.Mock;
  }
  const qb: Qb = {
    insert: () => qb,
    into: () => qb,
    values: jest.fn(() => qb),
    orIgnore: () => qb,
    execute: jest.fn().mockResolvedValue({}),
  };
  const deps = {
    config: { get: (k: string) => ({ TELEMETRY_AES_KEY: keyHex ?? undefined })[k] },
    mqtt: { isEnabled: () => true, subscribe: jest.fn() },
    realtime: { emitTelemetryReading: jest.fn() },
    wearables: {
      findForIngest: jest.fn(async (code: string) => (code === CODE ? WEARABLE : null)),
      touch: jest.fn().mockResolvedValue(undefined),
    },
    alerts: { raise: jest.fn().mockResolvedValue(undefined) },
    tickets: { escalateTriage: jest.fn().mockResolvedValue(true) },
    readings: { createQueryBuilder: () => qb },
  };
  const service = new TelemetryService(
    deps.config as unknown as ConfigService<Env, true>,
    deps.mqtt as unknown as MqttService,
    deps.realtime as unknown as RealtimeGateway,
    deps.wearables as unknown as WearablesService,
    deps.alerts as unknown as AlertsService,
    deps.tickets as unknown as TicketsService,
    deps.readings as unknown as Repository<TelemetryReadingEntity>,
  );
  service.onModuleInit();
  return { service, ...deps, values: qb.values };
}

describe('TelemetryService.ingest', () => {
  it('se suscribe a todas las lecturas solo si hay clave', () => {
    expect(setup().mqtt.subscribe).toHaveBeenCalledWith(MQTT_TOPICS.allWearableData, expect.any(Function));
    expect(setup(null).mqtt.subscribe).not.toHaveBeenCalled();
  });

  it('acepta una lectura estable: emite a staff, persiste y actualiza la pulsera', async () => {
    const { service, realtime, alerts, values, wearables, tickets } = setup();
    const r = reading();
    await expect(service.ingest(TOPIC, sealReading(r, KEY))).resolves.toEqual({
      status: 'accepted',
      level: 'STABLE',
      alerts: 0,
    });
    expect(realtime.emitTelemetryReading).toHaveBeenCalledWith(
      expect.objectContaining({
        wearableId: CODE,
        ticketCode: 'A-003',
        reading: r,
        assessment: { level: 'STABLE', reasons: [] },
      }),
    );
    expect(alerts.raise).toHaveBeenCalledWith(expect.anything(), [], new Date(r.ts));
    await service.idle();
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ wearableId: WEARABLE.id, seq: r.seq, temperature: '36.6', accPeakG: '1.02' }),
    );
    expect(wearables.touch).toHaveBeenCalledWith(WEARABLE.id, expect.any(Date), 'sala1');
    expect(tickets.escalateTriage).not.toHaveBeenCalled();
  });

  it('una caída abre la alerta y escala el triaje del turno', async () => {
    const { service, alerts, tickets } = setup();
    const outcome = await service.ingest(TOPIC, sealReading(reading({ fall: true, accPeakG: 3.4 }), KEY));
    expect(outcome).toEqual({ status: 'accepted', level: 'CRITICAL', alerts: 1 });
    expect(alerts.raise).toHaveBeenCalledWith(
      expect.objectContaining({ wearableId: WEARABLE.id, wearableCode: CODE, ticketCode: 'A-003' }),
      [{ level: 'CRITICAL', kind: 'FALL', reason: 'Caída detectada' }],
      expect.any(Date),
    );
    await service.idle();
    expect(tickets.escalateTriage).toHaveBeenCalledWith(WEARABLE.ticketId, 'CRITICAL');
  });

  it('emite antes de persistir (la base nunca demora la alerta)', async () => {
    const { service, realtime, alerts, values } = setup();
    const order: string[] = [];
    realtime.emitTelemetryReading.mockImplementation(() => order.push('ws'));
    alerts.raise.mockImplementation(async () => void order.push('alert'));
    const qb = values.getMockImplementation()?.();
    values.mockImplementation(() => {
      order.push('db');
      return qb as never;
    });
    await service.ingest(TOPIC, sealReading(reading({ spo2: 85 }), KEY));
    await service.idle();
    expect(order).toEqual(['ws', 'alert', 'db']);
  });

  it('descarta los reenvíos de QoS 1 por seq', async () => {
    const { service, realtime } = setup();
    const payload = sealReading(reading(), KEY);
    await service.ingest(TOPIC, payload);
    await expect(service.ingest(TOPIC, payload)).resolves.toEqual({ status: 'duplicate' });
    expect(realtime.emitTelemetryReading).toHaveBeenCalledTimes(1);
  });

  it('descarta un sobre válido reinyectado en el tópico de otra pulsera (spoof)', async () => {
    const { service, realtime } = setup();
    const other = MQTT_TOPICS.wearableData('sala1', 'wb-03-5e0003');
    const outcome = await service.ingest(other, sealReading(reading(), KEY));
    expect(outcome).toEqual({ status: 'rejected', reason: `wearableId ${CODE} ≠ tópico wb-03-5e0003` });
    expect(realtime.emitTelemetryReading).not.toHaveBeenCalled();
  });

  it('descarta mensajes alterados, con otra clave o de pulseras que no están dadas de alta', async () => {
    const { service, realtime } = setup();
    const tampered = JSON.parse(sealReading(reading(), KEY).toString());
    tampered.tag = Buffer.alloc(16).toString('base64');
    expect(await service.ingest(TOPIC, Buffer.from(JSON.stringify(tampered)))).toMatchObject({
      status: 'rejected',
    });
    expect(await service.ingest(TOPIC, sealReading(reading(), randomBytes(32)))).toMatchObject({
      status: 'rejected',
    });
    const ghost = 'wb-50-5e0050';
    expect(
      await service.ingest(
        MQTT_TOPICS.wearableData('sala1', ghost),
        sealReading(reading({ wearableId: ghost }), KEY),
      ),
    ).toEqual({ status: 'unknown-wearable', wearableId: ghost });
    expect(realtime.emitTelemetryReading).not.toHaveBeenCalled();
  });

  it('un campo fuera de rango se descarta solo: la caída de esa lectura llega igual', async () => {
    const { service, realtime, alerts } = setup();
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const r = reading({ hr: 999, fall: true, accPeakG: 3.4 });
    const outcome = await service.ingest(TOPIC, sealReading(r, KEY));
    expect(outcome).toEqual({ status: 'accepted', level: 'CRITICAL', alerts: 1 });
    const { hr: _dropped, ...withoutHr } = r;
    expect(realtime.emitTelemetryReading).toHaveBeenCalledWith(
      expect.objectContaining({ reading: withoutHr }),
    );
    expect(alerts.raise).toHaveBeenCalledWith(
      expect.anything(),
      [{ level: 'CRITICAL', kind: 'FALL', reason: 'Caída detectada' }],
      expect.any(Date),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('hr fuera de rango'));
    warn.mockRestore();
  });

  it('un tipo equivocado sigue descartando el mensaje entero', async () => {
    const { service } = setup();
    const bad = { ...reading(), hr: '78' } as unknown as TelemetryReading;
    const outcome = await service.ingest(TOPIC, sealReading(bad, KEY));
    expect(outcome).toMatchObject({ status: 'rejected', reason: expect.stringContaining('hr') });
  });

  it('un error al persistir no rompe la ingesta', async () => {
    const { service, wearables, realtime } = setup();
    wearables.touch.mockRejectedValueOnce(new Error('db caída'));
    await expect(service.ingest(TOPIC, sealReading(reading(), KEY))).resolves.toMatchObject({
      status: 'accepted',
    });
    await service.idle();
    expect(realtime.emitTelemetryReading).toHaveBeenCalled();
  });
});
