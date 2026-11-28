import { ConfigQuickSchema, type ConfigQuick } from "../types";

/* Device-local memory of VANT Quick, per account (localStorage; nothing sensitive): the quick sale
   configured by the user (the server keeps its own copy, which is the one a widget tap charges),
   and when this device's credential expires (the token itself only lives in the Keychain). */
const chaveConfig = (conta: string) => `vant_quick_config:${conta}`;
const chaveCredencial = (conta: string) => `vant_quick_credencial_expira:${conta}`;

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

/** Leaving or switching account: this account's quick memory goes with it. */
export function esquecerConta(conta: string): void {
  try { localStorage.removeItem(chaveConfig(conta)); localStorage.removeItem(chaveCredencial(conta)); } catch { /* nothing kept */ }
}

/** When this device's credential expires (ms), or null. */
export function credencialExpiraEm(conta: string): number | null {
  try { const v = Number(localStorage.getItem(chaveCredencial(conta))); return Number.isFinite(v) && v > 0 ? v : null; } catch { return null; }
}
export function marcarCredencial(conta: string, expiraEm: number): void {
  try { localStorage.setItem(chaveCredencial(conta), String(expiraEm)); } catch { /* re-issued next time */ }
}

/** A stable id of this installation (not of the person): the server rotates one credential per device. */
export function idDoAparelho(): string {
  const k = "vant_quick_aparelho";
  try {
    const v = localStorage.getItem(k);
    if (v && /^[0-9a-f-]{36}$/.test(v)) return v;
    const novo = crypto.randomUUID();
    localStorage.setItem(k, novo);
    return novo;
  } catch { return "00000000-0000-4000-8000-000000000000"; }
}
