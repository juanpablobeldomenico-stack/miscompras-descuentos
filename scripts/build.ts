// Baja los descuentos de las webs y escribe docs/descuentos.json (lo que publica GitHub Pages).
// Uso: node scripts/build.ts          Sale con código 1 si alguna fuente falló, así GitHub avisa por mail.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchAllDiscounts } from '../src/lib/descuentos-web.ts';
import { buildSnapshot, type Snapshot } from '../src/publish.ts';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'descuentos.json');
mkdirSync(dirname(out), { recursive: true });

let prev: Snapshot | null = null;
if (existsSync(out)) {
  try {
    prev = JSON.parse(readFileSync(out, 'utf8')) as Snapshot;
  } catch {
    console.warn('El archivo anterior no se pudo leer; se arma uno nuevo.');
  }
}

const next = await fetchAllDiscounts();
const { snapshot, problems } = buildSnapshot(next, prev, new Date().toISOString());
writeFileSync(out, JSON.stringify(snapshot, null, 1) + '\n');

for (const s of snapshot.sources) console.log(`${s.ok ? 'OK ' : 'ERR'} ${s.name}: ${s.count} descuentos${s.error ? ' (' + s.error + ')' : ''}`);
console.log(`Publicado: ${snapshot.discounts.length} descuentos, generado ${snapshot.generatedAt}`);
if (problems.length) {
  console.error('\nPROBLEMAS:\n- ' + problems.join('\n- '));
  process.exit(1);
}
