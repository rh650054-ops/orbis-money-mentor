/* Vender tab for whoever is not Pro yet (Rick, 25/10/2026, mockup vant-aba-vender):
   a persuasive VANT Pro showcase with motion. Two versions:
   - trial / not subscribed: the 3 plans (Essencial · Pro Anual · Pro Mensal);
   - Essencial subscriber: upgrade only.
   Store build (Play Store / App Store): no prices and no checkout. "link" mode keeps
   the approved Néctar button that opens the site; "fora" mode shows nothing to buy. */
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { COR } from "@/shared/components/vant-ui";
import { assinaPeloSite, podeMostrarAssinatura } from "@/shared/lib/cobranca-loja";
import { abrirAssinarNoSite } from "@/shared/lib/assinar-no-site";
import { useApareceu } from "./use-vitrine-motion";
import { VitrineAoVivo } from "./vitrine-ao-vivo";
import { VitrineAntesDepois, VitrineRecursos } from "./vitrine-recursos";
import { VitrineContas } from "./vitrine-contas";
import { VitrineRanking } from "./vitrine-ranking";
import { VitrinePlanos } from "./vitrine-planos";
import "./vitrine.css";

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  const [ref, visto] = useApareceu<HTMLElement>();
  return (
    <section ref={ref} className={`vv-entra ${visto ? "vv-in" : ""}`}>
      <h2 className="text-[18px] font-black tracking-[-.015em] mb-2.5 mt-1">{titulo}</h2>
      {children}
    </section>
  );
}

export function VitrinePro({ lancado, assinaEssencial, diasDeTeste }: {
  /** what the vendor typed in the last 3 days (real) */
  lancado: number;
  assinaEssencial: boolean;
  /** days left in the free trial, or null when not on trial */
  diasDeTeste: number | null;
}) {
  const vende = podeMostrarAssinatura();
  return (
    <div className="flex flex-col gap-6" style={{ color: COR.texto }}>
      <div>
        {(assinaEssencial || diasDeTeste !== null) && (
          <span className="block w-max mx-auto text-[11px] font-extrabold rounded-full px-3 py-1" style={{ background: "#151412", border: `1px solid ${COR.borda}`, color: COR.suave }}>
            {assinaEssencial ? <>Seu plano: <b style={{ color: COR.texto }}>VANT Essencial</b></>
              : <>Teste grátis · <b style={{ color: "#FFC800" }}>{diasDeTeste === 0 ? "acaba hoje" : diasDeTeste === 1 ? "falta 1 dia" : `faltam ${diasDeTeste} dias`}</b></>}
          </span>
        )}
        <div className="relative text-center pt-5 pb-1">
          <div aria-hidden className="vv-aura pointer-events-none absolute left-1/2 top-1 w-[280px] h-[280px] -ml-[140px] rounded-full" style={{ background: "radial-gradient(circle,rgba(255,200,0,.22),rgba(255,200,0,0) 62%)" }} />
          <div aria-hidden className="relative w-[84px] h-[84px] mx-auto mb-3">
            <span className="vv-ping absolute inset-0 rounded-full" style={{ border: "1.5px solid rgba(255,200,0,.6)" }} />
            <span className="vv-ping vv-ping-2 absolute inset-0 rounded-full" style={{ border: "1.5px solid rgba(255,200,0,.6)" }} />
            <span className="absolute inset-[10px] rounded-full" style={{ background: "radial-gradient(circle at 35% 30%,#FFF4C2,#FFC800 50%,#9a7000)", boxShadow: "0 0 30px rgba(255,200,0,.6)" }} />
            <svg viewBox="0 0 40 40" className="absolute inset-6"><path d="M36 4 4 17l13 6 6 13z" fill="#0B0A08" /><path d="M17 23 36 4" stroke="#FFC800" strokeWidth="2" /></svg>
          </div>
          <p className="relative text-[10px] font-black tracking-[.2em]" style={{ color: "#FFC800" }}>VANT PRO</p>
          <h1 className="relative text-[28px] font-black leading-[1.05] tracking-[-.025em] mt-1.5">
            {assinaEssencial ? <>Você já organiza.<br /><span className="vv-sheen">Agora deixe o banco conferir.</span></> : <>Pare de anotar.<br /><span className="vv-sheen">O banco trabalha pra você.</span></>}
          </h1>
          <p className="relative text-[13px] leading-snug mt-2.5 mx-auto max-w-[300px]" style={{ color: COR.suave }}>
            {assinaEssencial ? "No Essencial você anota tudo. No Pro, a VANT confere o que caiu, mostra o calote e deixa a cobrança pronta."
              : "A VANT confere o que caiu, mostra o calote do dia e deixa a cobrança pronta. Você só vende."}
          </p>
        </div>
        <div className="mt-4"><VitrineAoVivo lancado={lancado} /></div>
      </div>

      <Bloco titulo="O que muda no seu dia"><VitrineAntesDepois /></Bloco>
      <Bloco titulo="Contas em Dia"><VitrineContas /></Bloco>
      <Bloco titulo="Tudo que vem no Pro"><VitrineRecursos /></Bloco>
      <Bloco titulo="Ranking de hoje"><VitrineRanking /></Bloco>

      {vende && <Bloco titulo={assinaEssencial ? "Suba pro Pro" : "Escolha seu plano"}><VitrinePlanos assinaEssencial={assinaEssencial} /></Bloco>}
      {!vende && assinaPeloSite() && (
        <button type="button" onClick={() => void abrirAssinarNoSite()} className="w-full h-[52px] rounded-[16px] inline-flex items-center justify-center gap-2 text-[15px] font-black"
          style={{ color: "#1A1200", background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)" }}>
          <ExternalLink className="w-4 h-4" strokeWidth={2.6} /> Assinar
        </button>
      )}
    </div>
  );
}
