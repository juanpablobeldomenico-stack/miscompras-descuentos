// Copia desde la app los archivos que comparte con el servidor, para que ambos lean las webs con el mismo código.
// Se edita SIEMPRE en app/src/lib; las copias de acá se regeneran con:  node scripts/sync-from-app.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '..', '..', 'app', 'src', 'lib');
const to = join(here, '..', 'src', 'lib');
mkdirSync(to, { recursive: true });

for (const f of ['descuentos-web.ts', 'date.ts', 'http.ts', 'types.ts']) {
  const body = readFileSync(join(from, f), 'utf8');
  writeFileSync(join(to, f), `// COPIA GENERADA desde app/src/lib/${f}. No editar acá: node scripts/sync-from-app.mjs\n${body}`);
  console.log('copiado', f);
}
