/* 4 · OPINIÃO DA VANT — card claro (off-white), em forma de FALA: avatar da
   VANT com a setinha amarela e o balão. Quebra a sequência de cards escuros.
   Uma frase por linha; toque troca a leitura. O "não sou Deus" fica fixo,
   menor e cinza. */
import { useState } from "react";
import { haptic } from "./comum";

const TINTA = "#141210";
const CINZA = "#6f6a60";

function Avatar() {
  return (
    <span className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center shadow-[0_6px_16px_-6px_rgba(0,0,0,.6)]" style={{ background: "#0d0d0f" }} aria-hidden>
      <svg viewBox="0 0 24 24" width="20" height="20"><path d="M3 12.5 L21 4 L14.5 20.5 L12.2 14.2 Z" fill="#F5B800" /><path d="M12.2 14.2 L21 4" stroke="#0d0d0f" strokeWidth="1.2" /></svg>
    </span>
  );
}

export function OpiniaoVant({ falas, fontes, pensando }: { falas: string[]; fontes: number; pensando: boolean }) {
  const [i, setI] = useState(0);
  const n = falas.length;
  const fala = n > 0 ? falas[i % n]! : null;
  const linhas = fala ? fala.split(/(?<=[.!?])\s+/).filter(Boolean) : [];
  return (
    <section aria-label="Opinião da VANT" className="flex gap-2.5 items-start">
      <Avatar />
      <button type="button" disabled={n < 2} onClick={() => { haptic(); setI((x) => x + 1); }}
        className="relative flex-1 min-w-0 text-left rounded-[20px] rounded-tl-[6px] px-4 pt-3.5 pb-3.5 transition-transform duration-[120ms] enabled:active:scale-[0.99]"
        style={{ background: "linear-gradient(170deg, #FBF8F1 0%, #F1EDE3 100%)", boxShadow: "0 18px 40px -24px rgba(0,0,0,.9)" }}>
        <span className="absolute -left-[7px] top-3 w-0 h-0" style={{ borderTop: "7px solid transparent", borderBottom: "7px solid transparent", borderRight: "8px solid #FBF8F1" }} aria-hidden />
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[12px] font-black uppercase tracking-[.14em]" style={{ color: TINTA }}>Opinião da VANT</span>
          {n > 1 && <span className="text-[11.5px] font-bold tabular-nums" style={{ color: CINZA }}>{(i % n) + 1}/{n}</span>}
        </span>
        <span key={i} className="mt-2 flex flex-col gap-0.5 animate-in fade-in duration-200">
          {fala ? linhas.map((l, k) => (
            <span key={k} className="block text-[18px] leading-snug" style={{ color: TINTA, fontWeight: k === 0 ? 800 : 600 }}>{l}</span>
          )) : <span className="block text-[15px]" style={{ color: CINZA }}>{pensando ? "Lendo os modelos e as suas contas…" : "Toca em atualizar pra eu dar minha opinião."}</span>}
        </span>
        {n > 1 && <span className="block mt-2 text-[12px] font-semibold" style={{ color: CINZA }}>toque para ver outras leituras</span>}
        <span className="block mt-2.5 pt-2.5 border-t text-[12px] leading-snug" style={{ borderColor: "rgba(20,18,16,.1)", color: CINZA }}>
          Antes de tudo: não sou Deus, né kkk — clima muda. Mas juntei {fontes || 6} modelos e é nisso que eu aposto.
        </span>
      </button>
    </section>
  );
}
