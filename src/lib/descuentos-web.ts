// COPIA GENERADA desde app/src/lib/descuentos-web.ts. No editar acá: node scripts/sync-from-app.mjs
import { localDate } from './date.ts';
import { httpGet } from './http.ts';
import type { Channel, ChainId, Discount, SourceReport } from './types.ts';

// Descuentos por medio de pago bajados de las propias webs:
//  - Carrefour: promociones bancarias de carrefour.com.ar (consulta GraphQL pública que usa su página).
//  - Personal Pay: API pública de beneficios de personal.com.ar/pay (Día, ChangoMás, etc.).
// Mercado Pago, MODO, Cuenta DNI y los bancos no publican una lista pública consultable; solo aparecen
// cuando una cadena los informa en su propia página (como hace Carrefour).

export type WebDiscount = Omit<Discount, 'id' | 'storeId' | 'methodId'> & { chain: ChainId; method: string };

const dayBefore = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return localDate(d);
};

const money = (txt: string) => parseInt(txt.replace(/\./g, '').replace(/,\d+$/, ''), 10) || 0;

// ---------- Carrefour ----------

const CARREFOUR_QUERY = {
  persistedQuery: {
    version: 1,
    sha256Hash: 'e3aa1d96402d80dbca5c2c9dbcb7ff859970db0ccfdb64e583fb8a9b1bbff49e',
    sender: 'valtech.carrefourar-bank-promotions@0.x',
    provider: 'vtex.store-graphql@2.x',
  },
};
const CARREFOUR_URL =
  'https://www.carrefour.com.ar/_v/public/graphql/v1?workspace=master&maxAge=short&appsEtag=remove&domain=store&locale=es-AR&operationName=GetPromotions&variables=' +
  encodeURIComponent('{}') +
  '&extensions=' +
  encodeURIComponent(JSON.stringify(CARREFOUR_QUERY));

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

const BANCOS = 'patagonia|naci[oó]n|galicia|provincia|macro|santander|supervielle|ciudad|credicoop|hsbc|bbva|icbc|comafi|hipotecario|santa fe|entre r[ií]os|c[oó]rdoba|san juan|corrientes|formosa|chubut|neuqu[eé]n';

/** Medio de pago de una promo de Carrefour, a partir del título y el arranque del texto legal (el resto suele nombrar exclusiones). */
export function carrefourMethod(title: string, subTitle: string, legal: string, imgs: string): string | null {
  const head = `${title} ${subTitle}`;
  const lead = legal.slice(0, 420);
  const tests: [RegExp, string][] = [
    [/mercado ?pago/i, 'Mercado Pago'],
    [/\bmodo\b/i, 'MODO'],
    [/cuenta dni/i, 'Cuenta DNI'],
    [/personal ?pay/i, 'Personal Pay'],
    [/naranja ?x/i, 'Naranja X'],
    [/club la naci[oó]n/i, 'Club La Nación'],
    [/cuenta digital|carrefour banco/i, 'Carrefour Banco'],
  ];
  for (const src of [head, lead, imgs]) {
    for (const [re, name] of tests) if (re.test(src)) return name;
    const banco = src.match(new RegExp(`banco (${BANCOS})`, 'i'));
    if (banco) return `Banco ${banco[1].charAt(0).toUpperCase()}${banco[1].slice(1).toLowerCase()}`;
  }
  if (/todos los medios de pago/i.test(head)) return '*';
  return null;
}

