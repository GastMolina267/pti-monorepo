import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BootStore } from './boot-store';
import { nextBoot } from './wearable';

describe('BootStore', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'vitalia-boot-'));
    file = join(dir, 'nested', 'last-boot.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('sin archivo no hay arranque previo', () => {
    expect(new BootStore(file).load()).toBeUndefined();
  });

  it('guarda y recupera el último arranque', () => {
    new BootStore(file).save(1234);
    expect(new BootStore(file).load()).toBe(1234);
  });

  it('nunca retrocede', () => {
    const store = new BootStore(file);
    store.save(50);
    store.save(40);
    expect(store.load()).toBe(50);
  });

  it('un archivo dañado se ignora', () => {
    const store = new BootStore(file);
    store.save(10);
    writeFileSync(file, '{no es json');
    expect(store.load()).toBeUndefined();
    writeFileSync(file, JSON.stringify({ lastBoot: -3 }));
    expect(store.load()).toBeUndefined();
  });

  it('dos corridas en el mismo segundo usan arranques distintos', () => {
    // El caso de la revisión del PR #9: con solo la hora, las dos daban el mismo `boot`.
    const store = new BootStore(file);
    const now = Date.UTC(2026, 9, 13, 12, 0, 0);
    const first = nextBoot(now, store.load());
    store.save(first);
    const second = nextBoot(now + 400, store.load());
    expect(second).toBe(first + 1);
  });
});
