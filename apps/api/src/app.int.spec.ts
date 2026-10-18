/**
 * Test de integración (Fases 1 y 2) contra PostgreSQL real, con un broker MQTT en proceso
 * (aedes, en lugar de Mosquitto) y clientes Socket.IO reales.
 * Corre solo si existe TEST_DATABASE_URL (en CI lo provee un service container):
 *   TEST_DATABASE_URL=postgresql://vitalia:vitalia@localhost:5432/vitalia_test pnpm nx test api
 * ⚠️ Borra y recrea el esquema de esa base.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  composeSeq,
  LATENCY_TARGETS_MS,
  MQTT_QOS,
  MQTT_TOPICS,
  REALTIME_ERROR_EVENT,
  REALTIME_EVENTS,
  REALTIME_READY_EVENT,
  type Alert,
  type AlertAcknowledgedEvent,
  type AlertEmergencyEvent,
  type LoginResponse,
  type PublicTicket,
  type QueueUpdatedEvent,
  type RealtimeHandshakeAuth,
  type TelemetryReading,
  type TelemetryReadingEvent,
  type Ticket,
  type TicketCalledEvent,
  type Wearable,
  type WearableCommand,
} from '@vitalia/contracts';
import type Aedes from 'aedes';
import { createBroker } from 'aedes';
import mqtt, { type MqttClient } from 'mqtt';
import { randomBytes } from 'node:crypto';
import { createServer, type AddressInfo, type Server as NetServer } from 'node:net';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createValidationPipe } from './common/validation';
import { buildDataSourceOptions } from './database/options';
import { DEV_PASSWORD, seed } from './database/seeds/seed';
import { TelemetryService } from './modules/telemetry/telemetry.service';
import { sealReading } from './testing/telemetry';

const TEST_DB = process.env['TEST_DATABASE_URL'];
const describeIfDb = TEST_DB ? describe : describe.skip;

/** Clave AES de esta corrida: aleatoria, nunca una clave real. */
const AES_KEY = randomBytes(32);

/** Reintenta `check` hasta que no lance (persistencia en segundo plano, conexión MQTT). */
async function eventually<T>(check: () => Promise<T>, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  for (;;) {
    try {
      return await check();
    } catch (err) {
      if (Date.now() - start > timeoutMs) throw err;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

/** Próximo `event` que cumpla `match`, o rechaza a los `timeoutMs`. */
function nextEvent<T>(
  socket: ClientSocket,
  event: string,
  match: (payload: T) => boolean = () => true,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener);
      reject(new Error(`No llegó ${event} en ${timeoutMs} ms`));
    }, timeoutMs);
    const listener = (payload: T) => {
      if (!match(payload)) return;
      clearTimeout(timer);
      socket.off(event, listener);
      resolve(payload);
    };
    socket.on(event, listener);
  });
}

