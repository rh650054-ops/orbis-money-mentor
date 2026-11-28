/* 3 · Prioridade de hoje: how much to put aside today. Every number and action comes from the
   page (the same values the old "Guardar hoje" card used): no calculation lives here. */
import { CalendarCheck, Check, Flame, RotateCcw } from "lucide-react";
import { Cartao, COR, reais, Titulo } from "./pecas";

export interface PrioridadeProps {
  carregando: boolean;
  /** an account or a goal exists: without them there is nothing to put aside */
  temPlanejamento: boolean;
  diaFechado: boolean;
  diaDeTrabalho: boolean;
  restante: number;
  contas: number;
  objetivos: number;
  guardouHoje: number;
  sequencia: number;
  /** share of today's profit the amount represents, shown when there is no streak (null = hide) */
  pctDoLucro: number | null;
  /** a "Guardei" can be undone (partial save of today) */
  podeDesfazer: boolean;
  onGuardei: () => void;
  onDesfazer: () => void;
  onPlanejar: () => void;
}

/** The short line under the amount. Exported for the tests. */
export function explicacao(p: Pick<PrioridadeProps, "contas" | "objetivos">): string {
  if (p.contas > 0 && p.objetivos > 0) return `Contas ${reais(p.contas)} · objetivos ${reais(p.objetivos)}`;
  if (p.objetivos > 0) return "Para seus objetivos andarem no prazo";
  return "Para manter suas contas em dia";
}

const botaoOuro = "w-full h-[52px] rounded-[14px] font-black text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform";

function BotaoPlanejar({ onClick, texto, cheio }: { onClick: () => void; texto: string; cheio: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`${botaoOuro} mt-3`}
      style={cheio ? { background: COR.ouro, color: "#1a1305" } : { background: "transparent", border: "1px solid rgba(245,184,0,.45)", color: COR.ouro }}>
      {texto} <span aria-hidden>→</span>
    </button>
  );
}

export function PrioridadeHoje(p: PrioridadeProps) {
  const titulo = (
    <div className="flex items-center justify-between gap-2">
      <Titulo cor={COR.ouro} icone={<CalendarCheck className="w-3.5 h-3.5" aria-hidden />}>Prioridade de hoje</Titulo>
      {p.sequencia === 0 && p.pctDoLucro != null && !p.carregando && (
        <span className="text-[12px] tabular-nums" style={{ color: COR.sub }}><b style={{ color: COR.texto }}>{p.pctDoLucro}%</b> do lucro de hoje</span>
      )}
      {p.sequencia > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black"
          style={{ background: "#2a1205", border: "1px solid rgba(255,122,26,.4)", color: "#ff9d4d" }}>
          <Flame className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden />
          {p.sequencia} {p.sequencia === 1 ? "dia seguido" : "dias seguidos"}
        </span>
      )}
    </div>
  );

  if (p.carregando) {
    return (
      <Cartao rotulo="Prioridade de hoje" tom="ouro">
        {titulo}
        <div aria-busy="true" className="h-8 w-40 rounded-lg mt-4 animate-pulse" style={{ background: "#2a2210" }} />
      </Cartao>
    );
  }

  if (!p.temPlanejamento) {
    return (
      <Cartao rotulo="Prioridade de hoje" tom="ouro">
        {titulo}
        <p className="text-[17px] font-black mt-3" style={{ color: COR.texto }}>Seu planejamento ainda não está pronto</p>
        <p className="text-[13.5px] mt-1.5" style={{ color: COR.sub }}>Cadastre uma conta ou um objetivo e a VANT calcula quanto separar por dia.</p>
        <BotaoPlanejar onClick={p.onPlanejar} texto="Configurar planejamento" cheio />
      </Cartao>
    );
  }

  if (p.diaFechado) {
    return (
      <Cartao rotulo="Prioridade de hoje" tom="ouro">
        {titulo}
        <div className="flex items-center justify-between gap-3 mt-3">
          <p className="flex items-center gap-2 text-[22px] font-black tabular-nums" style={{ color: COR.verde }}>
            <Check className="w-6 h-6" strokeWidth={3} aria-hidden />
            {p.guardouHoje > 0 ? `Guardou ${reais(p.guardouHoje)}` : "Já guardou hoje"}
          </p>
          <button type="button" onClick={p.onDesfazer} aria-label="Reverter o guardar de hoje" title="Reverter o guardar de hoje"
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-90 transition"
            style={{ border: `1px solid ${COR.borda}`, color: COR.sub }}>
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[13px] mt-1.5" style={{ color: COR.sub }}>Dia fechado. Amanhã aparece o novo valor.</p>
        <BotaoPlanejar onClick={p.onPlanejar} texto="Ver planejamento" cheio={false} />
      </Cartao>
    );
  }

  const podeGuardar = p.diaDeTrabalho && p.restante > 0;
  return (
    <Cartao rotulo="Prioridade de hoje" tom="ouro">
      {titulo}
      <p className="text-[14px] font-semibold mt-3" style={{ color: COR.texto }}>{p.diaDeTrabalho ? "Você precisa guardar" : "Hoje é seu descanso"}</p>
      {p.diaDeTrabalho && (
        <p className="text-[30px] font-black tabular-nums leading-none tracking-tight mt-1.5 truncate" style={{ color: COR.ouro }}>{reais(p.restante)}</p>
      )}
      <p className="text-[13px] mt-2 tabular-nums" style={{ color: COR.sub }}>
        {p.diaDeTrabalho ? explicacao(p) : "Vendeu hoje mesmo assim? Registre no DEFCON e o valor aparece."}
        {p.guardouHoje > 0 && ` · já guardou ${reais(p.guardouHoje)}`}
      </p>
      {podeGuardar && (
        <button type="button" onClick={p.onGuardei} className={`${botaoOuro} mt-4`} style={{ background: COR.ouro, color: "#1a1305" }}>
          <Check className="w-5 h-5" strokeWidth={3} aria-hidden /> GUARDEI {reais(p.restante)}
        </button>
      )}
      {p.podeDesfazer && (
        <button type="button" onClick={p.onDesfazer}
          className="w-full h-10 mt-2 rounded-xl text-[12.5px] font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition"
          style={{ border: `1px solid ${COR.borda}`, color: COR.sub }}>
          <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Desfazer o último "Guardei"
        </button>
      )}
      <BotaoPlanejar onClick={p.onPlanejar} texto="Ver planejamento" cheio={!podeGuardar} />
    </Cartao>
  );
}
