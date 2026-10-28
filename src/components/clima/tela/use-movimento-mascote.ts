/* Movimento do mascote na cena — em JavaScript de propósito (herdado da cena
   do Orbis, 11/09): no modo economia de bateria o navegador congela animação
   de CSS e o boneco virava estátua. Desenhado quadro a quadro continua vivo.
   Fora: respira + pulo no toque. Dentro: reage ao clima (treme no frio, se
   abana no calor, se encolhe na tempestade). */
import { useEffect, useRef } from "react";
import type { Estado } from "@/components/clima/ClimaTipos";

export function useMovimentoMascote(estado: Estado, toques: number) {
  const refFora = useRef<HTMLDivElement>(null);
  const refDentro = useRef<HTMLDivElement>(null);
  const refPulo = useRef(-99);
  const acao = estado === "frio" ? "frio" : estado === "tempestade" ? "tempestade" : estado === "calor" ? "calor" : "";

  useEffect(() => { if (toques > 0) refPulo.current = performance.now(); }, [toques]);

  useEffect(() => {
    const fora = refFora.current, dentro = refDentro.current;
    if (!fora) return;
    const calmo = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const amp = calmo ? 1.6 : 4;
    const t0 = performance.now();
    let raf = 0, vivo = true;
    const passo = (t: number) => {
      if (!vivo) return;
      const s = (t - t0) / 1000;
      const onda = Math.sin((s / 5.2) * Math.PI * 2);
      let y = onda * -amp;
      let escala = 1 + onda * 0.006;
      const giro = Math.sin((s / 7.4) * Math.PI * 2) * (calmo ? 0.12 : 0.35);
      const dt = (t - refPulo.current) / 1000;
      if (dt >= 0 && dt < 0.95) {
        const k = Math.sin(Math.PI * (dt / 0.95));
        y -= k * (calmo ? 8 : 26);
        escala += k * 0.018;
      }
      fora.style.transform = `translate3d(0,${y.toFixed(2)}px,0) rotate(${giro.toFixed(3)}deg) scale(${escala.toFixed(4)})`;
      if (dentro) {
        if (acao === "frio") dentro.style.transform = `translate3d(${(Math.sin(s * 34) * (calmo ? 0.5 : 1.5)).toFixed(2)}px,0,0) rotate(${(Math.sin(s * 31) * (calmo ? 0.12 : 0.38)).toFixed(3)}deg)`;
        else if (acao === "calor") dentro.style.transform = `translate3d(0,${(Math.sin((s / 2.2) * Math.PI * 2) * -2).toFixed(2)}px,0) rotate(${(Math.sin((s / 2.2) * Math.PI * 2) * 1.3).toFixed(3)}deg)`;
        else if (acao === "tempestade") dentro.style.transform = `translate3d(0,${(2.5 + Math.sin((s / 2.4) * Math.PI * 2) * 2.5).toFixed(2)}px,0) scale(.99) rotate(${(Math.sin((s / 2.4) * Math.PI * 2) * -0.5).toFixed(3)}deg)`;
        else dentro.style.transform = "";
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => { vivo = false; cancelAnimationFrame(raf); };
  }, [acao]);

  return { refFora, refDentro };
}
