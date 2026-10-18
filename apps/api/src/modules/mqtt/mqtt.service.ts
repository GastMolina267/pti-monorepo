import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MQTT_QOS } from '@vitalia/contracts';
import mqtt, { type MqttClient } from 'mqtt';
import { randomBytes } from 'node:crypto';
import type { Env } from '../../config/env.schema';
import { topicMatches } from './topic-match';

export type MqttMessageHandler = (topic: string, payload: Buffer) => void;

export interface MqttStatus {
  state: 'disabled' | 'connected' | 'disconnected';
  url?: string;
  lastError?: string;
}

/** `mqtt://user:pass@host:1883` → `mqtt://host:1883` (para logs y health). */
function redact(url: string): string {
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return 'MQTT_URL inválida';
  }
}

/**
 * Cliente MQTT único de la API (Mosquitto, QoS 1). Lo comparten la ingesta de telemetría
 * (suscripción) y los comandos a los wearables (publicación). Si `MQTT_URL` está vacía,
 * queda deshabilitado: la API sigue sirviendo turnos y el health lo marca `degraded`.
 */
@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private readonly subscriptions: { filter: string; handler: MqttMessageHandler }[] = [];
  private client: MqttClient | null = null;
  private url: string | null = null;
  private lastError: string | undefined;

  constructor(private readonly config: ConfigService<Env, true>) {}

  onModuleInit(): void {
    const url = this.config.get('MQTT_URL', { infer: true });
    if (!url) {
      this.logger.warn(
        'MQTT_URL sin configurar: no se reciben lecturas ni se envían comandos a los wearables',
      );
      return;
    }
    this.url = redact(url);
    const client = mqtt.connect(url, {
      clientId: `vitalia-api-${randomBytes(4).toString('hex')}`,
      username: this.config.get('MQTT_USERNAME', { infer: true }) || undefined,
      password: this.config.get('MQTT_PASSWORD', { infer: true }) || undefined,
      reconnectPeriod: 2000,
      connectTimeout: 5000,
      clean: true,
      // Las suscripciones se rehacen a mano en cada `connect` (ver abajo).
      resubscribe: false,
    });
    this.client = client;

    client.on('connect', () => {
      this.lastError = undefined;
      this.logger.log(`Conectado a ${this.url}`);
      for (const { filter } of this.subscriptions) this.subscribeOnBroker(filter);
    });
    client.on('close', () => {
      if (this.lastError === undefined) this.logger.warn(`Sin conexión con ${this.url}, reintentando…`);
    });
    client.on('error', (err) => {
      // Durante la reconexión el mismo error se repite cada 2 s: se loguea una vez.
      if (err.message !== this.lastError) this.logger.warn(`MQTT: ${err.message}`);
      this.lastError = err.message;
    });
    client.on('message', (topic, payload) => this.dispatch(topic, payload));
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.endAsync(true);
    this.client = null;
  }

  /** Registra un handler para un filtro (con comodines). Sobrevive a las reconexiones. */
  subscribe(filter: string, handler: MqttMessageHandler): void {
    this.subscriptions.push({ filter, handler });
    if (this.client?.connected) this.subscribeOnBroker(filter);
  }

  /**
   * Publica un JSON con QoS 1, sin retain. Devuelve `false` (sin lanzar) si no hay conexión:
   * los comandos al wearable son un extra y nunca frenan un llamado.
   */
  async publishJson(topic: string, payload: object): Promise<boolean> {
    if (!this.client?.connected) return false;
    try {
      await this.client.publishAsync(topic, JSON.stringify(payload), { qos: MQTT_QOS, retain: false });
      return true;
    } catch (err) {
      this.logger.warn(`No se pudo publicar en ${topic}: ${(err as Error).message}`);
      return false;
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  status(): MqttStatus {
    if (!this.client || !this.url) return { state: 'disabled' };
    return {
      state: this.client.connected ? 'connected' : 'disconnected',
      url: this.url,
      ...(this.lastError ? { lastError: this.lastError } : {}),
    };
  }

  private subscribeOnBroker(filter: string): void {
    this.client?.subscribe(filter, { qos: MQTT_QOS }, (err) => {
      if (err) this.logger.error(`No se pudo suscribir a ${filter}: ${err.message}`);
      else this.logger.log(`Suscripto a ${filter} (QoS ${MQTT_QOS})`);
    });
  }

  private dispatch(topic: string, payload: Buffer): void {
    for (const { filter, handler } of this.subscriptions) {
      if (!topicMatches(filter, topic)) continue;
      try {
        handler(topic, payload);
      } catch (err) {
        this.logger.error(`Error procesando ${topic}: ${(err as Error).message}`);
      }
    }
  }
}
