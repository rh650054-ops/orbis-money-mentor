/* Small motion helpers for the Pro showcase: count-up numbers and "entered the screen". */
import { useEffect, useRef, useState } from "react";

export const semMovimento = (): boolean => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return true; }
};

/** Counts from 0 to `alvo` (ease-out) once `ativo` turns true. Jumps straight there without motion. */
export function useContador(alvo: number, ativo: boolean, ms = 1300): number {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (!ativo) { setValor(0); return; }
    if (semMovimento() || typeof requestAnimationFrame === "undefined") { setValor(alvo); return; }
    let quadro = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setValor(alvo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, ativo, ms]);
  return valor;
}

/** True once the element has been at least 25% on screen (stays true). */
export function useApareceu<T extends Element>(): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visto) return;
    if (typeof IntersectionObserver === "undefined") { setVisto(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setVisto(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [visto]);
  return [ref, visto];
}

/** Re-runs `fn` every `ms` while `ativo` (skipped without motion). */
export function useIntervalo(fn: () => void, ms: number, ativo: boolean): void {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  useEffect(() => {
    if (!ativo || semMovimento()) return;
    const id = setInterval(() => ref.current(), ms);
    return () => clearInterval(id);
  }, [ms, ativo]);
}

export const reaisInteiros = (v: number): string => "R$ " + Math.round(v).toLocaleString("pt-BR");