/** Lee la respuesta de GetPromotions. Descarta lo vencido, lo que no es un % de descuento, lo exclusivo de un grupo (jubilados, empleados públicos…) y lo que no rige en tiendas Hiper/Market/Express ni online. */
export function parseCarrefour(json: any, today = localDate()): { items: WebDiscount[]; skipped: number } {
  const docs: Record<string, string>[] = (json?.data?.documents ?? []).map((d: any) => Object.fromEntries((d.fields ?? []).map((f: any) => [f.key, f.value])));
  const items: WebDiscount[] = [];
  let skipped = 0;
  for (const d of docs) {
    const pct = parseFloat(d.discount_percentage);
    const from = (d.active_from ?? '').slice(0, 10);
    const lastDay = d.active_to && d.active_to !== 'null' ? dayBefore(d.active_to) : '';
    if (d.active !== 'true' || !(pct > 0) || (from && today < from) || (lastDay && today > lastDay)) continue;
    const text = `${d.title} ${d.sub_title}`;
    // Grupos o segmentos que no se pueden asumir (jubilados, empleados públicos, plan sueldo, niveles de tarjeta).
    if (/jubilad|pensionad|anses|emplead[oa]s? p[uú]blic|beneficiari|empleado|plan sueldo|exclusivo para clientes|singular|cl[aá]sica|\bplus\b|premium|black|platinum|gold|infinite|signature/i.test(text)) { skipped++; continue; }

    const online = d.ecommerce === 'true';
    const tienda = d.hyper === 'true' || d.market === 'true' || d.express === 'true';
    if (!online && !tienda) { skipped++; continue; } // solo Carrefour Maxi (mayorista)
    const channel: Channel = online && tienda ? 'ambos' : online ? 'online' : 'tienda';

    const imgs = [d.img_card, d.img_card_2, d.img_card_3, d.img_card_4, d.img_card_5, d.img_card_6].filter((x) => x && x !== 'null').join(' ');
    const method = carrefourMethod(d.title ?? '', d.sub_title ?? '', d.legal ?? '', imgs);
    if (!method) { skipped++; continue; }

    const blob = `${d.sub_title} ${d.legal}`;
    const min = blob.match(/m[ií]nimo de compra\s*(?:de\s*)?\$\s*([\d.]+)/i);
    const cap = /sin tope/i.test(blob) ? null : blob.match(/tope (?:de )?(?:devoluci[oó]n|reintegro)?\s*(?:de\s*)?\$\s*([\d.]+)/i);
    const days = DAY_KEYS.map((k, i) => (d[k] === 'true' ? i : -1)).filter((i) => i >= 0);
    for (const day of days.length === 7 || days.length === 0 ? [-1] : days) {
      items.push({
        chain: 'carrefour', method, pct, day, cap: cap ? money(cap[1]) : 0, min: min ? money(min[1]) : 0, channel,
        validUntil: lastDay || undefined, auto: true, origin: 'Carrefour (oficial)', verified: today,
        source: 'https://www.carrefour.com.ar/descuentos-bancarios',
        note: [d.validText && d.validText !== 'null' ? d.validText : '', d.sub_title && d.sub_title !== 'null' ? d.sub_title.slice(0, 140) : ''].filter(Boolean).join('. '),
      });
    }
  }
  return { items: keepLowestPerGroup(items), skipped };
}

/**
 * Si para el mismo medio, día y canal hay varios porcentajes (suelen ser niveles de tarjeta o de cliente),
 * se conserva el más bajo, que es el que seguro corresponde, y se avisa el rango en la nota.
 */
