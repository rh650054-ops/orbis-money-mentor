/* Foco / Vender: "Sua renovação de R$ 29,90 vence dia X · Copiar Pix" while the Pix is open. */
import { useAuth } from "@/hooks/useAuth";
import { useRenovacaoPixQuery, useRenovacaoVencidaQuery } from "../api/use-renovacao-pix";
import { PixVencido } from "./gerar-novo-pix";
import { BotaoCopiarPix } from "./renovar-pix";
import { reais, venceTexto } from "../lib/pix";

const GOLD = "#F5B800";

export function AvisoRenovacaoPix({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const q = useRenovacaoPixQuery(user?.id);
  const pix = q.data;
  // sem Pix aberto: o Pix venceu e a Hotmart ainda não mandou outro → "Gerar novo Pix"
  const vencida = useRenovacaoVencidaQuery(user?.id, q.isSuccess && !pix).data;
  if (!pix) return vencida ? <div className={className}><PixVencido vencida={vencida} compacto /></div> : null;
  const cor = pix.atrasada ? "#ff7d6b" : GOLD;
  return (
    <section className={`rounded-[18px] px-4 py-3.5 ${className}`} aria-label="Renovação" style={{ border: `1px solid ${cor}66`, background: "linear-gradient(170deg,#1a1305,#0e0e0f 70%)" }}>
      <p className="text-[10.5px] font-black tracking-[.14em]" style={{ color: cor }}>{pix.atrasada ? "RENOVAÇÃO ATRASADA" : "RENOVAÇÃO"}</p>
      <p className="text-[14.5px] font-extrabold mt-0.5 leading-snug">
        Sua renovação de {reais(pix.valor)} {venceTexto(pix.vence_em)}
      </p>
      <p className="text-[12px] mt-0.5" style={{ color: "#b9b3a6" }}>Paga pelo Pix e segue sem travar. Não precisa procurar o e-mail da Hotmart.</p>
      <div className="mt-2.5">
        <BotaoCopiarPix pix={pix} rotulo="Copiar Pix" className="h-11 px-5 rounded-[12px] inline-flex items-center gap-2 text-[13.5px] font-black" style={{ background: GOLD, color: "#1A1200" }} />
      </div>
    </section>
  );
}
