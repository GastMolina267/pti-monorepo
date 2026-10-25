import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  criteriaTable,
  numberArg,
  parseArgs,
  percentile,
  statsLine,
  stressShape,
  summarize,
} from './perf-lib';

describe('perf-lib', () => {
  it('percentil por rango más cercano', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    assert.equal(percentile(sorted, 50), 50);
    assert.equal(percentile(sorted, 95), 95);
    assert.equal(percentile(sorted, 99), 99);
    assert.equal(percentile(sorted, 100), 100);
    assert.equal(percentile([7], 99), 7);
    assert.ok(Number.isNaN(percentile([], 50)));
  });

  it('resume sin importar el orden de las muestras', () => {
    const s = summarize([30, 10, 20, 40]);
    assert.deepEqual(s, { n: 4, min: 10, p50: 20, p95: 40, p99: 40, max: 40, mean: 25 });
    assert.equal(statsLine(summarize([])), 'sin muestras');
    assert.match(statsLine(s), /p95 40/);
  });

  it('lee argumentos y valida números', () => {
    const args = parseArgs(['--count=50', '--keep', 'suelto', '--api=http://x:3000/']);
    assert.deepEqual(args, { count: '50', keep: true, api: 'http://x:3000/' });
    assert.equal(numberArg(args, 'count', 1), 50);
    assert.equal(numberArg(args, 'falls', 20), 20);
    assert.throws(() => numberArg({ count: '-1' }, 'count', 1), /positivo/);
    assert.throws(() => numberArg({ count: true }, 'count', 1), /positivo/);
  });

  it('arma la tabla de criterios', () => {
    const table = criteriaTable([{ name: 'Alerta', target: 'p95 < 500 ms', measured: 'p95 5 ms', ok: true }]);
    assert.match(table, /\| Alerta \| p95 < 500 ms \| p95 5 ms \| ✅ \|/);
  });

  it('el estrés tiene ~20 % de turnos abiertos y todos los niveles', () => {
    const shapes = Array.from({ length: 10_000 }, (_, i) => stressShape(i));
    const waiting = shapes.filter((s) => s.status === 'WAITING').length;
    assert.equal(waiting, 1500);
    assert.deepEqual(new Set(shapes.map((s) => s.level)), new Set(['STABLE', 'ATTENTION', 'CRITICAL']));
  });
});
