/* CONTAS DO MÊS — refino 05/10 (prompt do Mohamed + UX):
   • a prévia mostra só as PRÓXIMAS (as vencidas já estão no card logo acima);
   • cada linha lê na ordem nome + valor → status → reservado → ação;
   • o nome tem a largura toda (o botão fica embaixo, à direita), então não corta cedo;
   • "Ver todas" abre a lista em grupos: Vencidas / Próximas / Pagas este mês. */
import { useState } from "react";
import { AlertTriangle, ArrowUp, Check, ChevronRight, Plus, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { Barra, COR, Cartao, CheckAnimado, Folha, haptic } from "./ui";
import type { ContaVM } from "./tipos";

const PROXIMAS = 3;

const status = (c: ContaVM) => {
  if (c.pagaCiclo) return "paga este mês";
  if (c.faturaAberta) return "fatura aberta · lance a compra";
  if (c.vencida) { const n = Math.abs(c.venceEm ?? 0); return n === 0 ? "Venceu hoje" : `Venceu há ${n} ${n === 1 ? "dia" : "dias"}`; }
  if (c.venceEm == null) return "sem vencimento";
  if (c.venceEm === 0) return "vence hoje";
  if (c.venceEm === 1) return "vence amanhã";
  return `vence em ${c.venceEm} dias`;
};

interface Acoes { onAbrir: (id: string) => void; onPaguei: (id: string) => Promise<boolean>; onResolver: (id: string) => void; onReabrir: (id: string) => void }

function Linha({ c, a }: { c: ContaVM; a: Acoes }) {
  const [pago, setPago] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const pct = c.valor > 0 ? (c.guardado / c.valor) * 100 : 0;
  const feito = pago || c.pagaCiclo;
  const paguei = async () => {
    setOcupado(true);
    const ok = await a.onPaguei(c.id);
    setOcupado(false);
    if (ok) { haptic("sucesso"); setPago(true); window.setTimeout(() => setPago(false), 1400); }
  };
  const perto = c.venceEm != null && c.venceEm <= 3;
  const corStatus = feito ? COR.verde : c.vencida ? COR.coral : perto ? COR.ouro : COR.sub;
  const reservado = feito ? "conta paga" : c.coberta ? "tudo reservado" : `${formatCurrency(c.guardado)} reservado`;

  return (
    <div className="py-3 border-t first:border-t-0 transition-opacity duration-300" style={{ borderColor: "rgba(255,255,255,.06)", opacity: feito ? 0.6 : 1 }}>
      <button type="button" onClick={() => a.onAbrir(c.id)} className="w-full text-left rounded-[10px] transition-colors active:bg-white/[.04]">
        <span className="flex items-start justify-between gap-3">
          <span className="text-[16px] font-semibold leading-snug line-clamp-2 break-words" style={{ color: COR.texto }}>{c.nome}</span>
          <span className="text-[18px] font-bold tabular-nums shrink-0 leading-snug" style={{ color: COR.texto }}>{formatCurrency(c.valor)}</span>
        </span>
      </button>
      <div className="flex items-center gap-3 mt-1">
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: corStatus }}>
            {feito ? <Check className="w-4 h-4 shrink-0" strokeWidth={3} /> : c.vencida ? <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={2.2} /> : null}
            <span className="truncate">{pago ? "Pago" : status(c)}</span>
            {c.plano && !feito && (
              <span className="shrink-0 text-[10.5px] font-black uppercase tracking-[.06em] rounded-full px-1.5 py-px" style={{ background: "rgba(245,184,0,.12)", color: COR.ouro }}>plano</span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 min-w-0"><Barra pct={feito ? 100 : pct} altura={5} /></div>
            <span className="text-[12.5px] tabular-nums shrink-0" style={{ color: c.coberta && !feito ? COR.verde : COR.mute }}>{reservado}</span>
          </div>
        </div>
        {c.pagaCiclo && !pago ? (
          <button type="button" onClick={() => a.onReabrir(c.id)} aria-label={`Desfazer pagamento de ${c.nome}`}
            className="h-10 px-3 shrink-0 rounded-[14px] inline-flex items-center gap-1 text-[13px] font-bold transition-transform duration-100 active:scale-[0.97]" style={{ color: COR.sub }}>
            <RotateCcw className="w-4 h-4" />Desfazer
          </button>
        ) : c.vencida && !c.coberta && !pago ? (
          <button type="button" onClick={() => { haptic(); a.onResolver(c.id); }}
            className="h-10 px-4 shrink-0 rounded-[14px] text-[14px] font-black transition-[transform,filter] duration-100 active:scale-[0.97] active:brightness-90" style={{ background: COR.coral, color: "#1a0705" }}>
            Resolver
          </button>
        ) : (
          <button type="button" disabled={ocupado || pago} onClick={() => { haptic(); void paguei(); }}
            className="h-10 px-4 shrink-0 rounded-[14px] border inline-flex items-center gap-1 text-[14px] font-bold transition-[transform,filter] duration-100 active:scale-[0.97] active:brightness-125"
            style={pago ? { background: "rgba(61,214,140,.16)", borderColor: "rgba(61,214,140,.5)", color: COR.verde }
              : c.coberta ? { background: "rgba(245,184,0,.1)", borderColor: "rgba(245,184,0,.55)", color: COR.ouro }
              : { background: COR.surface2, borderColor: COR.borda, color: "#d8d3c9" }}>
            {pago ? <><CheckAnimado tamanho={15} />Pago</> : "Paguei"}
          </button>
        )}
      </div>
    </div>
  );
}

function Grupo({ titulo, cor, contas, a }: { titulo: string; cor?: string; contas: ContaVM[]; a: Acoes }) {
  if (contas.length === 0) return null;
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[.14em] pt-1 pb-0.5" style={{ color: cor ?? COR.mute }}>{titulo} · {contas.length}</p>
      {contas.map((c) => <Linha key={c.id} c={c} a={a} />)}
    </div>
  );
}

