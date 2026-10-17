import type { WebDiscount } from './lib/descuentos-web.ts';
import type { SourceReport } from './lib/types.ts';

/** Lo que se publica y descarga la app. Si cambia el formato, subir `version`. */
export type Snapshot = { version: 1; generatedAt: string; sources: SourceReport[]; discounts: WebDiscount[] };

/** Una fuente que de golpe devuelve menos de esta proporción de lo que tenía se considera sospechosa (cambió su página). */
const DROP_RATIO = 0.4;
const MIN_PREVIOUS = 5;

/**
 * Arma lo que se va a publicar. Nunca publica una fuente rota: si una falla o devuelve de golpe muy poco, se conservan
 * los descuentos que ya estaban publicados de esa fuente y se informa un problema.
 */
export function buildSnapshot(next: { items: WebDiscount[]; report: SourceReport[] }, prev: Snapshot | null, now: string): { snapshot: Snapshot; problems: string[] } {
  const problems: string[] = [];
  const discounts: WebDiscount[] = [];
  const sources: SourceReport[] = [];

  for (const r of next.report) {
    const fresh = next.items.filter((i) => i.origin?.startsWith(r.name));
    const old = (prev?.discounts ?? []).filter((i) => i.origin?.startsWith(r.name));
    if (!r.ok) {
      problems.push(`${r.name}: falló la consulta (${r.error ?? 'sin detalle'}). Se conserva lo publicado antes (${old.length}).`);
      discounts.push(...old);
      sources.push({ ...r, count: old.length });
    } else if (old.length >= MIN_PREVIOUS && fresh.length < old.length * DROP_RATIO) {
      problems.push(`${r.name}: devolvió ${fresh.length} descuentos y antes había ${old.length}. Parece un cambio en su página; se conserva lo anterior.`);
      discounts.push(...old);
      sources.push({ name: r.name, ok: false, count: old.length, error: 'resultado sospechosamente bajo' });
    } else {
      discounts.push(...fresh);
      sources.push(r);
    }
  }
  return { snapshot: { version: 1, generatedAt: now, sources, discounts }, problems };
}
