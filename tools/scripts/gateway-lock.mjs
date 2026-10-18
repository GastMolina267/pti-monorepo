import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Evita competir por la misma pulsera o reiniciar el stack durante otra corrida. */
export function acquireGatewayLock(directory = '.gateway') {
  mkdirSync(directory, { recursive: true });
  const file = resolve(directory, 'operation.lock');
  let descriptor;
  try {
    descriptor = openSync(file, 'wx', 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const pid = JSON.parse(readFileSync(file, 'utf8')).pid;
    throw new Error(
      `Hay un bloqueo operativo (PID ${pid}). Si el proceso ya terminó, eliminá únicamente .gateway/operation.lock y repetí`,
    );
  }
  writeFileSync(descriptor, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  closeSync(descriptor);
  return () => unlinkSync(file);
}
