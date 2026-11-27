import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ponteApple } from "../lib/ponte";
import type { ResultadoCompra } from "../types";
import { fluxoDoApp } from "./fluxo-do-app";

export type Fase = "parado" | "comprando" | "restaurando" | "verificando";
import { EVENTO_APPLE_LIBEROU } from "@/shared/lib/cobranca-loja";
/** Heard by the rest of the app (the end-of-trial screen) when a purchase released the access. */
export { EVENTO_APPLE_LIBEROU };

/** While the screen is open, a paid purchase the server has not confirmed yet is sent again by
    itself after these waits (the background recovery also retries on launch, return and reconnect). */
export const ESPERAS_DA_CONFIRMACAO_MS = [4_000, 12_000, 30_000, 60_000];

const relevante = (rs: ResultadoCompra[]): ResultadoCompra | null =>
  rs.find((r) => r.estado === "liberada") ?? rs.find((r) => r.estado === "aguardando_servidor") ?? rs.find((r) => r.estado === "de_outra_conta")
  ?? rs.find((r) => r.estado === "recusada" && r.motivo === "sem_acesso") ?? null;

/** Buying, restoring and retrying, with the state the screen draws. */
export function useCompraApple() {
  const qc = useQueryClient();
  const [fase, setFase] = useState<Fase>("parado");
  const [resultado, setResultado] = useState<ResultadoCompra | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const concluir = useCallback((r: ResultadoCompra | null) => {
    setResultado(r?.estado === "cancelada" ? null : r);
    if (r?.estado === "liberada") {
      void qc.invalidateQueries();
      window.dispatchEvent(new CustomEvent(EVENTO_APPLE_LIBEROU));
    }
  }, [qc]);

  const comprar = useCallback(async (produto: string) => {
    const f = fluxoDoApp();
    if (!f || fase !== "parado") return;
    setFase("comprando"); setAviso(null);
    try { concluir(await f.comprar(produto)); } finally { setFase("parado"); }
  }, [fase, concluir]);

  /** "Tentar de novo" after a paid purchase the server could not confirm: never opens a purchase. */
  const tentarDeNovo = useCallback(async () => {
    const f = fluxoDoApp();
    if (!f || fase !== "parado") return;
    setFase("verificando");
    try { const r = relevante(await f.recuperar()); if (r) concluir(r); } finally { setFase("parado"); }
  }, [fase, concluir]);

  // a recoverable result retries by itself (never a new purchase: tentarDeNovo only re-sends)
  const tentativas = useRef(0);
  const [rodada, setRodada] = useState(0);
  useEffect(() => {
    if (resultado?.estado !== "aguardando_servidor") { tentativas.current = 0; return; }
    if (fase !== "parado") return;
    const espera = ESPERAS_DA_CONFIRMACAO_MS[tentativas.current];
    if (espera === undefined) return;
    const id = setTimeout(() => {
      tentativas.current += 1;
      void tentarDeNovo().finally(() => setRodada((x) => x + 1));
    }, espera);
    return () => clearTimeout(id);
  }, [resultado, fase, tentarDeNovo, rodada]);

  const restaurar = useCallback(async () => {
    const f = fluxoDoApp();
    if (!f || fase !== "parado") return;
    setFase("restaurando"); setAviso(null);
    try {
      const r = await f.restaurar();
      if (r.estado === "nada") setAviso("Nenhuma compra encontrada nesta conta da Apple.");
      else if (r.estado === "falhou") setAviso("Não foi possível falar com a App Store agora. Tente de novo.");
      else concluir(relevante(r.resultados));
    } finally { setFase("parado"); }
  }, [fase, concluir]);

  const gerenciar = useCallback(() => void ponteApple()?.gerenciar().catch(() => setAviso("Abra Ajustes > seu nome > Assinaturas para gerenciar.")), []);

  return { fase, resultado, aviso, comprar, tentarDeNovo, restaurar, gerenciar, fechar: () => setResultado(null) };
}
