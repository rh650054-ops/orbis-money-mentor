/* Renewal Pix expired and Hotmart has not sent a new one: "Gerar novo Pix" opens the
   Hotmart customer area in the browser, where the subscriber generates it on the spot
   (Rick, 23/10/2026 — case Aleff). Used in Foco/Vender and on the block screen. */
import { ExternalLink } from "lucide-react";
import { abrirLinkExterno } from "@/shared/lib/link-externo";
import type { RenovacaoVencida } from "../api/use-renovacao-pix";
import { HOTMART_AREA_CLIENTE, reais, venceuTexto } from "../lib/pix";

const CORAL = "#ff7d6b";
const GOLD = "#F5B800";

export function BotaoGerarNovoPix({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={() => void abrirLinkExterno(HOTMART_AREA_CLIENTE)}
      className={className ?? "w-full h-[54px] rounded-[16px] inline-flex items-center justify-center gap-2 text-[15px] font-black active:translate-y-[1px]"}
      style={style ?? { background: GOLD, color: "#1A1200" }}>
      <ExternalLink className="w-4 h-4" strokeWidth={2.6} /> Gerar novo Pix
    </button>
  );
}

export function PixVencido({ vencida, compacto = false }: { vencida: RenovacaoVencida; compacto?: boolean }) {
  return (
    <section aria-label="Renovação" className={`rounded-[18px] text-left ${compacto ? "px-4 py-3.5" : "p-4"}`}
      style={{ border: `1px solid ${CORAL}66`, background: "linear-gradient(170deg,#1a0d0a,#0e0e0f 70%)" }}>
      <p className="text-[10.5px] font-black tracking-[.14em]" style={{ color: CORAL }}>RENOVAÇÃO ATRASADA</p>
      <p className={`${compacto ? "text-[14.5px]" : "text-[17px]"} font-extrabold mt-0.5 leading-snug`}>
        O Pix da sua renovação de {reais(vencida.valor)} {venceuTexto(vencida.venceu_em)}
      </p>
      <p className="text-[12px] mt-0.5" style={{ color: "#b9b3a6" }}>
        Gere um Pix novo na Hotmart: entra com o e-mail da compra, toca na assinatura e escolhe Pix. Pagou, o acesso continua.
      </p>
      <div className="mt-2.5">
        <BotaoGerarNovoPix className={compacto ? "h-11 px-5 rounded-[12px] inline-flex items-center gap-2 text-[13.5px] font-black" : undefined} />
      </div>
    </section>
  );
}
