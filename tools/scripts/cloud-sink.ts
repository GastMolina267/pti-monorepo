/**
 * "Nube" de prueba para la réplica del gateway (RF-O6, ADR 0018). Recibe los lotes de
 * `SyncService`, deduplica por `(gatewayId, id)` y los guarda en `.cloud-sink/events.jsonl`.
 *
 *   pnpm cloud:sink                       # http://localhost:4900/ingest, sin token
 *   pnpm cloud:sink --port=4900 --token=secreto
 *
 * En el .env de la API: CLOUD_SYNC_URL=http://localhost:4900/ingest (y CLOUD_SYNC_TOKEN si
 * usás --token). Para simular un corte de WAN, frená este proceso: el gateway acumula en el
 * outbox y reenvía todo al volver.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import type { SyncBatch } from '../../libs/shared/contracts/src/lib/sync/sync';

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const port = Number(arg('port') ?? 4900);
const token = arg('token');
const dir = '.cloud-sink';
mkdirSync(dir, { recursive: true });

const seen = new Set<string>();
let duplicates = 0;

createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/ingest') {
    res.writeHead(404).end();
    return;
  }
  if (token && req.headers.authorization !== `Bearer ${token}`) {
    res.writeHead(401).end();
    return;
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let batch: SyncBatch;
    try {
      batch = JSON.parse(body) as SyncBatch;
    } catch {
      res.writeHead(400).end();
      return;
    }
    let fresh = 0;
    for (const e of batch.events) {
      const key = `${batch.gatewayId}:${e.id}`;
      if (seen.has(key)) {
        duplicates++;
        continue;
      }
      seen.add(key);
      fresh++;
      appendFileSync(`${dir}/events.jsonl`, JSON.stringify({ gatewayId: batch.gatewayId, ...e }) + '\n');
    }
    const time = new Date().toLocaleTimeString('es-AR');
    console.log(
      `${time} ${batch.gatewayId}: ${fresh} evento(s) nuevos · total ${seen.size} · duplicados ${duplicates}`,
    );
    res.writeHead(202, { 'content-type': 'application/json' }).end(JSON.stringify({ accepted: fresh }));
  });
}).listen(port, () =>
  console.log(`Nube de prueba en http://localhost:${port}/ingest${token ? ' (con token)' : ''}`),
);
