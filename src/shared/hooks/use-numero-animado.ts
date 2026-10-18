import { useEffect, useRef, useState } from "react";

/** Counts from the previous value to the new one (~450 ms, ease-out). */
export function useNumeroAnimado(alvo: number, ms = 450): number {
  const [valor, setValor] = useState(alvo);
  const de = useRef(alvo);
  useEffect(() => {
    const inicio = de.current;
    if (inicio === alvo || typeof requestAnimationFrame === "undefined") { de.current = alvo; setValor(alvo); return; }
    const t0 = performance.now();
    let id = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const v = inicio + (alvo - inicio) * (1 - Math.pow(1 - p, 3));
      setValor(p === 1 ? alvo : v);
      if (p < 1) id = requestAnimationFrame(passo);
      else de.current = alvo;
    };
    id = requestAnimationFrame(passo);
    return () => { cancelAnimationFrame(id); de.current = alvo; };
  }, [alvo, ms]);
  return valor;
}
