/* CONTAS DO MÊS — vencidas + as próximas; a lista inteira numa folha. */
import { useState } from "react";
import { AlertTriangle, Check, ChevronRight, CreditCard, Plus, Receipt, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { Barra, COR, Cartao, CheckAnimado, Folha, Rotulo, haptic } from "./ui";
import type { ContaVM } from "./tipos";

const PROXIMAS = 4;

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
  const corStatus = feito ? COR.verde : c.vencida ? COR.coral : c.venceEm != null && c.venceEm <= 3 ? COR.ouro : COR.sub;
  const reservado = feito ? "paga" : c.coberta ? "coberta" : `${formatCurrency(c.guardado)} reservado`;
  return (
    <div className="flex items-center gap-3 py-3 border-t first:border-t-0 transition-opacity duration-300" style={{ borderColor: "rgba(255,255,255,.06)", opacity: feito ? 0.62 : 1 }}>
      <button type="button" onClick={() => a.onAbrir(c.id)} className="flex-1 min-w-0 text-left rounded-[10px] transition-colors active:bg-white/[.04]">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[15px] font-bold truncate" style={{ color: COR.texto }}>{c.nome}</span>
          <span className="text-[16px] font-extrabold tabular-nums shrink-0" style={{ color: COR.texto }}>{formatCurrency(c.valor)}</span>
        </span>
        <span className="flex items-center gap-1 mt-0.5 text-[12.5px] font-semibold" style={{ color: corStatus }}>
          {feito ? <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} /> : c.vencida ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : c.cartao ? <CreditCard className="w-3.5 h-3.5 shrink-0" style={{ color: COR.mute }} /> : <Receipt className="w-3.5 h-3.5 shrink-0" style={{ color: COR.mute }} />}
          <span className="truncate">{pago ? "Pago" : status(c)}{c.plano && !feito ? " · plano ativo" : ""}</span>
        </span>
        <span className="flex items-center gap-2 mt-1.5">
          <span className="flex-1 min-w-0"><Barra pct={feito ? 100 : pct} altura={4} /></span>
          <span className="text-[11.5px] tabular-nums shrink-0" style={{ color: c.coberta ? COR.verde : COR.mute }}>{reservado}</span>
        </span>
      </button>
      {c.pagaCiclo && !pago ? (
        <button type="button" onClick={() => a.onReabrir(c.id)} aria-label={`Desfazer pagamento de ${c.nome}`} className="h-10 w-10 shrink-0 rounded-[12px] inline-flex items-center justify-center transition-transform active:scale-[0.97]" style={{ color: COR.sub }}>
          <RotateCcw className="w-4 h-4" />
        </button>
      ) : c.vencida && !c.coberta && !pago ? (
        <button type="button" onClick={() => { haptic(); a.onResolver(c.id); }} className="h-10 px-3 shrink-0 rounded-[12px] text-[13px] font-black transition-transform duration-100 active:scale-[0.97]" style={{ background: COR.coral, color: "#1a0705" }}>
          Resolver
        </button>
      ) : (
        <button type="button" disabled={ocupado || pago} onClick={() => { haptic(); void paguei(); }}
          className="h-10 px-3 shrink-0 rounded-[12px] border inline-flex items-center gap-1 text-[13px] font-black transition-transform duration-100 active:scale-[0.97]"
          style={pago ? { background: COR.verde, borderColor: COR.verde, color: "#08140d" } : { background: COR.surface2, borderColor: c.coberta ? "rgba(245,184,0,.5)" : COR.borda, color: c.coberta ? COR.ouro : COR.texto }}>
          {pago ? <><CheckAnimado tamanho={15} />Pago</> : "Paguei"}
        </button>
      )}
    </div>
  );
}

export function ContasDoMes({ contas, onAdicionar, ...a }: { contas: ContaVM[]; onAdicionar: () => void } & Acoes) {
  const [todas, setTodas] = useState(false);
  const vencidas = contas.filter((c) => c.vencida);
  const proximas = contas.filter((c) => !c.vencida && !c.pagaCiclo);
  const visiveis = [...vencidas, ...proximas.slice(0, PROXIMAS)];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-2 px-1">
        <div>
          <Rotulo cor={COR.texto}>Contas do mês</Rotulo>
          {contas.length > 0 && (
            <p className="text-[13px] mt-0.5" style={{ color: COR.mute }}>
              {contas.length} {contas.length === 1 ? "conta" : "contas"}
              {vencidas.length > 0 ? ` · ${vencidas.length} ${vencidas.length === 1 ? "vencida" : "vencidas"}` : ""} · {proximas.length} {proximas.length === 1 ? "próxima" : "próximas"}
            </p>
          )}
        </div>
        <button type="button" onClick={onAdicionar} className="min-h-11 px-3 -mr-2 rounded-[12px] inline-flex items-center gap-1 text-[13px] font-extrabold transition-[transform,background-color] active:scale-[0.98] active:bg-white/[.05]" style={{ color: COR.ouro }}>
          <Plus className="w-4 h-4" strokeWidth={2.6} />Adicionar
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
            {visiveis.map((c) => <Linha key={c.id} c={c} a={a} />)}
            {contas.length > visiveis.length && (
              <button type="button" onClick={() => setTodas(true)} className="w-full h-11 border-t flex items-center justify-between text-[13.5px] font-extrabold transition-colors active:bg-white/[.04]" style={{ borderColor: "rgba(255,255,255,.06)", color: COR.ouro }}>
                Ver todas as {contas.length} contas <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </Cartao>
      <Folha open={todas} onOpenChange={setTodas} titulo="Contas do mês" subtitulo={`${contas.length} contas`} alta>
        <div>{contas.map((c) => <Linha key={c.id} c={c} a={{ ...a, onAbrir: (id) => { setTodas(false); a.onAbrir(id); } }} />)}</div>
      </Folha>
    </div>
  );
}