export function ContasDoMes({ contas, onAdicionar, onVerVencidas, ...a }: { contas: ContaVM[]; onAdicionar: () => void; onVerVencidas: () => void } & Acoes) {
  const [todas, setTodas] = useState(false);
  const vencidas = contas.filter((c) => c.vencida);
  const proximas = contas.filter((c) => !c.vencida && !c.pagaCiclo);
  const pagas = contas.filter((c) => c.pagaCiclo);
  const visiveis = proximas.slice(0, PROXIMAS);
  const fechaE = (fn: (id: string) => void) => (id: string) => { setTodas(false); fn(id); };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <p className="text-[16px] font-black uppercase tracking-[.08em]" style={{ color: COR.texto }}>Contas do mês</p>
          {contas.length > 0 && (
            <p className="text-[13px] font-medium mt-0.5" style={{ color: COR.mute }}>
              {contas.length} {contas.length === 1 ? "conta" : "contas"}
              {vencidas.length > 0 ? ` · ${vencidas.length} ${vencidas.length === 1 ? "vencida" : "vencidas"}` : ""} · {proximas.length} {proximas.length === 1 ? "próxima" : "próximas"}
            </p>
          )}
        </div>
        <button type="button" onClick={onAdicionar} className="min-h-11 px-3 -mr-2 rounded-[12px] inline-flex items-center gap-1 text-[15px] font-bold transition-[transform,background-color] active:scale-[0.98] active:bg-white/[.05]" style={{ color: COR.ouro }}>
          <Plus className="w-4 h-4" strokeWidth={2.8} />Adicionar
        </button>
      </div>

      <Cartao className="py-1">
        {contas.length === 0 ? (
          <button type="button" onClick={onAdicionar} className="w-full text-left py-3">
            <p className="text-[16px] font-semibold" style={{ color: COR.texto }}>Nenhuma conta ainda.</p>
            <p className="text-[14px] mt-1" style={{ color: COR.sub }}>Aluguel, luz, cartão: cadastra e a Vant diz quanto guardar por dia.</p>
          </button>
        ) : (
          <>
            {vencidas.length > 0 && (
              <button type="button" onClick={onVerVencidas} className="w-full h-10 flex items-center gap-1.5 text-[13px] font-semibold rounded-[10px] transition-colors active:bg-white/[.04]" style={{ color: COR.coral }}>
                <ArrowUp className="w-4 h-4" strokeWidth={2.4} />
                {vencidas.length === 1 ? "1 vencida no card acima" : `${vencidas.length} vencidas no card acima`}
              </button>
            )}
            <div className={vencidas.length > 0 ? "border-t" : undefined} style={{ borderColor: "rgba(255,255,255,.06)" }}>
              {visiveis.map((c) => <Linha key={c.id} c={c} a={a} />)}
              {visiveis.length === 0 && <p className="py-3 text-[14px]" style={{ color: COR.sub }}>Nenhuma outra conta por vir este mês.</p>}
            </div>
            {contas.length > visiveis.length && (
              <button type="button" onClick={() => setTodas(true)} className="w-full h-12 border-t flex items-center justify-between text-[16px] font-bold transition-colors active:bg-white/[.04]" style={{ borderColor: "rgba(255,255,255,.06)", color: COR.ouro }}>
                Ver todas as {contas.length} contas <ChevronRight className="w-5 h-5" strokeWidth={2.4} />
              </button>
            )}
          </>
        )}
      </Cartao>

      <Folha open={todas} onOpenChange={setTodas} titulo="Contas do mês" subtitulo={`${contas.length} contas`} alta>
        <div className="flex flex-col gap-2">
          <Grupo titulo="Vencidas" cor={COR.coral} contas={vencidas} a={{ ...a, onAbrir: fechaE(a.onAbrir), onResolver: fechaE(a.onResolver) }} />
          <Grupo titulo="Próximas" contas={proximas} a={{ ...a, onAbrir: fechaE(a.onAbrir), onResolver: fechaE(a.onResolver) }} />
          <Grupo titulo="Pagas este mês" cor={COR.verde} contas={pagas} a={{ ...a, onAbrir: fechaE(a.onAbrir), onResolver: fechaE(a.onResolver) }} />
        </div>
      </Folha>
    </div>
  );
}
