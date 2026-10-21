/* ============================================================
   CARD PRINCIPAL DO FOCO — o DEFCON. Muda de tom com o momento do dia:
   antes (vinho: pressão/meta), rodando (verde: ao vivo), encerrado (ouro).
   Só o que importa pra APERTAR: a meta de hoje, a régua Mínimo · Meta · Turbo
   (acende conforme passa — não é escolha), o botão e três números de contexto.
   O mês mora no card de baixo (MesCard). Sem "olho" de esconder valores (Rick, 18/10).
   Puro: recebe tudo por props.
   ============================================================ */
import { Check, FileDown, FileText, Loader2, Pencil, Play, Zap } from "lucide-react";
import { FaixasDaMeta } from "@/components/metas/FaixasDaMeta";
import { DIAS_PT, type MetaDoDia } from "@/shared/lib/meta-viavel";
import { AnelProgresso, Trio } from "./foco-hero-partes";
import { brl0, PRESS, type EstadoFoco } from "./foco-tipos";

export interface HeroNumeros {
  dailyGoal: number; totalVendido: number; totalCaiu: number; faltaCair: number; lucro: number;
  workHours: number; blocosTot: number; projecao: number;
  ontem: number; pctOntem: number; semana: number;
  vendas: number; abord: number; conv: number;
  rankPos: number | null; ligaCor: string | null; ligaLabel: string;
  horaInicio: number | null; ativoDesde: string | null;
}

interface Props {
  estado: EstadoFoco;
  n: HeroNumeros;
  meta: MetaDoDia | null;
  temFaixas: boolean;
  overnightOpen: boolean;
  exporting: boolean;
  onEditar: () => void;
  onIrDefcon: () => void;
  onPDF: () => void;
}

const TOM = {
  antes: { borda: "rgba(242,70,90,.35)", fundo: "radial-gradient(120% 80% at 80% -10%, rgba(242,70,90,.22), transparent 60%), linear-gradient(170deg,#170a0c 0%,#0b0b0b 70%)", tag: "#F2465A" },
  rodando: { borda: "rgba(61,214,140,.35)", fundo: "radial-gradient(120% 80% at 80% -10%, rgba(61,214,140,.18), transparent 60%), linear-gradient(170deg,#0a140e 0%,#0b0b0b 70%)", tag: "#3DD68C" },
  encerrado: { borda: "rgba(245,184,0,.35)", fundo: "radial-gradient(120% 80% at 80% -10%, rgba(245,184,0,.18), transparent 60%), linear-gradient(170deg,#1a1408 0%,#0b0b0b 70%)", tag: "#F5B800" },
} as const;

function ativoHa(iso: string | null): string | null {
  if (!iso) return null;
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
}

