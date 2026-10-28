/* BOAS-VINDAS DO APP (Rick, 28/10/2026): "o usuário vai entrar sempre no primeiro acesso do
   aplicativo, independente se ele tem conta ou não". Full-screen tour over everything, once per
   install, before login. The slides are the store screenshots Rick approved (same look). */
import { useState } from "react";
import { ArrowRight } from "lucide-react";

const SLIDES = [
  { img: "/boas-vindas/1.webp", alt: "Seu corre inteiro num lugar só: vendas, custos e lucro do dia" },
  { img: "/boas-vindas/2.webp", alt: "Diga a meta e a IA monta o plano dia a dia, com estoque e previsão do tempo" },
  { img: "/boas-vindas/3.webp", alt: "Venda em segundos com foco total na rua: meta por hora e venda com um toque" },
  { img: "/boas-vindas/4.webp", alt: "Lucro de verdade, depois dos custos" },
] as const;

const TOTAL = SLIDES.length + 1; // + the welcome screen

export function BoasVindas({ onFim }: { onFim: () => void }) {
  const [i, setI] = useState(0);
  const ultimo = i === TOTAL - 1;
  const avancar = () => (ultimo ? onFim() : setI(i + 1));
  const slide = i > 0 ? SLIDES[i - 1] : null;

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white flex flex-col" role="dialog" aria-modal="true" aria-label="Boas-vindas à VANT"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex justify-end px-4 pt-3 h-12">
        {!ultimo && (
          <button type="button" onClick={onFim} className="text-[13px] font-bold px-3 py-1.5 rounded-full" style={{ color: "rgba(255,255,255,.6)" }}>
            Pular
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 relative overflow-hidden" onClick={avancar}>
        {slide ? (
          <img key={slide.img} src={slide.img} alt={slide.alt} className="absolute inset-0 w-full h-full object-cover object-top vant-sobe" />
        ) : (
          <Abertura />
        )}
      </div>

      <div className="px-5 pt-3 pb-5">
        <div className="flex justify-center gap-1.5 mb-4" aria-hidden>
          {Array.from({ length: TOTAL }, (_, k) => (
            <span key={k} className="h-1.5 rounded-full transition-all duration-300"
              style={{ width: k === i ? 22 : 6, background: k === i ? "#F5B800" : "rgba(255,255,255,.22)" }} />
          ))}
        </div>
        <button type="button" onClick={avancar}
          className="w-full h-14 rounded-[16px] font-extrabold text-[16px] flex items-center justify-center gap-2"
          style={{ background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1a1408", boxShadow: "0 14px 30px -12px rgba(245,184,0,.8)" }}>
          {i === 0 ? "Conhecer a VANT" : ultimo ? "Começar" : "Próximo"} <ArrowRight className="w-5 h-5" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}

function Abertura() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8"
      style={{ background: "radial-gradient(70% 45% at 50% 40%, rgba(245,184,0,.22), transparent 70%)" }}>
      <img src="/boas-vindas/icone.png" alt="" className="w-24 h-24 rounded-[26px] vant-sobe" style={{ boxShadow: "0 0 60px rgba(245,184,0,.45)" }} />
      <p className="mt-7 text-[13px] font-extrabold tracking-[.42em]" style={{ color: "#F5B800" }}>VANT</p>
      <h1 className="mt-3 text-[30px] font-light leading-[1.1] tracking-[-.03em]">
        Bem-vindo ao seu <span style={{ color: "#F5B800" }}>corre no controle.</span>
      </h1>
      <p className="mt-4 text-[14px] leading-snug" style={{ color: "rgba(255,255,255,.65)" }}>
        Vendas, lucro e metas com IA pra quem vende na rua. Vou te mostrar em 30 segundos.
      </p>
    </div>
  );
}
