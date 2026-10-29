/* Mensal | Semanal lado a lado (Rick, 29/10/2026 — premiações de novembro) + o prêmio da aba,
   no mesmo visual do pódio: card escuro com o dourado oficial, brilho que passa, número grande
   e a contagem pro fechamento. "Mais premium e melhor de ser visto" (Rick, 29/10 18:44). */
import { Trophy, Zap } from "lucide-react";
import { premioDaAba, PREMIO_FIM, type Aba } from "./premiacao";

const OURO = "#F5B800";
const OURO_CLARO = "#F5D77A";
const brl0 = (n: number) => "R$ " + n.toLocaleString("pt-BR");

/** "fecha em 23 dias" / "fecha sábado" — dias até o fim do período (hoje incluso não conta). */
function fechaEm(aba: Aba, hoje: string, fimSemana: string): string {
  const fim = aba === "mensal" ? PREMIO_FIM : fimSemana;
  const dias = Math.round((Date.parse(fim + "T12:00:00Z") - Date.parse(hoje + "T12:00:00Z")) / 86400000);
  if (dias <= 0) return "fecha hoje";
  if (dias === 1) return "fecha amanhã";
  return `fecha em ${dias} dias`;
}

export function RankingAbas({ aba, onAba, hoje, periodoSemana, fimSemana, posicao, faltaPro1 }: {
  aba: Aba; onAba: (a: Aba) => void; hoje: string; periodoSemana: string; fimSemana: string;
  /** the viewer's place and how much to the 1st — the hook that sends him back to the street */
  posicao?: number | null; faltaPro1?: number | null;
}) {
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
        <section aria-label="Prêmio do Desafio Avante" className="relative overflow-hidden rounded-2xl border px-4 pt-3 pb-3.5"
          style={{ borderColor: "#3a2c0a", background: "radial-gradient(120% 70% at 50% 0%, rgba(245,181,68,0.22) 0%, #120d04 62%)", boxShadow: "0 0 0 1px rgba(245,184,0,.18), 0 14px 40px -18px rgba(245,184,0,.6)" }}>
          <span className="absolute inset-0 pointer-events-none orbis-shimmer" />
          <p className="text-center tracking-[0.3em] text-[11px]" style={{ color: OURO_CLARO }}>DESAFIO AVANTE</p>
          <div className="relative mt-2 flex items-center gap-3">
            <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.12)", boxShadow: `0 0 18px rgba(245,184,0,.35)` }}>
              {aba === "mensal" ? <Trophy className="w-6 h-6" style={{ color: OURO }} /> : <Zap className="w-6 h-6" style={{ color: OURO }} fill={OURO} strokeWidth={0} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="orbis-num font-black leading-none" style={{ fontSize: 34, color: OURO, textShadow: "0 0 18px rgba(245,184,0,.45)" }}>{brl0(premio.valor)}</p>
              <p className="text-[13px] font-bold mt-1 text-white">{premio.texto}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] tracking-[.14em] font-bold" style={{ color: "#b9b3a6" }}>{premio.antes ? "COMEÇA" : "FECHA"}</p>
              <p className="text-[12.5px] font-black text-white">{premio.antes ? "1º de nov" : fechaEm(aba, hoje, fimSemana).replace("fecha ", "")}</p>
            </div>
          </div>
          {!premio.antes && typeof posicao === "number" && posicao > 0 && (
            <p className="relative mt-3 pt-2.5 text-[12px] text-center border-t" style={{ borderColor: "rgba(245,184,0,.18)", color: "#b9b3a6" }}>
              {posicao === 1
                ? <>Você está em <b className="text-white">1º</b>. Segura até o fim e o prêmio é seu.</>
                : <>Você está em <b className="text-white">{posicao}º</b>{faltaPro1 && faltaPro1 > 0 ? <> · faltam <b style={{ color: OURO }}>{brl0(Math.round(faltaPro1))}</b> pro 1º</> : null}</>}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
