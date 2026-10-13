import { useEffect, useMemo, useState } from "react";
import { passoDigitacao, unidadesDigitacao } from "@/shared/lib/digitando";

const INTERVALO_MS = 40;

function semMovimento(): boolean {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/**
 * Revela `texto` aos poucos quando `ativo`. Devolve o pedaço visível e se ainda está
 * digitando. `pular()` mostra tudo de uma vez (toque na bolha).
 */
export function useDigitando(texto: string, ativo: boolean, aoAvancar?: () => void) {
  const unidades = useMemo(() => unidadesDigitacao(texto), [texto]);
  const animar = ativo && !semMovimento();
  const [n, setN] = useState(animar ? 0 : unidades.length);

  useEffect(() => {
    if (!animar) { setN(unidades.length); return; }
    const passo = passoDigitacao(unidades.length, INTERVALO_MS);
    const t = window.setInterval(() => {
      setN((v) => {
        const prox = Math.min(unidades.length, v + passo);
        if (prox >= unidades.length) window.clearInterval(t);
        return prox;
      });
    }, INTERVALO_MS);
    return () => window.clearInterval(t);
  }, [animar, unidades]);

  useEffect(() => { aoAvancar?.(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    visivel: n >= unidades.length ? texto : unidades.slice(0, n).join(""),
    digitando: n < unidades.length,
    pular: () => setN(unidades.length),
  };
}
