import { formatTicketCode, type TicketStatus, type TriageLevel } from '@vitalia/contracts';
import { hash } from 'bcryptjs';
import type { DataSource } from 'typeorm';
import { toDayKey } from '../../common/time/day-key';
import { StaffUserEntity } from '../../modules/auth/entities/staff-user.entity';
import { ConsultingRoomEntity } from '../../modules/catalog/entities/consulting-room.entity';
import { ServiceAreaEntity } from '../../modules/catalog/entities/service-area.entity';
import { WearableEntity } from '../../modules/iomt/entities/wearable.entity';
import { PatientEntity } from '../../modules/tickets/entities/patient.entity';
import { TicketEntity } from '../../modules/tickets/entities/ticket.entity';

const FIRST_NAMES = [
  'Lucía',
  'Martín',
  'Sofía',
  'Julián',
  'Valentina',
  'Mateo',
  'Camila',
  'Santiago',
  'Martina',
  'Benjamín',
  'Florencia',
  'Joaquín',
  'Rocío',
  'Tomás',
  'Agustina',
  'Facundo',
  'Milagros',
  'Nicolás',
];
const LAST_NAMES = [
  'González',
  'Rodríguez',
  'Gómez',
  'Fernández',
  'López',
  'Díaz',
  'Martínez',
  'Pérez',
  'Romero',
  'Sosa',
  'Álvarez',
  'Torres',
  'Ruiz',
  'Ramírez',
  'Flores',
  'Benítez',
  'Acosta',
  'Medina',
];
const REASONS = [null, 'Control', 'Dolor de cabeza', 'Fiebre', 'Dolor abdominal', 'Mareos'];
const SOURCES = ['CAPTIVE_PORTAL', 'KIOSK', 'RECEPTION'] as const;

/** Generador pseudoaleatorio determinístico (mulberry32): mismos datos en cada seed. */
function rng(seedValue: number) {
  let a = seedValue;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    pick: <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)] as T,
    digits: (n: number) =>
      String(Math.floor(next() * 9) + 1) +
      Array.from({ length: n - 1 }, () => Math.floor(next() * 10)).join(''),
  };
}

/** Contraseña de desarrollo de todos los usuarios sembrados (sobrescribible con SEED_PASSWORD). */
export const DEV_PASSWORD = 'Vitalia2026!';

const SERVICES = [
  { code: 'CLINICA', name: 'Clínica Médica', prefix: 'A' },
  { code: 'GUARDIA', name: 'Guardia', prefix: 'B' },
  { code: 'PEDIATRIA', name: 'Pediatría', prefix: 'C' },
];

const ROOMS = [
  { code: 'C1', name: 'Consultorio 1', specialty: 'Clínica Médica' },
  { code: 'C2', name: 'Consultorio 2', specialty: 'Clínica Médica' },
  { code: 'C3', name: 'Consultorio 3', specialty: 'Pediatría' },
  { code: 'C4', name: 'Consultorio 4', specialty: 'Clínica Médica' },
  { code: 'G1', name: 'Box de Guardia 1', specialty: 'Guardia' },
];

const STAFF = [
  { email: 'admin@vitalia.local', fullName: 'Administración Vitalia', role: 'ADMIN' as const },
  { email: 'enfermeria@vitalia.local', fullName: 'Lic. Paula Romero', role: 'NURSE' as const },
  { email: 'medico@vitalia.local', fullName: 'Dra. Laura Fernández', role: 'DOCTOR' as const },
  { email: 'pediatria@vitalia.local', fullName: 'Dr. Martín Sosa', role: 'DOCTOR' as const },
  { email: 'recepcion@vitalia.local', fullName: 'Carla Medina', role: 'RECEPTION' as const },
];

/** Turnos de ejemplo del día: [servicio, estado, triaje, minutos desde el check-in]. */
const DEMO_TICKETS: [string, TicketStatus, TriageLevel, number][] = [
  ['CLINICA', 'DONE', 'STABLE', 140],
  ['CLINICA', 'DONE', 'STABLE', 125],
  ['GUARDIA', 'DONE', 'ATTENTION', 110],
  ['CLINICA', 'NO_SHOW', 'STABLE', 100],
  ['CLINICA', 'IN_PROGRESS', 'STABLE', 85],
  ['GUARDIA', 'CALLED', 'ATTENTION', 70],
  ['CLINICA', 'WAITING', 'STABLE', 60],
  ['CLINICA', 'WAITING', 'ATTENTION', 52],
  ['GUARDIA', 'WAITING', 'CRITICAL', 40],
  ['CLINICA', 'WAITING', 'STABLE', 33],
  ['PEDIATRIA', 'WAITING', 'STABLE', 28],
  ['CLINICA', 'WAITING', 'STABLE', 20],
  ['GUARDIA', 'WAITING', 'ATTENTION', 12],
  ['PEDIATRIA', 'WAITING', 'STABLE', 5],
];

