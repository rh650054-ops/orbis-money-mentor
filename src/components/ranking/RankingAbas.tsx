/* Mensal | Semanal lado a lado (Rick, 29/10/2026 — premiações de novembro) + o prêmio da aba. */
import { Gift } from "lucide-react";
import { premioDaAba, type Aba } from "./premiacao";

const OURO = "#F5B800";
const brl0 = (n: number) => "R$ " + n.toLocaleString("pt-BR");

export function RankingAbas({ aba, onAba, hoje, periodoSemana }: { aba: Aba; onAba: (a: Aba) => void; hoje: string; periodoSemana: string }) {
  const premio = premioDaAba(aba, hoje);
  const botao = (a: Aba, rotulo: string) => {
    const on = aba === a;
    return (
      <button type="button" role="tab" aria-selected={on} onClick={() => onAba(a)}
        className="flex-1 h-10 rounded-[12px] text-[13.5px] font-black transition-colors"
        style={on ? { background: OURO, color: "#1a1305" } : { color: "#b9b3a6" }}>
        {rotulo}
      </button>
    );
  };
  return (
    <div className="space-y-2.5">
      <div role="tablist" aria-label="Período do ranking" className="flex gap-1 p-1 rounded-[15px]" style={{ background: "#121211", border: "1px solid rgba(255,255,255,.08)" }}>
        {botao("mensal", "Mensal")}
        {botao("semanal", "Semanal")}
      </div>
      {aba === "semanal" && <p className="text-center text-[12px] font-bold" style={{ color: "#b9b3a6" }}>{periodoSemana} · fecha sábado 23:59</p>}
      {premio && (
        <div className="rounded-[16px] px-4 py-3 flex items-center gap-3" style={{ background: "linear-gradient(170deg,rgba(245,184,0,.14),#131211 70%)", border: "1px solid rgba(245,184,0,.4)" }}>
          <span className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.16)" }}><Gift className="w-5 h-5" style={{ color: OURO }} /></span>
          <p className="text-[12.5px] leading-snug" style={{ color: "#e9e4d8" }}>
            <span className="text-[10px] font-black tracking-[.14em] block" style={{ color: OURO }}>DESAFIO AVANTE</span>
            <b className="text-[16px]" style={{ color: OURO }}>{brl0(premio.valor)}</b> {premio.texto}
            {premio.antes && <span className="block text-[11px]" style={{ color: "#b9b3a6" }}>Valendo a partir de 1º de novembro</span>}
          </p>
        </div>
      )}
    </div>
  );
}
