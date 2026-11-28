import { ConfigQuickSchema, type ConfigQuick } from "../types";

/* Device-local memory of VANT Quick, per account (localStorage; nothing sensitive):
   - the quick sale configured by the user;
   - the taps already executed, so a tap delivered twice (cold start + listener + coming back to
     the app) is executed once. Each tap has its own id, so two real sales in a row are two taps. */
const chaveConfig = (conta: string) => `vant_quick_config:${conta}`;
const chaveFeitos = (conta: string) => `vant_quick_feitos:${conta}`;
const DIA = 24 * 60 * 60_000;

export function lerConfig(conta: string): ConfigQuick | null {
  try {
    const r = ConfigQuickSchema.safeParse(JSON.parse(localStorage.getItem(chaveConfig(conta)) ?? "null"));
    return r.success ? r.data : null;
  } catch { return null; }
}

export function salvarConfig(conta: string, c: ConfigQuick): ConfigQuick {
  const ok = ConfigQuickSchema.parse({ valor: Math.round(c.valor * 100) / 100, metodo: c.metodo });
  localStorage.setItem(chaveConfig(conta), JSON.stringify(ok));
  return ok;
}

function lerFeitos(conta: string, agora: number): Record<string, number> {
  try {
    const bruto = JSON.parse(localStorage.getItem(chaveFeitos(conta)) ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(bruto).filter((e): e is [string, number] => typeof e[1] === "number" && agora - e[1] < DIA));
  } catch { return {}; }
}

export function jaFeita(conta: string, id: string, agora = Date.now()): boolean {
  return id in lerFeitos(conta, agora);
}

/** Marked BEFORE the DEFCON code runs: a crash in the middle loses at most that tap, never doubles it. */
export function marcarFeita(conta: string, id: string, agora = Date.now()): void {
  const feitos = lerFeitos(conta, agora);
  feitos[id] = agora;
  const ultimos = Object.entries(feitos).sort((a, b) => b[1] - a[1]).slice(0, 300);
  try { localStorage.setItem(chaveFeitos(conta), JSON.stringify(Object.fromEntries(ultimos))); } catch { /* full storage: the sale id still protects the database */ }
}

/** Leaving or switching account: this account's quick memory goes with it. */
export function esquecerConta(conta: string): void {
  try { localStorage.removeItem(chaveConfig(conta)); localStorage.removeItem(chaveFeitos(conta)); } catch { /* nothing kept */ }
}
