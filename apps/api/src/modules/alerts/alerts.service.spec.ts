import type { VitalsFinding } from '@vitalia/contracts';
import type { Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth/auth-user';
import type { AlertEntity } from '../iomt/entities/alert.entity';
import type { RealtimeGateway } from '../realtime/realtime.gateway';
import type { SyncService } from '../sync/sync.service';
import { AlertsService, type AlertSource } from './alerts.service';

const SOURCE: AlertSource = {
  wearableId: 'w-uuid',
  wearableCode: 'wb-02-5e0002',
  ticketId: 't-uuid',
  ticketCode: 'A-003',
  patientId: 'p-uuid',
};
const FALL: VitalsFinding = { level: 'CRITICAL', kind: 'FALL', reason: 'Caída detectada' };
const HYPOXIA: VitalsFinding = { level: 'CRITICAL', kind: 'HYPOXIA', reason: 'Hipoxia (SpO₂ 85%)' };
const NURSE: AuthUser = { id: 'n-uuid', email: 'enf@vitalia.local', fullName: 'Paula R.', role: 'NURSE' };

async function setup(activeRows: Partial<AlertEntity>[] = []) {
  const repo = {
    find: jest.fn().mockResolvedValue(activeRows),
    create: jest.fn((x: Partial<AlertEntity>) => x),
    insert: jest.fn().mockResolvedValue({}),
    findOneBy: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOneOrFail: jest.fn(),
  };
  const realtime = { emitAlertEmergency: jest.fn(), emitAlertAcknowledged: jest.fn() };
  const sync = { enqueue: jest.fn() };
  const service = new AlertsService(
    repo as unknown as Repository<AlertEntity>,
    realtime as unknown as RealtimeGateway,
    sync as unknown as SyncService,
  );
  await service.onModuleInit();
  return { service, repo, realtime, sync };
}

describe('AlertsService.raise', () => {
  it('una vez guardada, la manda al outbox de la nube sin datos del paciente', async () => {
    const { service, sync } = await setup();
    await service.raise(SOURCE, [FALL], new Date());
    expect(sync.enqueue).toHaveBeenCalledWith(
      'alert.upsert',
      expect.any(String),
      expect.objectContaining({ kind: 'FALL', wearableId: 'wb-02-5e0002', patientDisplayName: null }),
    );
  });

  it('emite alert:emergency antes de guardar, con el mismo id', async () => {
    const { service, repo, realtime } = await setup();
    const detectedAt = new Date('2026-10-18T12:00:00Z');
    const order: string[] = [];
    realtime.emitAlertEmergency.mockImplementation(() => order.push('ws'));
    repo.insert.mockImplementation(async () => void order.push('db'));

    await service.raise(SOURCE, [FALL], detectedAt);
    expect(order).toEqual(['ws', 'db']);
    const event = realtime.emitAlertEmergency.mock.calls[0][0];
    expect(event).toMatchObject({
      wearableId: 'wb-02-5e0002',
      ticketCode: 'A-003',
      kind: 'FALL',
      level: 'CRITICAL',
      detectedAt: detectedAt.toISOString(),
    });
    expect(repo.insert).toHaveBeenCalledWith([
      expect.objectContaining({ id: event.alertId, status: 'ACTIVE' }),
    ]);
  });

  it('no repite una alerta activa del mismo tipo (sin tormenta de alertas)', async () => {
    const { service, realtime } = await setup([{ wearableId: 'w-uuid', kind: 'HYPOXIA' }]);
    await service.raise(SOURCE, [FALL, HYPOXIA], new Date());
    await service.raise(SOURCE, [FALL], new Date());
    expect(realtime.emitAlertEmergency).toHaveBeenCalledTimes(1);
    expect(realtime.emitAlertEmergency.mock.calls[0][0].kind).toBe('FALL');
  });

  it('ignora hallazgos que no son críticos', async () => {
    const { service, repo, realtime } = await setup();
    await service.raise(
      SOURCE,
      [{ level: 'ATTENTION', kind: 'FEVER', reason: 'Fiebre (38 °C)' }],
      new Date(),
    );
    expect(realtime.emitAlertEmergency).not.toHaveBeenCalled();
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('si no se pudo guardar, permite volver a abrirla', async () => {
    const { service, repo, realtime } = await setup();
    repo.insert.mockRejectedValueOnce(new Error('db caída'));
    await service.raise(SOURCE, [FALL], new Date());
    await service.raise(SOURCE, [FALL], new Date());
    expect(realtime.emitAlertEmergency).toHaveBeenCalledTimes(2);
  });
});

describe('AlertsService.acknowledge', () => {
  it('reconoce, emite alert:acknowledged y habilita una alerta nueva del mismo tipo', async () => {
    const { service, repo, realtime } = await setup();
    await service.raise(SOURCE, [FALL], new Date());
    const id = realtime.emitAlertEmergency.mock.calls[0][0].alertId;
    repo.findOneBy.mockResolvedValue({ id, status: 'ACTIVE', wearableId: 'w-uuid', kind: 'FALL' });
    repo.findOneOrFail.mockResolvedValue({
      id,
      kind: 'FALL',
      level: 'CRITICAL',
      status: 'ACKNOWLEDGED',
      message: 'Caída detectada',
      wearable: { code: 'wb-02-5e0002' },
      ticketId: null,
      ticket: null,
      detectedAt: new Date(),
      acknowledgedAt: new Date(),
      acknowledgedBy: { id: NURSE.id, fullName: NURSE.fullName },
    });

    const alert = await service.acknowledge(id, NURSE);
    expect(alert).toMatchObject({ status: 'ACKNOWLEDGED', acknowledgedBy: { fullName: 'Paula R.' } });
    expect(realtime.emitAlertAcknowledged).toHaveBeenCalledWith(
      expect.objectContaining({ alertId: id, by: { id: NURSE.id, fullName: NURSE.fullName } }),
    );
    await service.raise(SOURCE, [FALL], new Date());
    expect(realtime.emitAlertEmergency).toHaveBeenCalledTimes(2);
  });

  it('responde 409 si ya estaba reconocida y 404 si no existe', async () => {
    const { service, repo } = await setup();
    repo.findOneBy.mockResolvedValueOnce({ id: 'a', status: 'ACKNOWLEDGED' });
    await expect(service.acknowledge('a', NURSE)).rejects.toThrow('La alerta ya fue reconocida');
    repo.findOneBy.mockResolvedValueOnce(null);
    await expect(service.acknowledge('b', NURSE)).rejects.toThrow('Alerta no encontrada');
  });
});
