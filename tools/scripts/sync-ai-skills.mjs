#!/usr/bin/env node
/**
 * Copia las skills del proyecto (.agents/skills/vitalia-*) a las carpetas que lee
 * cada herramienta de IA. Fuente única: .agents/skills. No toca las skills de Nx.
 *
 *   pnpm ai:sync
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const source = join(root, '.agents', 'skills');
const targets = ['.claude/skills', '.cursor/skills', '.github/skills'];
const PREFIX = 'vitalia-';

const skills = readdirSync(source, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith(PREFIX))
  .map((d) => d.name);

for (const target of targets) {
  const dir = join(root, target);
  mkdirSync(dir, { recursive: true });
  // Limpia skills del proyecto que ya no existan en la fuente
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (d.isDirectory() && d.name.startsWith(PREFIX) && !skills.includes(d.name)) {
      rmSync(join(dir, d.name), { recursive: true, force: true });
    }
  }
  for (const skill of skills) {
    const dest = join(dir, skill);
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    cpSync(join(source, skill), dest, { recursive: true });
  }
}

console.log(`✔ ${skills.length} skills sincronizadas → ${targets.join(', ')}`);
console.log(`  ${skills.join(', ')}`);
