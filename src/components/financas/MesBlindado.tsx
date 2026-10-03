/* ============================================================
   MÊS BLINDADO — topo do card "Contas a pagar" (mock-financas-vicio.png).
   68% · 3 DE 5 CONTAS COBERTAS · R$ 1.260 de R$ 1.850
   "Faltam R$ 590 pra fechar o mês sem dever nada. No ritmo de hoje, dia 19."
   + o recado (blindagem.ts). Só apresentação: os números vêm da Finanças.
   ============================================================ */
import { Pencil, ShieldCheck, Lightbulb } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import type { Recado } from "./blindagem";

const OK = "#3DD68C";
const GOLD = "#F5B800";
const MUTE = "#7e7869";

export interface MesBlindadoProps {
  guardado: number;
  total: number;
  cobertas: number;
  contas: number;
  diaBlindado: string | null; // "dia 19" — no ritmo dele; null = nesse ritmo não fecha
  recado: Recado | null;
  onAjustar: () => void;
}

export function MesBlindado({ guardado, total, cobertas, contas, diaBlindado, recado, onAjustar }: MesBlindadoProps) {
  const falta = Math.max(0, Math.round((total - guardado) * 100) / 100);
  const pct = total > 0 ? Math.min(100, Math.round((guardado / total) * 100)) : 0;
  const blindado = falta <= 0.005;
  return (
    <div className="flex flex-col gap-2 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,.07)" }}>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[.16em]" style={{ color: blindado ? OK : "#9a9488" }}>
          <ShieldCheck className="w-3.5 h-3.5" style={{ color: OK }} strokeWidth={2.4} /> MÊS BLINDADO
        </span>
        <span className="text-[10px] font-black tracking-[.12em]" style={{ color: OK }}>
          {cobertas} DE {contas} {contas === 1 ? "CONTA COBERTA" : "CONTAS COBERTAS"}
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <p className="orbis-num text-[34px] font-black leading-none tracking-tight" style={{ color: OK }}>{pct}%</p>
        <span className="orbis-num text-[12.5px] whitespace-nowrap" style={{ color: MUTE }}>
          <b className="text-[13.5px] text-foreground">{formatCurrency(guardado)}</b> de {formatCurrency(total)}
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.1)" }}>
        <div className="orbis-fill h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#1fa868,#3DD68C)" }} />
      </div>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] leading-relaxed min-w-0" style={{ color: "#a9a49c" }}>
          {blindado
            ? <b style={{ color: OK }}>Todas as contas do mês estão guardadas.</b>
            : <>Faltam <b className="text-foreground">{formatCurrency(falta)}</b> pra fechar o mês sem dever nada.
                {diaBlindado ? <> No ritmo de hoje, <b className="text-foreground">{diaBlindado}</b>.</> : " Guardando todo dia de trabalho, fecha."}</>}
        </p>
        <button type="button" onClick={onAjustar} aria-label="Ajustar total guardado"
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ border: "1px solid rgba(255,255,255,.1)", color: MUTE }}>
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      {recado && !blindado && (
        <div className="flex gap-2.5 items-start rounded-xl px-3 py-2.5 mt-0.5"
          style={recado.tom === "ok"
            ? { background: "rgba(61,214,140,.07)", border: "1px solid rgba(61,214,140,.25)" }
            : { background: "rgba(245,184,0,.07)", border: "1px solid rgba(245,184,0,.28)" }}>
          <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" style={{ color: recado.tom === "ok" ? OK : GOLD }} strokeWidth={2.4} />
          <p className="text-[12px] leading-relaxed" style={{ color: "#b9b3a6" }}>
            <b className="text-foreground">{recado.titulo}</b> {recado.texto}
          </p>
        </div>
      )}
    </div>
  );
}

const CORES = {
  red: { bg: "rgba(255,92,92,.12)", bd: "rgba(255,92,92,.45)", fg: "#ff8a8a" },
  ok: { bg: "rgba(61,214,140,.12)", bd: "rgba(61,214,140,.45)", fg: OK },
  ouro: { bg: "rgba(245,184,0,.12)", bd: "rgba(245,184,0,.45)", fg: GOLD },
  mute: { bg: "rgba(255,255,255,.05)", bd: "rgba(255,255,255,.14)", fg: MUTE },
} as const;

/** O selo ao lado do nome da conta: VENCEU ONTEM, BLINDADA, VENCE HOJE… */
export function SeloConta({ texto, cor }: { texto: string; cor: keyof typeof CORES }) {
  const c = CORES[cor];
  return (
    <span className="inline-flex items-center shrink-0 rounded-full px-1.5 py-[2px] text-[9px] font-black tracking-[.06em] whitespace-nowrap"
      style={{ background: c.bg, border: `1px solid ${c.bd}`, color: c.fg }}>
      {texto}
    </span>
  );
}
