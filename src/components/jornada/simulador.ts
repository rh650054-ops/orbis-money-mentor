/* Simulador do teste (Rick, 06/10/2026): o admin escolhe "estou no dia N do teste"
   e o app inteiro passa a se comportar como para um vendedor em teste naquele dia —
   missão, selo, oferta do fim do Foco, tela de planos e o bloqueio do fim do teste.
   Só muda o que ESTE aparelho mostra pra ESTA conta: nada é gravado no banco
   (os passos da missão ficam numa chave local separada). */
import { useEffect, useState } from "react";
import type { Passo } from "./jornada-lib";

/** 0–3 = dias do teste; 4 = o teste acabou (bloqueio). */
export type DiaSimulado = 0 | 1 | 2 | 3 | 4;

const CHAVE = "vant_simular_teste";
const EVENTO = "vant:simulacao";
const chavePassos = (uid: string) => `vant_simular_passos_${uid}`;

export function lerSimulacao(uid: string | null | undefined): DiaSimulado | null {
  if (!uid) return null;
  try {
    const s = JSON.parse(localStorage.getItem(CHAVE) || "null") as { uid?: string; dia?: number } | null;
    if (!s || s.uid !== uid || typeof s.dia !== "number" || s.dia < 0 || s.dia > 4) return null;
    return s.dia as DiaSimulado;
  } catch { return null; }
}

export function simular(uid: string, dia: DiaSimulado | null): void {
  try {
    if (dia == null) localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, JSON.stringify({ uid, dia }));
  } catch { /* sem storage: não simula */ }
  window.dispatchEvent(new Event(EVENTO));
}

export function passosSimulados(uid: string): Passo[] {
  try { return JSON.parse(localStorage.getItem(chavePassos(uid)) || "[]") as Passo[]; } catch { return []; }
}

export function gravarPassoSimulado(uid: string, passo: Passo): void {
  try { localStorage.setItem(chavePassos(uid), JSON.stringify(Array.from(new Set([...passosSimulados(uid), passo])))); } catch { /* ok */ }
  window.dispatchEvent(new Event(EVENTO));
}

/** Zera as missões simuladas e deixa a oferta de cada dia aparecer de novo. */
export function zerarSimulacao(uid: string): void {
  try {
    localStorage.removeItem(chavePassos(uid));
    for (let d = 0; d <= 3; d++) localStorage.removeItem(`vant_oferta_${uid}_${d}`);
  } catch { /* ok */ }
  window.dispatchEvent(new Event(EVENTO));
}

/** Dia simulado, reativo (muda na hora em todas as telas abertas). */
export function useSimulacao(uid: string | null | undefined): DiaSimulado | null {
  const [dia, setDia] = useState<DiaSimulado | null>(() => lerSimulacao(uid));
  useEffect(() => {
    const f = () => setDia(lerSimulacao(uid));
    f();
    window.addEventListener(EVENTO, f);
    window.addEventListener("storage", f);
    return () => { window.removeEventListener(EVENTO, f); window.removeEventListener("storage", f); };
  }, [uid]);
  return dia;
}

export const EVENTO_SIMULACAO = EVENTO;
