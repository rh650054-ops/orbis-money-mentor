/* Carga do dia — the summary panel (25/11/2026, Rick): before starting the day it answers three
   things: what he is taking, what it is worth and whether it reaches the day's goal. */
import { Box, Plus, Target } from "lucide-react";

const brl0 = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(Math.round(n));

export function CargaResumo({ itens, produtos, potencial, custo, sobra, meta, unidadesMeta, onEscolher }: {
  itens: number; produtos: number; potencial: number; custo: number; sobra: number; meta: number; unidadesMeta: number; onEscolher: () => void;
}) {
  if (itens <= 0) {
    return (
      <button type="button" onClick={onEscolher} className="w-full mt-5 rounded-[26px] px-5 py-6 text-left flex items-center gap-4 active:scale-[.99]"
        style={{ border: "1px solid rgba(245,184,0,.35)", background: "radial-gradient(120% 90% at 50% -10%, rgba(245,184,0,.16), transparent 60%), linear-gradient(170deg,#1a1408 0%,#0c0c0c 70%)" }}>
        <span className="w-14 h-14 rounded-[18px] flex items-center justify-center shrink-0" style={{ background: "rgba(245,184,0,.14)", border: "1px solid rgba(245,184,0,.3)" }}>
          <Box className="w-7 h-7" style={{ color: "var(--orbis-gold)" }} />
        </span>
        <span className="flex-1">
          <span className="block text-[18px] font-extrabold leading-tight">Escolha o que vai levar hoje</span>
          <span className="block text-[12.5px] mt-1" style={{ color: "var(--orbis-fg-2)" }}>A VANT mostra quanto a carga vale e se bate a meta.</span>
        </span>
        <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--orbis-gold)", color: "#1A1200" }}><Plus className="w-5 h-5" strokeWidth={3} /></span>
      </button>
    );
  }
  const pct = meta > 0 ? Math.min(100, Math.round((potencial / meta) * 100)) : 0;
  const bate = meta > 0 && potencial >= meta;
  const Stat = ({ k, v, cor }: { k: string; v: string; cor?: string }) => (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[.08em]" style={{ color: "var(--orbis-fg-3)" }}>{k}</p>
      <p className="text-[17px] font-extrabold mt-1 tabular-nums" style={{ color: cor ?? "var(--orbis-fg)" }}>{v}</p>
    </div>
  );
  return (
    <div className="relative overflow-hidden rounded-[26px] mt-5 px-5 pt-5 pb-5"
      style={{ border: "1px solid rgba(245,184,0,.32)", background: "radial-gradient(120% 90% at 50% -10%, rgba(245,184,0,.18), transparent 60%), linear-gradient(170deg,#1a1408 0%,#0c0c0c 70%)", boxShadow: "0 20px 40px -24px rgba(245,184,0,.35)" }}>
      <p className="text-[10.5px] font-black uppercase tracking-[.16em]" style={{ color: "var(--orbis-gold)" }}>Essa carga rende</p>
      <p className="text-[32px] font-extrabold leading-none mt-2 tracking-[-.5px] tabular-nums">{brl0(potencial)}</p>
      <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "var(--orbis-fg-2)" }}>
        {custo > 0
          ? <>Você investiu <b className="text-foreground">{brl0(custo)}</b>. Se vender tudo, sobram <b style={{ color: "#3DD68C" }}>{brl0(sobra)}</b>.</>
          : <>Cadastre o custo dos produtos para ver quanto sobra.</>}
      </p>
      <div className="flex gap-3 mt-4 pt-3.5 border-t" style={{ borderColor: "rgba(255,255,255,.09)" }}>
        <Stat k="Levando" v={`${itens} un`} />
        <Stat k="Investido" v={custo > 0 ? brl0(custo) : "—"} cor="#E5737F" />
        <Stat k="Sobra" v={custo > 0 ? brl0(sobra) : "—"} cor="#3DD68C" />
      </div>
      <p className="text-[11px] font-semibold mt-1" style={{ color: "var(--orbis-fg-3)" }}>{produtos} {produtos === 1 ? "produto" : "produtos"} na carga · estimativa, se vender tudo pelo preço de 1</p>
      <div className="mt-4 rounded-[16px] px-3.5 py-3" style={{ background: "rgba(0,0,0,.35)", border: `1px solid ${bate ? "rgba(61,214,140,.35)" : "rgba(255,255,255,.08)"}` }}>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: "var(--orbis-fg-2)" }}><Target className="w-4 h-4" style={{ color: "var(--orbis-gold)" }} /> Meta do dia</span>
          <span className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--orbis-gold)" }}>{meta > 0 ? brl0(meta) : "—"}</span>
        </div>
        {meta > 0 && (
          <>
            <div className="h-2 rounded-full mt-2.5 overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: bate ? "#3DD68C" : "linear-gradient(90deg,#F5B800,#FF9A3D)" }} />
            </div>
            <p className="text-[12.5px] font-bold mt-2 leading-snug" style={{ color: bate ? "#3DD68C" : "#FF9A3D" }}>
              {bate ? `Bate a meta: vendendo ${unidadesMeta} un você chega lá.` : `Ainda está abaixo da meta: faltam ${brl0(meta - potencial)}. Leve mais ou venda combo.`}
            </p>
          </>
        )}
        {meta <= 0 && <p className="text-[12px] mt-1.5" style={{ color: "var(--orbis-fg-3)" }}>Sem meta definida para hoje.</p>}
      </div>
    </div>
  );
}
