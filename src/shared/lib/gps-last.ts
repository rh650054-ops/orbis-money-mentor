/* Última posição conhecida do GPS do DEFCON (só quando o GPS está ligado).
   Usada pelo Caça-Sinal pra detectar em qual semáforo a pessoa vendeu hoje.
   Fica no aparelho; nada sobe pro servidor por aqui. */
const KEY = "orbis_gps_last";

export function setUltimaPosicao(lat: number, lng: number) {
  try { localStorage.setItem(KEY, JSON.stringify({ lat, lng, ts: Date.now() })); } catch { /* nada */ }
}

export function getUltimaPosicao(maxIdadeMs = 8 * 3600 * 1000): { lat: number; lng: number; ts: number } | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { lat: number; lng: number; ts: number };
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
    if (Date.now() - p.ts > maxIdadeMs) return null;
    return p;
  } catch { return null; }
}
