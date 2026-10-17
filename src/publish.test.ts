import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { WebDiscount } from './lib/descuentos-web.ts';
import { buildSnapshot, type Snapshot } from './publish.ts';

const d = (origin: string, pct = 15, day = 4): WebDiscount => ({ chain: 'carrefour', method: 'Mercado Pago', pct, day, cap: 0, min: 0, origin, auto: true });
const many = (origin: string, n: number) => Array.from({ length: n }, (_, i) => d(origin, 10 + i, i % 7));
const NOW = '2026-10-17T12:00:00.000Z';

const prev = (): Snapshot => ({
  version: 1, generatedAt: '2026-10-17T06:00:00.000Z', sources: [],
  discounts: [...many('Carrefour (oficial)', 20), ...many('Personal Pay (oficial)', 4)],
});

test('todo bien: se publica lo nuevo y no hay problemas', () => {
  const next = { items: [...many('Carrefour (oficial)', 22), ...many('Personal Pay (oficial)', 5)], report: [{ name: 'Carrefour', ok: true, count: 22 }, { name: 'Personal Pay', ok: true, count: 5 }] };
  const { snapshot, problems } = buildSnapshot(next, prev(), NOW);
  assert.deepEqual(problems, []);
  assert.equal(snapshot.discounts.length, 27);
  assert.equal(snapshot.generatedAt, NOW);
  assert.equal(snapshot.version, 1);
});

test('si una fuente falla se conserva lo anterior de esa fuente y se avisa', () => {
  const next = { items: many('Personal Pay (oficial)', 5), report: [{ name: 'Carrefour', ok: false, count: 0, error: 'HTTP 403' }, { name: 'Personal Pay', ok: true, count: 5 }] };
  const { snapshot, problems } = buildSnapshot(next, prev(), NOW);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Carrefour.*HTTP 403/);
  assert.equal(snapshot.discounts.filter((x) => x.origin?.startsWith('Carrefour')).length, 20); // intactos
  assert.equal(snapshot.discounts.filter((x) => x.origin?.startsWith('Personal Pay')).length, 5); // los nuevos
  const s = snapshot.sources.find((x) => x.name === 'Carrefour')!;
  assert.deepEqual([s.ok, s.count], [false, 20]);
});

test('si una fuente responde "ok" pero de golpe casi vacía, se la trata como rota', () => {
  const next = { items: [...many('Carrefour (oficial)', 3), ...many('Personal Pay (oficial)', 4)], report: [{ name: 'Carrefour', ok: true, count: 3 }, { name: 'Personal Pay', ok: true, count: 4 }] };
  const { snapshot, problems } = buildSnapshot(next, prev(), NOW);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Carrefour.*3 descuentos.*20/);
  assert.equal(snapshot.discounts.filter((x) => x.origin?.startsWith('Carrefour')).length, 20);
});

test('una baja chica es normal (vencen promos): no es un problema', () => {
  const next = { items: [...many('Carrefour (oficial)', 12), ...many('Personal Pay (oficial)', 4)], report: [{ name: 'Carrefour', ok: true, count: 12 }, { name: 'Personal Pay', ok: true, count: 4 }] };
  const { snapshot, problems } = buildSnapshot(next, prev(), NOW);
  assert.deepEqual(problems, []);
  assert.equal(snapshot.discounts.filter((x) => x.origin?.startsWith('Carrefour')).length, 12);
});

test('primera vez (sin archivo anterior): publica lo que haya; si falla todo, queda vacío y avisa', () => {
  const ok = buildSnapshot({ items: many('Carrefour (oficial)', 3), report: [{ name: 'Carrefour', ok: true, count: 3 }] }, null, NOW);
  assert.equal(ok.snapshot.discounts.length, 3);
  assert.deepEqual(ok.problems, []);
  const fail = buildSnapshot({ items: [], report: [{ name: 'Carrefour', ok: false, count: 0, error: 'x' }] }, null, NOW);
  assert.equal(fail.snapshot.discounts.length, 0);
  assert.equal(fail.problems.length, 1);
});
