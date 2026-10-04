/**
 * Test de integración de la Fase 1 contra PostgreSQL real.
 * Corre solo si existe TEST_DATABASE_URL (en CI lo provee un service container):
 *   TEST_DATABASE_URL=postgresql://vitalia:vitalia@localhost:5432/vitalia_test pnpm nx test api
 * ⚠️ Borra y recrea el esquema de esa base.
 */
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { LoginResponse, PublicTicket, Ticket } from '@vitalia/contracts';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createValidationPipe } from './common/validation';
import { buildDataSourceOptions } from './database/options';
import { DEV_PASSWORD, seed } from './database/seeds/seed';

const TEST_DB = process.env['TEST_DATABASE_URL'];
const describeIfDb = TEST_DB ? describe : describe.skip;

describeIfDb('API Fase 1 (integración con PostgreSQL)', () => {
  let app: INestApplication;
  let doctorToken: string;
  let receptionToken: string;

  jest.setTimeout(60_000);

  beforeAll(async () => {
    process.env['DATABASE_URL'] = TEST_DB;
    process.env['JWT_SECRET'] = 'test-secret-de-al-menos-treinta-y-dos-caracteres';
    process.env['NODE_ENV'] = 'test';

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
    await app.init();

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
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health incluye el check de la base', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks).toContainEqual({ name: 'database', status: 'ok' });
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
});
