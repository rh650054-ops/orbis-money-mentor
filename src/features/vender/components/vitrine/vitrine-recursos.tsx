/* "What changes in your day" (before × after) and "Everything in Pro" with the
   benefit names agreed with Rick on 24/10/2026. */
import { COR } from "@/shared/components/vant-ui";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";
import { RECURSOS_PRO } from "./vitrine-dados";

const HOJE = ["Anota cada venda", "Confere o Pix de cabeça", "Descobre o calote no fim do mês", "Cobra no improviso"];
const COM_PRO = ["O Pix cai e a VANT conta", "Maquininha conferida", "Calote na tela no mesmo dia", "Cobrança pronta em um toque"];

export function VitrineAntesDepois() {
  const col = (titulo: string, itens: string[], novo: boolean) => (
    <div className="rounded-[16px] p-3" style={novo
      ? { border: "1px solid rgba(255,200,0,.5)", background: "linear-gradient(170deg,rgba(255,200,0,.10),#0f0f10 70%)" }
      : { border: `1px solid ${COR.borda}`, background: COR.card }}>
      <p className="text-[11px] font-black tracking-[.12em] mb-2" style={{ color: novo ? "#FFC800" : COR.apagado }}>{titulo}</p>
      {itens.map((t) => (
        <p key={t} className={`relative pl-4 py-1 text-[12px] leading-snug ${novo ? "" : "line-through decoration-[rgba(255,107,90,.5)]"}`} style={{ color: COR.suave }}>
          <span className="absolute left-0 font-black no-underline" style={{ color: novo ? COR.ok : COR.coral }}>{novo ? "✓" : "×"}</span>{t}
        </p>
      ))}
    </div>
  );
  return <div className="grid grid-cols-2 gap-2">{col("HOJE", HOJE, false)}{col("COM O PRO", COM_PRO, true)}</div>;
}

export function VitrineRecursos() {
  return (
    <div className="rounded-[18px] overflow-hidden" style={{ background: COR.card, border: `1px solid ${COR.borda}` }}>
      {RECURSOS_PRO.map((r, i) => (
        <div key={r.nome} className="grid grid-cols-[36px_1fr] gap-3 px-3.5 py-3 items-start" style={{ borderTop: i ? `1px solid ${COR.borda}` : undefined }}>
          <span className="w-9 h-9 rounded-[11px] grid place-items-center text-[16px]" style={{ background: "rgba(245,184,0,.12)", border: "1px solid rgba(245,184,0,.4)" }}>{r.ic}</span>
          <span><b className="block text-[14px] font-black">{r.nome}</b><span className="block text-[12px] mt-0.5 leading-snug" style={{ color: COR.suave }}>{r.linha}</span></span>
        </div>
      ))}
      <div className="grid grid-cols-[36px_1fr] gap-3 px-3.5 py-3 items-start" style={{ borderTop: `1px solid ${COR.borda}` }}>
        <span className="w-9 h-9 rounded-[11px] grid place-items-center" style={{ background: "rgba(0,149,246,.16)", border: "1px solid rgba(79,179,255,.55)", boxShadow: "0 0 14px rgba(0,149,246,.35)" }}><SeloVerificado size={18} /></span>
        <span><b className="block text-[14px] font-black" style={{ color: "#cfe8ff" }}>Verificado da VANT + X1</b><span className="block text-[12px] mt-0.5 leading-snug" style={{ color: COR.suave }}>Seu número com prova do banco. E desafie outros vendedores.</span></span>
      </div>
    </div>
  );
}
