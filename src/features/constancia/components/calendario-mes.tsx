/* One month of the flame, like Duolingo's "Ofensiva": worked days in gold, a run of worked days
   joined by a band, missed work days with a faint ×, days off as a moon, today outlined. */
import { ChevronLeft, ChevronRight, Moon } from "lucide-react";
import type { DiaCalendario } from "../types";

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const OURO = "#F5B800";

export function CalendarioMes({ mes, dias, onMes }: { mes: string; dias: DiaCalendario[]; onMes: (iso: string) => void }) {
  const [y, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, 1));
  const nDias = new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate();
  const vazio = primeiro.getUTCDay();
  const porDia = new Map(dias.map((d) => [d.d, d.s]));
  const iso = (dd: number) => `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const mudar = (delta: number) => {
    const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + delta, 1));
    onMes(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
  };
  const trabalhados = dias.filter((d) => d.s === "trabalhou").length;
  return (
    <section aria-label={`Calendário de ${MESES[(m ?? 1) - 1]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[16px] font-black text-foreground">{MESES[(m ?? 1) - 1]} de {y}</p>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => mudar(-1)} aria-label="Mês anterior" className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95" style={{ border: "1px solid rgba(255,255,255,.09)" }}><ChevronLeft className="w-4 h-4" /></button>
          <button type="button" onClick={() => mudar(1)} aria-label="Próximo mês" className="w-10 h-10 rounded-xl flex items-center justify-center active:scale-95" style={{ border: "1px solid rgba(255,255,255,.09)" }}><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>
      <p className="orbis-mini mt-1" style={{ color: "#7e7869" }}>{trabalhados} dias de trabalho na rua</p>
      <div className="mt-3 rounded-[18px] p-3" style={{ border: "1px solid rgba(255,255,255,.07)", background: "rgba(255,255,255,.038)" }}>
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {SEMANA.map((s) => <span key={s} className="text-[11px] font-bold" style={{ color: "#7e7869" }}>{s}</span>)}
          {Array.from({ length: vazio }, (_, i) => <span key={`v${i}`} />)}
          {Array.from({ length: nDias }, (_, i) => {
            const dd = i + 1; const s = porDia.get(iso(dd)) ?? "futuro";
            const ant = dd > 1 && porDia.get(iso(dd - 1)) === "trabalhou" && s === "trabalhou";
            const prox = dd < nDias && porDia.get(iso(dd + 1)) === "trabalhou" && s === "trabalhou";
            const banda = s === "trabalhou" && (ant || prox) ? `linear-gradient(90deg, ${ant ? "rgba(245,184,0,.18)" : "transparent"} 50%, ${prox ? "rgba(245,184,0,.18)" : "transparent"} 50%)` : undefined;
            return (
              <span key={dd} className="relative flex items-center justify-center h-9" style={{ background: banda }}>
                {s === "trabalhou" ? (
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-black" style={{ background: `linear-gradient(180deg,#ffc63a,${OURO})`, color: "#1A1200" }}>{dd}</span>
                ) : s === "hoje" ? (
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-black box-border" style={{ border: `1.6px solid ${OURO}`, color: OURO }}>{dd}</span>
                ) : s === "folga" ? (
                  <span className="w-8 h-8 rounded-full flex flex-col items-center justify-center" title="folga"><Moon className="w-3 h-3" style={{ color: "#5F5A50" }} /><span className="text-[9px] font-bold leading-none mt-0.5" style={{ color: "#5F5A50" }}>{dd}</span></span>
                ) : s === "faltou" ? (
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold box-border" style={{ border: "1.4px solid rgba(229,115,127,.45)", color: "#8a5a60" }}>{dd}</span>
                ) : (
                  <span className="text-[13px] font-bold" style={{ color: "#5F5A50" }}>{dd}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
