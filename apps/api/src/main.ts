import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@vitalia/contracts';
import { AppModule } from './app/app.module';
import { createValidationPipe } from './common/validation';
import type { Env } from './config/env.schema';
import { RealtimeIoAdapter } from './modules/realtime/realtime-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Detrás de Nginx: la IP real del cliente sale de X-Forwarded-For (rate limit por persona).
  const trustProxy = config.get('TRUST_PROXY', { infer: true });
  if (trustProxy !== undefined) app.set('trust proxy', trustProxy);

  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim());
  app.enableCors({ origin: origins, credentials: true });
  app.useWebSocketAdapter(new RealtimeIoAdapter(app, origins));
  app.useGlobalPipes(createValidationPipe());

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const doc = new DocumentBuilder()
      .setTitle('Vitalia API')
      .setDescription('Backend único del Edge Gateway — Ecosistema Digital Hospitalario')
      .setVersion(config.get('APP_VERSION', { infer: true }))
      .addBearerAuth()
      .build();
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, SwaggerModule.createDocument(app, doc));
  }

  const port = config.get('API_PORT', { infer: true }) ?? config.get('PORT', { infer: true }) ?? 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`🩺 Vitalia API en http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
  Logger.log(`📚 Swagger en http://localhost:${port}/${API_PREFIX}/docs`, 'Bootstrap');
  Logger.log(`⚡ Socket.IO en ws://localhost:${port}/socket.io`, 'Bootstrap');
}

void bootstrap();