export function keepLowestPerGroup(items: WebDiscount[]): WebDiscount[] {
  const groups = new Map<string, WebDiscount[]>();
  for (const it of items) {
    const key = [it.chain, it.method, it.day, it.channel].join('|');
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  return [...groups.values()].map((g) => {
    const sorted = [...g].sort((a, b) => a.pct - b.pct);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    if (high.pct === low.pct) return low;
    return { ...low, note: `${low.note ? low.note + '. ' : ''}Según tu tarjeta o plan: de ${low.pct}% a ${high.pct}%.`.slice(0, 220) };
  });
}

export async function fetchCarrefour(today = localDate()) {
  const res = await httpGet(CARREFOUR_URL);
  return parseCarrefour(await res.json(), today);
}

// ---------- Personal Pay ----------

const PP_URL = 'https://www.personal.com.ar/pay/api/benefits?sourceSection=web&category=Supermercados';

const PP_CHAINS: [RegExp, ChainId][] = [
  [/\bd[ií]a\b/i, 'dia'],
  [/chango\s?m[aá]s/i, 'changomas'],
  [/\bcoto\b/i, 'coto'],
  [/carrefour/i, 'carrefour'],
  [/jumbo/i, 'jumbo'],
  [/\bdisco\b/i, 'disco'],
  [/\bvea\b/i, 'vea'],
  [/an[oó]nima/i, 'laanonima'],
];

const DAY_PREFIX: Record<string, number> = { do: 0, lu: 1, ma: 2, mi: 3, ju: 4, vi: 5, sa: 6 };
const dayOf = (word: string) => DAY_PREFIX[word.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().slice(0, 2)];

/** ["Jueves"], ["Do","Vi","Sá"], ["Todos los días"], ["Lunes a Miércoles"] → [4], [0,5,6], [-1], [1,2,3]. */
export function parseDays(list: string[]): number[] {
  const out = new Set<number>();
  for (const raw of list) {
    if (/todos/i.test(raw)) return [-1];
    const range = raw.match(/^\s*(\S+)\s+a\s+(\S+)\s*$/i);
    if (range) {
      const a = dayOf(range[1]);
      const b = dayOf(range[2]);
      if (a !== undefined && b !== undefined) for (let i = a; ; i = (i + 1) % 7) { out.add(i); if (i === b) break; }
      continue;
    }
    for (const w of raw.split(/[,\sy]+/)) {
      const d = w ? dayOf(w) : undefined;
      if (d !== undefined) out.add(d);
    }
  }
  const days = [...out].sort();
  return days.length === 7 || days.length === 0 ? [-1] : days;
}

export function parsePersonalPay(json: any, today = localDate()): { items: WebDiscount[]; skipped: number } {
  const list: any[] = json?.data?.benefits ?? [];
  const items: WebDiscount[] = [];
  let skipped = 0;
  for (const b of list) {
    const chain = PP_CHAINS.find(([re]) => re.test(b.title ?? ''))?.[1];
    const pct = parseFloat(String(b.discounts ?? '').replace(',', '.'));
    const due = String(b.dueDate ?? '').slice(0, 10);
    if (!chain || !(pct > 0) || (due && today > due)) { skipped++; continue; }
    const level = b.levels?.[0] ?? {};
    const cap = money(String(level.limitAmount ?? b.limitAmount ?? '0').replace('$', ''));
    for (const day of parseDays(b.days ?? [])) {
      items.push({
        chain, method: 'Personal Pay', pct, day,
        cap: cap >= 1_000_000 ? 0 : cap, // "$3.000.000" equivale a sin tope
        min: Number(level.paymentMin) > 100 ? Number(level.paymentMin) : 0,
        channel: 'ambos', validUntil: due || undefined, auto: true, origin: 'Personal Pay (oficial)', verified: today,
        source: 'https://www.personal.com.ar/pay/beneficios',
        note: [b.paymentMethods?.map((p: any) => p.name).join(', '), level.usageLimit].filter(Boolean).join('. ').slice(0, 160),
      });
    }
  }
  return { items, skipped };
}

export async function fetchPersonalPay(today = localDate()) {
  const res = await httpGet(PP_URL);
  return parsePersonalPay(await res.json(), today);
}

// ---------- Todas las fuentes ----------

/** Consulta todas las fuentes en paralelo; si una falla, las demás siguen funcionando. */
export async function fetchAllDiscounts(today = localDate()): Promise<{ items: WebDiscount[]; report: SourceReport[] }> {
  const sources: [string, () => Promise<{ items: WebDiscount[]; skipped: number }>][] = [
    ['Carrefour', () => fetchCarrefour(today)],
    ['Personal Pay', () => fetchPersonalPay(today)],
  ];
  const results = await Promise.allSettled(sources.map(([, f]) => f()));
  const items: WebDiscount[] = [];
  const report: SourceReport[] = results.map((r, i) => {
    if (r.status === 'fulfilled') {
      items.push(...r.value.items);
      return { name: sources[i][0], ok: true, count: r.value.items.length };
    }
    return { name: sources[i][0], ok: false, count: 0, error: String((r.reason as Error)?.message ?? r.reason) };
  });
  return { items, report };
}
