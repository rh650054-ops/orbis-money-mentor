import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ponteApple } from "../lib/ponte";
import type { ResultadoCompra } from "../types";
import { fluxoDoApp } from "./fluxo-do-app";

export type Fase = "parado" | "comprando" | "restaurando" | "verificando";
/** Heard by the rest of the app (legacy hooks) when a purchase released the access. */
export const EVENTO_APPLE_LIBEROU = "vant:assinatura-apple-liberou";

const relevante = (rs: ResultadoCompra[]): ResultadoCompra | null =>
  rs.find((r) => r.estado === "liberada") ?? rs.find((r) => r.estado === "aguardando_servidor") ?? rs.find((r) => r.estado === "de_outra_conta") ?? null;

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
