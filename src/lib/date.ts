// COPIA GENERADA desde app/src/lib/date.ts. No editar acá: node scripts/sync-from-app.mjs
/** Fecha local YYYY-MM-DD (evita que de noche "hoy" sea mañana por usar UTC). */
export const localDate = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
