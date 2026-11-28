/* "Hide values" on the Bancos screen: a per-device convenience, remembered in this browser only. */
import { useState } from "react";
import { reais } from "@/features/financas-resumo";

const CHAVE = "vant:financas:ocultar-valores";
const ler = () => { try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; } };

export function useOcultarValores() {
  const [oculto, setOculto] = useState(ler);
  const alternar = () => setOculto((v) => {
    try { localStorage.setItem(CHAVE, v ? "0" : "1"); } catch { /* private window: only for this visit */ }
    return !v;
  });
  return { oculto, alternar };
}

export const MASCARA = "R$ •••••";

/** A balance as the screen shows it: null = the bank did not send it (never shown as zero). */
export const dinheiro = (v: number | null | undefined, oculto: boolean) =>
  v == null ? "indisponível" : oculto ? MASCARA : v < 0 ? `− ${reais(Math.abs(v))}` : reais(v);
