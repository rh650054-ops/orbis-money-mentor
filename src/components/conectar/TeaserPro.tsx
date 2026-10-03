/* ============================================================
   TEASER DO VANT PRO — "como seria se você tivesse ligado o banco".
   Rick, 03/10/2026: no teste de 3 dias o vendedor não liga o banco, mas em
   alguns momentos a Vant mostra o que ele teria com o Pro. É um cartão com
   um número de exemplo borrado + uma frase + VER O VANT PRO (→ /pro).
   Aparece só pra quem NÃO tem banco ligado; com banco, nunca.
   ============================================================ */
import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";

const GOLD = "#F5B800";
const OK = "#3DD68C";
const MUTE = "#7b766e";

export type MomentoTeaser = "relatorio" | "ranking" | "financas";

const TEXTOS: Record<MomentoTeaser, { rotulo: string; exemplo: string; sub: string; frase: string }> = {
  relatorio: { rotulo: "COM O BANCO LIGADO", exemplo: "R$ 610", sub: "24 Pix · pelo banco", frase: "O Pix de hoje entraria no ranking sozinho, com selo, até 23:59. Sem digitar nada." },
  ranking: { rotulo: "SEU NÚMERO COM SELO", exemplo: "R$ 14.300", sub: "conferido pelo banco", frase: "Com o banco ligado, seu número ganha o selo e ninguém duvida dele." },
  financas: { rotulo: "QUANTO VOCÊ TEM AGORA", exemplo: "R$ 1.284", sub: "9 dias de fôlego", frase: "Saldo, cartão, dívidas e guardado, tudo lido do banco. Sem anotar." },
};

export function TeaserPro({ momento, className = "" }: { momento: MomentoTeaser; className?: string }) {
  const navigate = useNavigate();
  const t = TEXTOS[momento];
  return (
    <div className={`rounded-[20px] border overflow-hidden ${className}`} style={{ background: "linear-gradient(170deg,#1a1305,#0e0e10 70%)", borderColor: "rgba(245,184,0,.42)" }}>
      <div className="relative px-4 pt-3.5 pb-2 text-center">
        <p className="text-[10px] font-black tracking-[.15em]" style={{ color: GOLD }}>{t.rotulo}</p>
        <div aria-hidden className="select-none" style={{ filter: "blur(4px)", opacity: .55 }}>
          <p className="text-[32px] font-black tabular-nums leading-none mt-1" style={{ color: OK }}>{t.exemplo}</p>
          <p className="text-[11px] font-bold mt-1" style={{ color: MUTE }}>{t.sub}</p>
        </div>
        <span className="absolute inset-x-0 bottom-2 flex justify-center"><Lock className="w-5 h-5" style={{ color: GOLD }} strokeWidth={2.4} /></span>
      </div>
      <div className="px-4 pb-3.5 space-y-2.5">
        <p className="text-[12px] leading-snug text-center" style={{ color: "#e9e4d8" }}>
          <SeloVerificado size={14} className="inline -mt-0.5 mr-1" />{t.frase}
        </p>
        <button type="button" onClick={() => navigate("/pro")}
          className="w-full h-[44px] rounded-[13px] inline-flex items-center justify-center text-[13px] font-black active:translate-y-[1px] transition-transform"
          style={{ background: "linear-gradient(180deg,#FFF1B3 0%,#FFC800 55%,#D9A800 100%)", color: "#1A1200", boxShadow: "0 10px 24px -12px rgba(255,200,0,.8)" }}>
          VER O VANT PRO
        </button>
        <p className="text-[10.5px] font-bold text-center" style={{ color: MUTE }}>Exemplo. Os seus números aparecem quando o banco estiver ligado.</p>
      </div>
    </div>
  );
}