export interface SeedSummary {
  services: number;
  rooms: number;
  staff: number;
  wearables: number;
  tickets: number;
}

/**
 * Datos SIMULADOS para desarrollo y demo. Idempotente: el catálogo, el personal y los
 * wearables se actualizan por código/email; los turnos se crean solo si el día no tiene ninguno.
 */
export async function seed(
  ds: DataSource,
  opts: { password?: string; timeZone?: string } = {},
): Promise<SeedSummary> {
  const random = rng(2026);
  const dayKey = toDayKey(new Date(), opts.timeZone);

  await ds.getRepository(ServiceAreaEntity).upsert(SERVICES, ['code']);
  await ds.getRepository(ConsultingRoomEntity).upsert(ROOMS, ['code']);

  const passwordHash = await hash(opts.password ?? DEV_PASSWORD, 10);
  await ds.getRepository(StaffUserEntity).upsert(
    STAFF.map((s) => ({ ...s, passwordHash, active: true })),
    ['email'],
  );

  const wearableRepo = ds.getRepository(WearableEntity);
  await wearableRepo.upsert(
    Array.from({ length: 8 }, (_, i) => {
      const code = `w-${String(i + 1).padStart(2, '0')}`;
      return { code, label: `Pulsera ${i + 1}` };
    }),
    ['code'],
  );

  const ticketRepo = ds.getRepository(TicketEntity);
  let created = 0;
  if ((await ticketRepo.countBy({ dayKey })) === 0) {
    const services = new Map((await ds.getRepository(ServiceAreaEntity).find()).map((s) => [s.code, s]));
    const rooms = await ds.getRepository(ConsultingRoomEntity).find({ order: { code: 'ASC' } });
    const doctor = await ds.getRepository(StaffUserEntity).findOneByOrFail({ email: 'medico@vitalia.local' });
    const counters = new Map<string, number>();
    const now = Date.now();

    for (const [serviceCode, status, triageLevel, minutesAgo] of DEMO_TICKETS) {
      const service = services.get(serviceCode);
      if (!service) continue;
      const patient = await ds.getRepository(PatientEntity).save({
        firstName: random.pick(FIRST_NAMES),
        lastName: random.pick(LAST_NAMES),
        documentNumber: random.digits(8),
      });
      const number = (counters.get(serviceCode) ?? 0) + 1;
      counters.set(serviceCode, number);
      const checkedInAt = new Date(now - minutesAgo * 60_000);
      const called = status !== 'WAITING';
      const room = serviceCode === 'GUARDIA' ? rooms.find((r) => r.code === 'G1') : rooms[number % 4];

      await ticketRepo.save({
        code: formatTicketCode(service.prefix, number),
        number,
        dayKey,
        status,
        triageLevel,
        source: random.pick(SOURCES),
        reason: random.pick(REASONS),
        serviceId: service.id,
        patientId: patient.id,
        checkedInAt,
        calledAt: called ? new Date(checkedInAt.getTime() + 15 * 60_000) : null,
        consultingRoomId: called ? (room?.id ?? null) : null,
        calledById: called ? doctor.id : null,
        startedAt:
          status === 'IN_PROGRESS' || status === 'DONE'
            ? new Date(checkedInAt.getTime() + 17 * 60_000)
            : null,
        finishedAt:
          status === 'DONE' || status === 'NO_SHOW' ? new Date(checkedInAt.getTime() + 30 * 60_000) : null,
      });
      created++;
    }

    // Pulseras asignadas a los primeros cuatro pacientes en espera (para la Fase 2).
    const waiting = await ticketRepo.find({
      where: { dayKey, status: 'WAITING' },
      order: { checkedInAt: 'ASC' },
      take: 4,
    });
    const wearables = await wearableRepo.find({ order: { code: 'ASC' }, take: waiting.length });
    for (const [i, w] of wearables.entries()) {
      const ticket = waiting[i];
      if (ticket) await wearableRepo.update(w.id, { status: 'ASSIGNED', ticketId: ticket.id });
    }
  }

  return {
    services: SERVICES.length,
    rooms: ROOMS.length,
    staff: STAFF.length,
    wearables: 8,
    tickets: created,
  };
}
