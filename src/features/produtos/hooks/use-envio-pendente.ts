/* A production that was sent but never confirmed (signal dropped, app closed) stays on the phone with
   its key. Resending the SAME key and content is safe: the database either applies it once or answers
   what it already stored. Per-viewer convenience only (localStorage); the database is the record. */
import { useCallback, useState } from "react";
import type { ItemEnvio } from "../api/use-producao-query";

export interface EnvioPendente { chave: string; itens: ItemEnvio[]; justificativa: string | null; quando: string }

const chaveDe = (uid: string) => `vant:producao-pendente:${uid}`;

function ler(uid: string): EnvioPendente | null {
  try {
    const t = localStorage.getItem(chaveDe(uid));
    if (!t) return null;
    const v = JSON.parse(t) as EnvioPendente;
    return v && typeof v.chave === "string" && Array.isArray(v.itens) ? v : null;
  } catch { return null; }
}

export function useEnvioPendente(uid: string | undefined) {
  const [pendente, setPendente] = useState<EnvioPendente | null>(() => (uid ? ler(uid) : null));
  const guardar = useCallback((e: EnvioPendente) => {
    setPendente(e);
    try { if (uid) localStorage.setItem(chaveDe(uid), JSON.stringify(e)); } catch { /* storage off: the in-memory copy still allows a retry */ }
  }, [uid]);
  const limpar = useCallback(() => {
    setPendente(null);
    try { if (uid) localStorage.removeItem(chaveDe(uid)); } catch { /* nothing to do */ }
  }, [uid]);
  return { pendente, guardar, limpar };
}
