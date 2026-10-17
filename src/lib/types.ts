// COPIA GENERADA desde app/src/lib/types.ts. No editar acá: node scripts/sync-from-app.mjs
export type ChainId = 'carrefour' | 'jumbo' | 'disco' | 'vea' | 'changomas' | 'dia' | 'coto' | 'laanonima';

export type Item = { id: string; name: string; qty: number; ean?: string };
/** chain definido = súper con precios online; sin chain = almacén/chino con precios cargados a mano. */
export type Store = { id: string; name: string; chain?: ChainId };
export type Method = { id: string; name: string };
export type Discount = {
  id: string;
  storeId: string; // id de súper o '*' (todos)
  methodId: string; // id de medio de pago, o '*' = cualquier medio
  pct: number;
  day: number; // 0=domingo … 6=sábado, -1 = todos los días
  cap: number; // tope de reintegro, 0 = sin tope
  min: number; // compra mínima, 0 = sin mínimo
  verified?: string;
  source?: string;
  note?: string;
  /** Dónde rige: solo compras online, solo en el local, o ambos. Sin dato = siempre. */
  channel?: Channel;
  /** Último día de vigencia (YYYY-MM-DD, inclusive). */
  validUntil?: string;
  /** true = bajado automáticamente de la web (se reemplaza en cada actualización). */
  auto?: boolean;
  /** De dónde salió: "Carrefour (oficial)", "Personal Pay (oficial)", "Prensa". */
  origin?: string;
  /** Nombre del medio de pago según la web. Con methodId '' el usuario todavía no tiene ese medio cargado. */
  methodName?: string;
};

export type Channel = 'online' | 'tienda' | 'ambos';

/** Resultado de intentar leer una fuente de descuentos. */
export type SourceReport = { name: string; ok: boolean; count: number; error?: string };

/** Programas de beneficios que hay que tener para acceder a ciertas promos. */
export type Club = 'micrf' | 'plus' | 'clubdia';

/**
 * Promo por cantidad: llevando `qty` unidades se pagan `pay` unidades-equivalentes
 * (3x2 → qty 3, pay 2; 2do al 70% → qty 2, pay 1,3). Es relativa al precio unitario, así sirve para web y góndola.
 */
export type Bundle = { qty: number; pay: number; label: string; max?: number; requires?: Club; onlineOnly?: boolean };

/** Producto devuelto por la tienda online de una cadena. */
export type Offer = {
  name: string;
  brand: string;
  price: number;
  listPrice: number;
  promo?: string;
  url?: string;
  image?: string;
  ean?: string;
  bundle?: Bundle;
};

export type GondolaPrice = { price: number; branch: string; date: string };
export type ManualPrice = { price: number; date: string };

export type State = {
  init: boolean;
  items: Item[];
  stores: Store[];
  methods: Method[];
  discounts: Discount[];
  /** claves 'itemId|storeId' */
  prices: Record<string, number>; // precio web (cadenas online)
  picks: Record<string, string>; // nombre del producto cotizado
  eans: Record<string, string>; // código de barras del producto cotizado
  pins: Record<string, string>; // producto fijado a mano (nombre exacto)
  bundles: Record<string, Bundle>; // promo por cantidad del producto cotizado
  clubs: Club[]; // programas de beneficios que tiene el usuario
  gondola: Record<string, GondolaPrice>; // precio en góndola (Precios Claros)
  manual: Record<string, Record<string, ManualPrice>>; // storeId -> nombre normalizado -> precio
  history: string[]; // productos usados antes, para autocompletar
  channelPref: Exclude<Channel, 'ambos'>; // cómo compra: en el local u online (define qué descuentos aplican)
  discountsSync?: { at: string; sources: SourceReport[]; via?: 'servidor' | 'directo'; generatedAt?: string }; // última actualización de descuentos desde la web
  location?: { lat: number; lng: number; label: string };
};

export type PriceMode = 'web' | 'gondola';