export function FocoHero(p: Props) {
  const { estado, n, meta, temFaixas } = p;
  const tom = TOM[estado];
  const v = brl0;
  const progresso = n.dailyGoal > 0 ? Math.min(100, (n.totalVendido / n.dailyGoal) * 100) : 0;
  const bateu = n.dailyGoal > 0 && n.totalVendido >= n.dailyGoal;
  const falta = Math.max(0, n.dailyGoal - n.totalVendido);
  const diaNome = meta ? DIAS_PT[meta.diaSemana] ?? "hoje" : "hoje";
  const pctMeta = n.dailyGoal > 0 ? Math.round((n.totalVendido / n.dailyGoal) * 100) : 0;
  const botao = (cls: string) => `w-full rounded-[17px] font-extrabold flex items-center justify-center gap-2 ${PRESS} ${cls}`;

  return (
    <section className="relative overflow-hidden rounded-[26px] border mt-4 px-5 pt-5 pb-[18px]" style={{ borderColor: tom.borda, background: tom.fundo }} aria-label="DEFCON de hoje">
      <span className="inline-flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[.2em] uppercase" style={{ color: tom.tag }}>
        {estado === "rodando" ? <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#3DD68C", boxShadow: "0 0 0 4px rgba(61,214,140,.18)" }} /> : estado === "encerrado" ? <Check className="w-3 h-3" strokeWidth={3} /> : <Zap className="w-3 h-3" fill="currentColor" strokeWidth={0} />}
        DEFCON 4 · {estado === "rodando" ? "ao vivo" : estado === "encerrado" ? "encerrado" : "Modo desafio"}
      </span>
      {estado === "antes" && (
        <button type="button" onClick={p.onEditar} aria-label="Editar meta" className={`absolute right-[18px] top-[18px] w-[34px] h-[34px] rounded-[11px] flex items-center justify-center ${PRESS}`} style={{ border: "1px solid rgba(255,255,255,.10)", background: "rgba(255,255,255,.05)", color: "var(--orbis-fg-2)" }}><Pencil className="w-3.5 h-3.5" /></button>
      )}

      {/* número do dia */}
      {estado === "rodando" ? (
        <div className="flex items-center gap-4 mt-3.5">
          <AnelProgresso pct={progresso} valor={v(n.totalVendido)} cor={bateu ? "#3DD68C" : "#F5B800"} />
          <div className="flex-1 min-w-0">
            <p className="orbis-mini">Meta de hoje</p>
            <p className="orbis-num text-[19px] font-extrabold leading-none mt-1 whitespace-nowrap">{v(n.dailyGoal)}</p>
            <div className="mt-2.5 pt-2.5" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <p className="orbis-mini">{bateu ? "Meta batida" : "Falta"}</p>
              <p className="orbis-num text-[18px] font-extrabold leading-none mt-1 whitespace-nowrap" style={bateu ? { color: "var(--orbis-ok)" } : undefined}>{bateu ? `+${v(n.totalVendido - n.dailyGoal)}` : v(falta)}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="orbis-mini mt-3.5">{estado === "encerrado" ? "Vendido hoje" : `Meta de ${diaNome}`}</p>
          <p className="orbis-num text-[34px] font-extrabold leading-none mt-1.5 tracking-[-1px]" style={estado === "encerrado" ? { color: "var(--orbis-ok)" } : undefined}>
            {v(estado === "antes" ? n.dailyGoal : n.totalVendido)}
          </p>
        </>
      )}

      {/* régua: Mínimo · Meta · Turbo — acende conforme o vendido passa (não é escolha) */}
      {temFaixas && meta ? (
        <div className="mt-4"><FaixasDaMeta m={meta} vendido={n.totalVendido} compacta /></div>
      ) : (
        <>
          <div className="h-1.5 rounded-full mt-3.5 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${progresso}%`, background: bateu || estado === "rodando" ? "linear-gradient(90deg,#3DD68C,#46E09A)" : "linear-gradient(90deg,#F5B800,#FFC63A)" }} />
          </div>
          <div className="flex justify-between text-[11px] font-semibold mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>
            <span>Vendido <b className="text-foreground">{v(n.totalVendido)}</b></span><span>{bateu ? "meta batida" : `falta ${v(falta)}`}</span>
          </div>
        </>
      )}

      <p className="text-[12.5px] mt-3" style={{ color: "var(--orbis-fg-2)" }}>
        {estado === "antes" && <><b className="text-foreground">{n.workHours} blocos</b> de 1h · <b className="text-foreground">{v(n.dailyGoal / Math.max(1, n.workHours))}</b> por hora</>}
        {estado === "rodando" && <>{n.projecao > 0 ? <>Nesse ritmo você fecha em <b className="text-foreground">{v(n.projecao)}</b></> : <>Meta <b className="text-foreground">{v(n.dailyGoal)}</b></>}{n.ativoDesde ? <> · ativo há <b className="text-foreground">{ativoHa(n.ativoDesde)}</b></> : null}</>}
        {estado === "encerrado" && <><b className="text-foreground">{pctMeta}%</b> da meta{n.faltaCair > 0
          ? <> · caiu <b style={{ color: "var(--orbis-ok)" }}>{v(n.totalCaiu)}</b> · falta cair <b style={{ color: "var(--orbis-gold)" }}>{v(n.faltaCair)}</b></>
          : n.lucro > 0 ? <> · sobrou <b style={{ color: "var(--orbis-ok)" }}>{v(n.lucro)}</b> pra você</> : null}</>}
      </p>

      {/* CTA — único botão dominante da tela */}
      {estado === "rodando" ? (
        <button type="button" onClick={p.onIrDefcon} data-tour="defcon-banner" className={botao("h-[56px] mt-4 text-[16px]")} style={{ background: "linear-gradient(180deg,#46E09A,#3DD68C)", color: "#06170e", boxShadow: "0 12px 28px -12px rgba(61,214,140,.8)" }}>
          <Play className="w-[18px] h-[18px]" fill="#06170e" strokeWidth={0} /> VOLTAR PRO DEFCON
        </button>
      ) : estado === "encerrado" ? (
        <>
          <button type="button" onClick={p.onIrDefcon} data-tour="defcon-banner" className={`orbis-cta w-full mt-4 ${PRESS}`}><FileText className="w-4 h-4" strokeWidth={2.4} /> VER O RELATÓRIO DE HOJE</button>
          <button type="button" onClick={p.onPDF} disabled={p.exporting} className={botao("h-[50px] mt-2.5 text-[14px] font-bold")} style={{ border: "1px solid rgba(245,184,0,.45)", color: "var(--orbis-gold)" }}>
            {p.exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><FileDown className="w-4 h-4" /> Baixar PDF de hoje</>}
          </button>
        </>
      ) : (
        <>
          <button type="button" onClick={p.onIrDefcon} data-tour="defcon-banner" className={botao("h-[58px] mt-4 text-[16px] tracking-wide")} style={{ background: "linear-gradient(180deg,#F2465A,#E5354A)", color: "#FFF", boxShadow: "0 14px 30px -10px rgba(229,53,74,.85), inset 0 1px 0 rgba(255,255,255,.18)" }}>
            <Zap className="w-[18px] h-[18px]" fill="#fff" strokeWidth={0} /> {p.overnightOpen ? "CONTINUAR O DEFCON DE ONTEM" : "INICIAR DEFCON 4"}
          </button>
          {p.overnightOpen && <p className="mt-2.5 text-[11.5px] text-center leading-snug" style={{ color: "var(--orbis-fg-3)" }}>Seu DEFCON de <b className="text-foreground">ontem</b> ainda está aberto — o que vender conta pra ontem até você encerrar.</p>}
        </>
      )}

      {estado === "rodando" ? (
        <Trio itens={[["Vendas", n.vendas], ["Abord.", n.abord], ["Conv.", <span key="c" style={{ color: "var(--orbis-gold)" }}>{n.conv}%</span>]]} />
      ) : estado === "encerrado" ? (
        <Trio itens={[["Ranking", n.ligaCor ? <span key="r" style={{ color: n.ligaCor }}>#{n.rankPos} <small className="text-[11px] font-bold">{n.ligaLabel}</small></span> : "—"], ["Semana", v(n.semana)], ["Amanhã", <span key="a" className="text-[13px]">{n.horaInicio != null ? `${String(n.horaInicio).padStart(2, "0")}h · ` : ""}{v(n.dailyGoal)}</span>]]} />
      ) : (
        <Trio itens={[["Ontem", n.ontem > 0 ? <>{v(n.ontem)} {n.pctOntem > 0 && <small className="text-[11px]" style={{ color: n.pctOntem >= 100 ? "var(--orbis-ok)" : "var(--orbis-fg-3)" }}>{n.pctOntem}%</small>}</> : "—"], ["Semana", n.semana > 0 ? v(n.semana) : "—"], ["Ranking", n.ligaCor ? <span key="r" style={{ color: n.ligaCor }}>#{n.rankPos} <small className="text-[11px] font-bold">{n.ligaLabel}</small></span> : "—"]]} />
      )}
    </section>
  );
}
