import { Logger } from '@nestjs/common';
import { MQTT_TOPICS, type WearableCommand } from '@vitalia/contracts';
import type { Repository } from 'typeorm';
import type { TelemetryReadingEntity } from '../iomt/entities/telemetry-reading.entity';
import type { WearableEntity } from '../iomt/entities/wearable.entity';
import type { MqttService } from '../mqtt/mqtt.service';
import type { TicketEntity } from '../tickets/entities/ticket.entity';
import { commandFor, WearablesService } from './wearables.service';

const ID = '0f0e0d0c-0000-4000-8000-000000000002';
const CODE = 'wb-02-5e0002';
const TICKET_ID = '0f0e0d0c-0000-4000-8000-0000000000aa';
const TOPIC = MQTT_TOPICS.wearableCommand('sala1', CODE);

type TicketState = Pick<TicketEntity, 'code' | 'status' | 'consultingRoom'> | null;

const assigned = (code = 'A-024'): TicketState => ({ code, status: 'WAITING', consultingRoom: null });
const called = (code = 'A-024'): TicketState =>
  ({ code, status: 'CALLED', consultingRoom: { name: 'Consultorio 4' } }) as TicketState;

/** Base simulada: `state` es lo que hay guardado cuando la sincronización lee. */
function setup() {
  const db = { state: null as TicketState, fail: false, slowRead: false };
  const published: WearableCommand[] = [];
  const pending: (() => void)[] = [];
  const deps = {
    wearables: {
      findOne: jest.fn(async () => {
        if (db.fail) throw new Error('base caída');
        const ticket = db.state;
        if (db.slowRead) {
          db.slowRead = false; // esta lectura tarda: lo que leyó ya no es lo último
          for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
        }
        return { id: ID, code: CODE, lastRoom: 'sala1', ticket };
      }),
      findOneBy: jest.fn(async ({ ticketId }: { ticketId: string }) =>
        ticketId === TICKET_ID && db.state ? { id: ID } : null,
      ),
    },
    mqtt: {
      isEnabled: () => true,
      // Cada publicación queda en espera hasta que el test la libera (`flush`).
      publishJson: jest.fn(
        (topic: string, command: WearableCommand) =>
          new Promise<boolean>((resolve) => {
            expect(topic).toBe(TOPIC);
            pending.push(() => {
              published.push(command);
              resolve(true);
            });
          }),
      ),
    },
  };
  const service = new WearablesService(
    deps.wearables as unknown as Repository<WearableEntity>,
    {} as Repository<TelemetryReadingEntity>,
    {} as Repository<TicketEntity>,
    deps.mqtt as unknown as MqttService,
  );
  /** Libera las publicaciones en espera, una por vez, hasta que no quede ninguna. */
  const flush = async () => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setImmediate(r));
      pending.shift()?.();
    }
  };
  return { service, db, published, flush, deps };
}

describe('commandFor', () => {
  it('libre, llamada o asignada según el turno', () => {
    expect(commandFor(null)).toEqual({ type: 'RELEASE_WEARABLE' });
    expect(commandFor(called())).toEqual({
      type: 'SHOW_TICKET',
      ticketCode: 'A-024',
      consultingRoom: 'Consultorio 4',
    });
    expect(commandFor(assigned())).toEqual({ type: 'ASSIGN_TICKET', ticketCode: 'A-024' });
  });

  it('asignada después del llamado de ese turno es CLEAR; de otro turno, ASSIGN', () => {
    const show = commandFor(called('A-024'));
    expect(commandFor(assigned('A-024'), show)).toEqual({ type: 'CLEAR_TICKET', ticketCode: 'A-024' });
    expect(commandFor(assigned('B-003'), show)).toEqual({ type: 'ASSIGN_TICKET', ticketCode: 'B-003' });
  });
});

describe('WearablesService.syncState', () => {
  it('publica en orden: un llamado lento no llega después de liberar la pulsera', async () => {
    const { service, db, published, flush } = setup();
    // El llamado lee la base, pero la consulta tarda; mientras, el turno se finaliza.
    db.state = called();
    db.slowRead = true;
    const show = service.syncState(ID);
    await new Promise((r) => setImmediate(r));
    db.state = null;
    const release = service.syncState(ID);
    await flush();
    await Promise.all([show, release]);
    // Sin la cola, RELEASE saldría primero y el SHOW viejo quedaría último en el OLED.
    expect(published).toEqual([
      { type: 'SHOW_TICKET', ticketCode: 'A-024', consultingRoom: 'Consultorio 4' },
      { type: 'RELEASE_WEARABLE' },
    ]);
  });

  it('cada sincronización lee el estado al publicar, no al pedirla', async () => {
    const { service, db, published, flush } = setup();
    db.state = called();
    const first = service.syncState(ID);
    db.state = assigned();
    const second = service.syncState(ID);
    db.state = null;
    await flush();
    await Promise.all([first, second]);
    expect(published).toEqual([{ type: 'RELEASE_WEARABLE' }, { type: 'RELEASE_WEARABLE' }]);
  });

  it('después del llamado, pasar a atención manda CLEAR_TICKET', async () => {
    const { service, db, published, flush } = setup();
    db.state = called();
    const show = service.syncState(ID);
    await flush();
    await show;
    db.state = assigned();
    const clear = service.syncState(ID);
    await flush();
    await clear;
    expect(published[published.length - 1]).toEqual({ type: 'CLEAR_TICKET', ticketCode: 'A-024' });
  });

  it('no lanza si la base falla, y la cola sigue funcionando', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service, db, published, flush } = setup();
    db.fail = true;
    await expect(service.syncState(ID)).resolves.toBe(false);
    db.fail = false;
    db.state = assigned();
    const next = service.syncState(ID);
    await flush();
    await expect(next).resolves.toBe(true);
    expect(published).toEqual([{ type: 'ASSIGN_TICKET', ticketCode: 'A-024' }]);
  });
});

describe('WearablesService.syncByTicket', () => {
  it('sin pulsera en el turno no publica', async () => {
    const { service, deps } = setup();
    await expect(service.syncByTicket(TICKET_ID)).resolves.toBe(false);
    expect(deps.mqtt.publishJson).not.toHaveBeenCalled();
  });

  it('con pulsera, sincroniza su estado', async () => {
    const { service, db, published, flush } = setup();
    db.state = called();
    const sync = service.syncByTicket(TICKET_ID);
    await flush();
    await expect(sync).resolves.toBe(true);
    expect(published).toEqual([
      { type: 'SHOW_TICKET', ticketCode: 'A-024', consultingRoom: 'Consultorio 4' },
    ]);
  });
});
