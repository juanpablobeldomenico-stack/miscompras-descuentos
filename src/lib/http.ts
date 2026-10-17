// COPIA GENERADA desde app/src/lib/http.ts. No editar acá: node scripts/sync-from-app.mjs
// Algunos sitios (La Anónima, Precios Claros) rechazan con 403 los User-Agent que no parecen de navegador.
export const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

export async function httpGet(url: string, ms = 15000): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': UA, Accept: 'application/json, text/html, */*' } });
    if (!res.ok && res.status !== 206) throw new Error('HTTP ' + res.status);
    return res;
  } finally {
    clearTimeout(timer);
  }
}