describeIfDb('API Fase 1 (integración con PostgreSQL)', () => {
  let app: INestApplication;
  let doctorToken: string;
  let receptionToken: string;
  let nurseToken: string;
  let broker: Aedes;
  let brokerServer: NetServer;
  let apiUrl: string;
  const sockets: ClientSocket[] = [];

  jest.setTimeout(60_000);

  beforeAll(async () => {
    process.env['DATABASE_URL'] = TEST_DB;
    process.env['JWT_SECRET'] = 'test-secret-de-al-menos-treinta-y-dos-caracteres';
    process.env['NODE_ENV'] = 'test';

    // Broker MQTT en proceso, en un puerto libre.
    broker = createBroker();
    brokerServer = createServer(broker.handle);
    await new Promise<void>((resolve) => brokerServer.listen(0, '127.0.0.1', resolve));
    process.env['MQTT_URL'] = `mqtt://127.0.0.1:${(brokerServer.address() as AddressInfo).port}`;
    process.env['MQTT_USERNAME'] = '';
    process.env['MQTT_PASSWORD'] = '';
    process.env['TELEMETRY_AES_KEY'] = AES_KEY.toString('hex');

    const ds = new DataSource(buildDataSourceOptions(TEST_DB as string));
    await ds.initialize();
    await ds.dropDatabase();
    await ds.runMigrations();
    await seed(ds);
    await ds.destroy();

    const { AppModule } = await import('./app/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(createValidationPipe());
    await app.listen(0, '127.0.0.1');
    apiUrl = await app.getUrl();

    const login = async (email: string) =>
      (
        (
          await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email, password: DEV_PASSWORD })
            .expect(200)
        ).body as LoginResponse
      ).accessToken;
    doctorToken = await login('medico@vitalia.local');
    receptionToken = await login('recepcion@vitalia.local');
    nurseToken = await login('enfermeria@vitalia.local');

    // La API se conecta al broker en segundo plano: esperar a que el health lo vea.
    await eventually(async () => {
      const res = await request(app.getHttpServer()).get('/api/health');
      expect(res.body.checks).toContainEqual({ name: 'mqtt', status: 'ok' });
    }, 10_000);
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    await app?.close();
    await new Promise<void>((resolve) => broker?.close(() => resolve()));
    await new Promise<void>((resolve) => brokerServer?.close(() => resolve()));
  });

  /** Socket.IO conectado y ya unido a su sala (`realtime:ready`). */
  async function connect(auth: RealtimeHandshakeAuth): Promise<ClientSocket> {
    const socket = io(apiUrl, { auth, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    await nextEvent(socket, REALTIME_READY_EVENT);
    return socket;
  }

  async function mqttClient(): Promise<MqttClient> {
    const client = await mqtt.connectAsync(process.env['MQTT_URL'] as string, { reconnectPeriod: 0 });
    return client;
  }

  const authed = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('GET /health incluye los checks de la base y de MQTT', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks).toContainEqual({ name: 'database', status: 'ok' });
    expect(res.body.checks).toContainEqual({ name: 'mqtt', status: 'ok' });
  });

  it('exige token en endpoints privados', async () => {
    await request(app.getHttpServer()).get('/api/tickets').expect(401);
  });

  it('rechaza credenciales inválidas', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'medico@vitalia.local', password: 'incorrecta' })
      .expect(401);
  });

  it('lista la fila ordenada por triaje y llegada', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/tickets?status=WAITING')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    const levels = (res.body as Ticket[]).map((t) => t.triageLevel);
    expect(levels[0]).toBe('CRITICAL');
    expect(levels.indexOf('STABLE')).toBeGreaterThan(levels.lastIndexOf('ATTENTION'));
  });

  it('check-in → llamado → atención → fin, con validaciones de estado y rol', async () => {
    const checkIn = await request(app.getHttpServer())
      .post('/api/check-in')
      .send({
        firstName: 'Ana',
        lastName: 'Pérez',
        documentNumber: '40111222',
        serviceCode: 'CLINICA',
        source: 'KIOSK',
      })
      .expect(201);
    const ticket = checkIn.body as PublicTicket;
    expect(ticket.code).toMatch(/^A-\d{3}$/);
    expect(ticket.position).toBeGreaterThan(0);

    // Idempotente por DNI
    const again = await request(app.getHttpServer())
      .post('/api/check-in')
      .send({
        firstName: 'Ana',
        lastName: 'Pérez',
        documentNumber: '40111222',
        serviceCode: 'CLINICA',
        source: 'KIOSK',
      })
      .expect(201);
    expect(again.body.id).toBe(ticket.id);

    const rooms = await request(app.getHttpServer())
      .get('/api/consulting-rooms')
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    const roomId = rooms.body[0].id as string;

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/call`)
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ consultingRoomId: roomId })
      .expect(403);

    const called = await request(app.getHttpServer())
      .post(`/api/tickets/${ticket.id}/call`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ consultingRoomId: roomId })
      .expect(201);
    expect(called.body.status).toBe('CALLED');
    expect(called.body.consultingRoom.id).toBe(roomId);

    await request(app.getHttpServer())
      .patch(`/api/tickets/${ticket.id}/status`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ status: 'DONE' })
      .expect(409);

    for (const status of ['IN_PROGRESS', 'DONE']) {
      await request(app.getHttpServer())
        .patch(`/api/tickets/${ticket.id}/status`)
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ status })
        .expect(200);
    }

    const pub = await request(app.getHttpServer()).get(`/api/tickets/${ticket.id}/public`).expect(200);
    expect(pub.body).toMatchObject({ status: 'DONE', position: null });
    expect(JSON.stringify(pub.body)).not.toContain('40111222');
  });

  it('valida el body del check-in con mensajes en español', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/check-in')
      .send({
        firstName: 'A',
        lastName: 'Pérez',
        documentNumber: '12.345',
        serviceCode: 'CLINICA',
        source: 'WEB',
      })
      .expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        'El nombre debe tener entre 2 y 80 caracteres',
        'El DNI debe tener entre 7 y 9 dígitos, sin puntos',
      ]),
    );
  });

  it('permite triaje manual a enfermería/médicos', async () => {
    const queue = await request(app.getHttpServer())
      .get('/api/tickets?status=WAITING')
      .set('Authorization', `Bearer ${doctorToken}`);
    const target = (queue.body as Ticket[]).find((t) => t.triageLevel === 'STABLE') as Ticket;
    const res = await request(app.getHttpServer())
      .patch(`/api/tickets/${target.id}/triage`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ triageLevel: 'CRITICAL' })
      .expect(200);
    expect(res.body.triageLevel).toBe('CRITICAL');
  });

  // Revisión del PR #3: una base con el seed viejo (w-NN) y turnos del día no puede
  // quedarse sin pulseras asignadas al correr el seed nuevo.
  it('el seed migra los códigos viejos w-NN sin perder la asignación', async () => {
    const ds = new DataSource(buildDataSourceOptions(TEST_DB as string));
    await ds.initialize();
    try {
      type Row = { code: string; ticket_id: string | null };
      const assignedBefore: Row[] = await ds.query(
        'SELECT code, ticket_id FROM wearables WHERE ticket_id IS NOT NULL ORDER BY code',
      );
      expect(assignedBefore).toHaveLength(4);

      // wb-01-24d7cc → w-01: el estado de una base que ya tenía el seed de antes.
      await ds.query(`UPDATE wearables SET code = 'w-' || substring(code from 4 for 2)`);
      await seed(ds);

      const after: Row[] = await ds.query('SELECT code, ticket_id FROM wearables ORDER BY code');
      expect(after).toHaveLength(8);
      expect(after.every((r) => /^wb-\d{2}-[0-9a-f]{6}$/.test(r.code))).toBe(true);
      expect(after.filter((r) => r.ticket_id !== null)).toEqual(assignedBefore);
    } finally {
      await ds.destroy();
    }
  });

  describe('Fase 2: tiempo real, telemetría, alertas y wearables', () => {
    let publisher: MqttClient;
    let staff: ClientSocket;
    let tv: ClientSocket;
    const tvEvents: string[] = [];
    let wearable: Wearable;
    let other: Wearable;
    let seq = 0;

    const reading = (code: string, patch: Partial<TelemetryReading> = {}): TelemetryReading => ({
      wearableId: code,
      seq: composeSeq(7, ++seq),
      ts: Date.now(),
      hr: 78,
      spo2: 98,
      temp: 36.6,
      accPeakG: 1.0,
      fall: false,
      ...patch,
    });
    const publish = (topicCode: string, r: TelemetryReading | Buffer) =>
      publisher.publishAsync(
        MQTT_TOPICS.wearableData('sala1', topicCode),
        Buffer.isBuffer(r) ? r : sealReading(r, AES_KEY),
        { qos: MQTT_QOS },
      );
    const readingsOf = async (code: string, s: number) =>
      Number(
        (
          await app
            .get(DataSource)
            .query(
              'SELECT count(*)::int AS n FROM telemetry_readings r JOIN wearables w ON w.id = r.wearable_id WHERE w.code = $1 AND r.seq = $2',
              [code, s],
            )
        )[0].n,
      );

    beforeAll(async () => {
      publisher = await mqttClient();
      staff = await connect({ token: doctorToken });
      tv = await connect({ role: 'tv' });
      tv.onAny((event: string) => tvEvents.push(event));

      const list = (
        await request(app.getHttpServer()).get('/api/wearables').set(authed(doctorToken)).expect(200)
      ).body as Wearable[];
      const assigned = list.filter((w) => w.ticket !== null);
      expect(assigned.length).toBeGreaterThanOrEqual(2);
      [wearable, other] = assigned;
    });

    afterAll(async () => {
      await publisher?.endAsync();
    });

    it('rechaza un handshake con token inválido', async () => {
      const socket = io(apiUrl, {
        auth: { token: 'no-es-un-jwt' },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      const error = await nextEvent<{ message: string }>(socket, REALTIME_ERROR_EVENT);
      expect(error.message).toBe('Token inválido o vencido');
      await eventually(async () => expect(socket.connected).toBe(false));
    });

    it(`caída simulada → alert:emergency en < ${LATENCY_TARGETS_MS.alertDesign} ms, persistida`, async () => {
      const fall = reading(wearable.code, { fall: true, accPeakG: 3.4, hr: 112 });
      const alertP = nextEvent<AlertEmergencyEvent>(
        staff,
        REALTIME_EVENTS.ALERT_EMERGENCY,
        (e) => e.wearableId === wearable.code,
      );
      const readingP = nextEvent<TelemetryReadingEvent>(
        staff,
        REALTIME_EVENTS.TELEMETRY_READING,
        (e) => e.reading.seq === fall.seq,
      );
      const start = Date.now();
      await publish(wearable.code, fall);
      const alert = await alertP;
      const latency = Date.now() - start;
      console.info(`Caída publicada → alert:emergency recibido por staff: ${latency} ms`);
      expect(latency).toBeLessThan(LATENCY_TARGETS_MS.alertDesign);
      expect(alert).toMatchObject({
        kind: 'FALL',
        level: 'CRITICAL',
        ticketId: wearable.ticket?.id,
        ticketCode: wearable.ticket?.code,
        detectedAt: new Date(fall.ts).toISOString(),
      });
      expect((await readingP).assessment.level).toBe('CRITICAL');

      // Persistencia en segundo plano: alerta, lectura, pulsera y triaje del turno.
      await app.get(TelemetryService).idle();
      const active = (
        await request(app.getHttpServer()).get('/api/alerts').set(authed(doctorToken)).expect(200)
      ).body as Alert[];
      expect(active).toContainEqual(
        expect.objectContaining({
          id: alert.alertId,
          kind: 'FALL',
          status: 'ACTIVE',
          wearableId: wearable.code,
        }),
      );
      const w = (
        await request(app.getHttpServer())
          .get(`/api/wearables/${wearable.id}`)
          .set(authed(doctorToken))
          .expect(200)
      ).body as Wearable;
      expect(w).toMatchObject({ online: true, room: 'sala1' });
      expect(w.lastReading).toMatchObject({ seq: fall.seq, fall: true, level: 'CRITICAL', accPeakG: 3.4 });
      const ticket = (
        await request(app.getHttpServer())
          .get(`/api/tickets/${wearable.ticket?.id}`)
          .set(authed(doctorToken))
          .expect(200)
      ).body as Ticket;
      expect(ticket.triageLevel).toBe('CRITICAL');
    });

    it('deduplica el reenvío (QoS 1) y no repite la alerta activa', async () => {
      const again = reading(wearable.code, { fall: true });
      const payload = sealReading(again, AES_KEY);
      const alerts: AlertEmergencyEvent[] = [];
      const onAlert = (e: AlertEmergencyEvent) => alerts.push(e);
      staff.on(REALTIME_EVENTS.ALERT_EMERGENCY, onAlert);

      const first = nextEvent<TelemetryReadingEvent>(
        staff,
        REALTIME_EVENTS.TELEMETRY_READING,
        (e) => e.reading.seq === again.seq,
      );
      await publish(wearable.code, payload);
      await first;
      await publish(wearable.code, payload);
      await new Promise((r) => setTimeout(r, 300));
      staff.off(REALTIME_EVENTS.ALERT_EMERGENCY, onAlert);

      await app.get(TelemetryService).idle();
      expect(alerts).toHaveLength(0); // la caída anterior sigue activa
      expect(await readingsOf(wearable.code, again.seq)).toBe(1);
    });

    it('descarta spoof, sobres alterados y pulseras que no están dadas de alta', async () => {
      const seen: TelemetryReadingEvent[] = [];
      const onReading = (e: TelemetryReadingEvent) => seen.push(e);
      staff.on(REALTIME_EVENTS.TELEMETRY_READING, onReading);

      const spoofed = reading(other.code, { spo2: 80 });
      await publish(wearable.code, spoofed); // sobre válido de otra pulsera en este tópico
      const tampered = JSON.parse(sealReading(reading(wearable.code), AES_KEY).toString());
      tampered.tag = Buffer.alloc(16).toString('base64');
      await publish(wearable.code, Buffer.from(JSON.stringify(tampered)));
      await publish('wb-77-5e0077', reading('wb-77-5e0077', { fall: true }));

      await new Promise((r) => setTimeout(r, 300));
      staff.off(REALTIME_EVENTS.TELEMETRY_READING, onReading);
      expect(seen).toHaveLength(0);
      expect(await readingsOf(other.code, spoofed.seq)).toBe(0);
    });

    it('la TV nunca recibe signos vitales ni alertas', () => {
      expect(tvEvents).not.toContain(REALTIME_EVENTS.TELEMETRY_READING);
      expect(tvEvents).not.toContain(REALTIME_EVENTS.ALERT_EMERGENCY);
    });

    it('reconocer una alerta emite alert:acknowledged y no se puede reconocer dos veces', async () => {
      const [alert] = (
        await request(app.getHttpServer()).get('/api/alerts').set(authed(nurseToken)).expect(200)
      ).body as Alert[];
      const ackP = nextEvent<AlertAcknowledgedEvent>(
        staff,
        REALTIME_EVENTS.ALERT_ACKNOWLEDGED,
        (e) => e.alertId === alert.id,
      );
      const res = await request(app.getHttpServer())
        .post(`/api/alerts/${alert.id}/ack`)
        .set(authed(nurseToken))
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'ACKNOWLEDGED',
        acknowledgedBy: { fullName: 'Lic. Paula Romero' },
      });
      expect((await ackP).by.fullName).toBe('Lic. Paula Romero');
      await request(app.getHttpServer())
        .post(`/api/alerts/${alert.id}/ack`)
        .set(authed(nurseToken))
        .expect(409);

      const history = (
        await request(app.getHttpServer()).get('/api/alerts?active=false').set(authed(nurseToken)).expect(200)
      ).body as Alert[];
      expect(history.find((a) => a.id === alert.id)?.status).toBe('ACKNOWLEDGED');
    });

    it('llamar el turno avisa a TV, staff y paciente, actualiza la fila y manda SHOW_TICKET al OLED', async () => {
      const ticketId = wearable.ticket?.id as string;
      const patient = await connect({ ticketId });
      const cmdClient = await mqttClient();
      await cmdClient.subscribeAsync(MQTT_TOPICS.wearableCommand('+', wearable.code), { qos: MQTT_QOS });
      const cmdP = new Promise<{ topic: string; cmd: WearableCommand }>((resolve) =>
        cmdClient.once('message', (topic, payload) =>
          resolve({ topic, cmd: JSON.parse(payload.toString()) }),
        ),
      );
      const forTicket = (e: TicketCalledEvent) => e.ticketId === ticketId;
      const tvCalled = nextEvent<TicketCalledEvent>(tv, REALTIME_EVENTS.TICKET_CALLED, forTicket);
      const patientCalled = nextEvent<TicketCalledEvent>(patient, REALTIME_EVENTS.TICKET_CALLED, forTicket);
      const staffCalled = nextEvent<TicketCalledEvent>(staff, REALTIME_EVENTS.TICKET_CALLED, forTicket);
      const queue = nextEvent<QueueUpdatedEvent>(
        tv,
        REALTIME_EVENTS.QUEUE_UPDATED,
        (e) => e.ticketId === ticketId,
      );

      const rooms = await request(app.getHttpServer()).get('/api/consulting-rooms').set(authed(doctorToken));
      const room = rooms.body[0] as { id: string; name: string };
      await request(app.getHttpServer())
        .post(`/api/tickets/${ticketId}/call`)
        .set(authed(doctorToken))
        .send({ consultingRoomId: room.id })
        .expect(201);

      const called = await tvCalled;
      expect(called).toMatchObject({
        ticketCode: wearable.ticket?.code,
        consultingRoom: room.name,
        professionalName: 'Dra. Laura Fernández',
      });
      await Promise.all([patientCalled, staffCalled]);
      expect(await queue).toMatchObject({
        change: 'CALLED',
        status: 'CALLED',
        waitingCount: expect.any(Number),
      });
      expect(JSON.stringify(await queue)).not.toContain('triage');

      const { topic, cmd } = await cmdP;
      expect(topic).toBe(MQTT_TOPICS.wearableCommand('sala1', wearable.code));
      expect(cmd).toEqual({
        type: 'SHOW_TICKET',
        ticketCode: wearable.ticket?.code,
        consultingRoom: room.name,
      });
      await cmdClient.endAsync();
    });

    it('alta de pulseras: valida el formato y que el número no se repita', async () => {
      await request(app.getHttpServer())
        .post('/api/wearables')
        .set(authed(receptionToken))
        .send({ code: 'wb-09-a1b2c3' })
        .expect(403);
      const invalid = await request(app.getHttpServer())
        .post('/api/wearables')
        .set(authed(nurseToken))
        .send({ code: 'wb-9-xyz' })
        .expect(400);
      expect(invalid.body.message[0]).toContain('wb-<NN>-<mac>');
      const repeated = await request(app.getHttpServer())
        .post('/api/wearables')
        .set(authed(nurseToken))
        .send({ code: 'wb-02-abcdef' })
        .expect(409);
      expect(repeated.body.message).toContain('N° 02');

      const created = await request(app.getHttpServer())
        .post('/api/wearables')
        .set(authed(nurseToken))
        .send({ code: 'WB-09-A1B2C3', label: 'Pulsera 9' })
        .expect(201);
      expect(created.body).toMatchObject({
        code: 'wb-09-a1b2c3',
        number: 9,
        status: 'AVAILABLE',
        online: false,
      });
    });

    it('asignar y liberar una pulsera, sin pisar asignaciones', async () => {
      const list = (await request(app.getHttpServer()).get('/api/wearables').set(authed(receptionToken)))
        .body as Wearable[];
      const free = list.find((w) => w.code === 'wb-09-a1b2c3') as Wearable;
      const queue = (
        await request(app.getHttpServer()).get('/api/tickets?status=WAITING').set(authed(receptionToken))
      ).body as Ticket[];
      const withWearable = new Set(list.map((w) => w.ticket?.id));
      const target = queue.find((t) => !withWearable.has(t.id)) as Ticket;

      const assigned = await request(app.getHttpServer())
        .post(`/api/wearables/${free.id}/assign`)
        .set(authed(receptionToken))
        .send({ ticketId: target.id })
        .expect(200);
      expect(assigned.body).toMatchObject({
        status: 'ASSIGNED',
        ticket: { id: target.id, code: target.code },
      });

      await request(app.getHttpServer())
        .post(`/api/wearables/${other.id}/assign`)
        .set(authed(receptionToken))
        .send({ ticketId: target.id })
        .expect(409);

      const released = await request(app.getHttpServer())
        .post(`/api/wearables/${free.id}/release`)
        .set(authed(receptionToken))
        .expect(200);
      expect(released.body).toMatchObject({ status: 'AVAILABLE', ticket: null });
    });

    it('al finalizar el turno, la pulsera queda libre', async () => {
      const ticketId = wearable.ticket?.id as string;
      for (const status of ['IN_PROGRESS', 'DONE']) {
        await request(app.getHttpServer())
          .patch(`/api/tickets/${ticketId}/status`)
          .set(authed(doctorToken))
          .send({ status })
          .expect(200);
      }
      const w = (
        await request(app.getHttpServer()).get(`/api/wearables/${wearable.id}`).set(authed(doctorToken))
      ).body as Wearable;
      expect(w).toMatchObject({ status: 'AVAILABLE', ticket: null });
    });
  });
});
