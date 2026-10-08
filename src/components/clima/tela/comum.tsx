/* Peças comuns da tela de Clima: reaproveita a linguagem do Financeiro (planejar/ui). */
export { COR, Cartao, CheckAnimado, Folha, LinhaValor, Rotulo, haptic } from "@/components/financas/planejar/ui";
import { COR } from "@/components/financas/planejar/ui";
import { CONF_TXT, COR_NIVEL, type Nivel } from "../decisao";
import type { Confianca } from "@/hooks/useClima";

export function Titulo({ children, direita }: { children: React.ReactNode; direita?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
      <h2 className="text-[16px] font-black uppercase tracking-[.08em]" style={{ color: COR.texto }}>{children}</h2>
      {direita}
    </div>
  );
}

export function ChipConf({ conf }: { conf: Confianca }) {
  const cor = conf === "alta" ? COR_NIVEL.bom : conf === "media" ? COR_NIVEL.atencao : COR_NIVEL.risco;
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[12px] font-bold whitespace-nowrap" style={{ background: `${cor}1a`, color: cor }}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[0, 1, 2].map((i) => <i key={i} className="w-[3px] rounded-sm" style={{ height: 4 + i * 3, background: i <= ["baixa", "media", "alta"].indexOf(conf) ? cor : `${cor}40` }} />)}
      </span>
      {CONF_TXT[conf].curto}
    </span>
  );
}

export const Ponto = ({ nivel, tamanho = 8 }: { nivel: Nivel; tamanho?: number }) => (
  <i className="inline-block rounded-full shrink-0" style={{ width: tamanho, height: tamanho, background: COR_NIVEL[nivel] }} aria-hidden />
);

/** Botão de ação com feedback (scale .97, ~100ms). */
export function BotaoAcao({ children, onClick, tom = "neutro", className = "" }: { children: React.ReactNode; onClick: () => void; tom?: "ouro" | "coral" | "neutro"; className?: string }) {
  const estilo = tom === "ouro" ? { background: COR.ouro, color: "#141005", borderColor: COR.ouro }
    : tom === "coral" ? { background: "rgba(255,107,94,.12)", color: COR.coral, borderColor: "rgba(255,107,94,.45)" }
    : { background: COR.surface2, color: COR.texto, borderColor: COR.borda };
  return (
    <button type="button" onClick={onClick}
      className={`min-h-11 px-3 rounded-[12px] border inline-flex items-center justify-center gap-1.5 text-[14px] font-bold transition-[transform,filter] duration-100 active:scale-[0.97] active:brightness-110 ${className}`}
      style={estilo}>
      {children}
    </button>
  );
}
