/* "Inteligência coletada": the four sources with the number each one gave.
   The cost tile shows the composition (recipe + calote). "ver todos os números" opens RitmoCard. */
import { useState } from "react";
import { ChevronDown, Landmark, Package, Smartphone, TriangleAlert, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { brl0 } from "../lib/formato";
import type { BaseLucro, FonteCalote } from "../types";
import { nomeUnidade } from "../lib/plano";
import { CaloteEscolha } from "./calote-escolha";
import { RitmoCard } from "./ritmo-card";
import { COR } from "./ui";

interface Props {
  b: BaseLucro;
  /** 28/10: which calote estimate the mission uses; tapping the calote tile opens the choice */
  fonteCalote: FonteCalote;
  onFonteCalote: (f: FonteCalote) => void;
}

export function FontesLidas({ b, fonteCalote, onFonteCalote }: Props) {
  const [aberto, setAberto] = useState(false);
  const [calote, setCalote] = useState(false);
  const un = nomeUnidade(b.produto_nome);
  const un1 = nomeUnidade(b.produto_nome, 1);
  const tiles: Array<{ icon: LucideIcon; k: string; v: string; sub: string; cor?: string; atraso: number; onClick?: () => void }> = [
    { icon: Landmark, k: "Banco", v: b.banco ? brl0(b.gastos_corre) : "—", sub: b.banco ? "saídas do corre · 60 dias" : "não conectado", atraso: 0 },
    { icon: Smartphone, k: "Vendas no app", v: `${b.unidades.toLocaleString("pt-BR")} ${un}`, sub: `${b.dias_vendidos} dias · média ${b.unid_dia.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/dia`, atraso: 80 },
    { icon: TriangleAlert, k: "Calotes ≈", v: brl0(b.calote.usado), sub: `${b.calote.usado > 0 ? `${brl0(b.calote.por_dia)}/dia · ` : ""}${b.calote.fonte === "banco" ? "pelo banco" : "no app"} · trocar`, cor: b.calote.usado > 0 ? COR.vermelho : COR.verde, atraso: 160, onClick: () => setCalote((v) => !v) },
    { icon: Package, k: `Custo por ${un1}`, v: formatCurrency(b.custo_unid), sub: b.fonte_custo === "receita" ? `${formatCurrency(b.custo_receita)} + ${formatCurrency(b.calote_unid)} calote` : b.fonte_custo === "extrato" ? "pelo banco + calote" : "só calote · sem receita", atraso: 240 },
  ];
  return (
    <div className="mt-4">
      <p className="orbis-section px-0.5 mb-2 inline-flex items-center gap-2" style={{ color: COR.ouro }}>
        <span className="w-4 h-px" style={{ background: COR.ouro }} /> Inteligência coletada
      </p>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          const Tag = t.onClick ? "button" : "div";
          return (
            <Tag key={t.k} type={t.onClick ? "button" : undefined} onClick={t.onClick} aria-expanded={t.onClick ? calote : undefined}
              className={`vant-sobe rounded-[16px] px-3.5 py-3 min-w-0 relative overflow-hidden text-left ${t.onClick ? "active:scale-[0.98] transition-transform" : ""}`}
              style={{ background: "#0b0b0d", border: `1px solid ${t.onClick && calote ? COR.ouro : COR.linha}`, animationDelay: `${t.atraso}ms` }}>
              <span className="absolute left-0 top-3 bottom-3 w-[2px] rounded-full" style={{ background: t.cor ?? COR.ouro, opacity: .8 }} />
              <p className="text-[10.5px] font-bold uppercase tracking-[.08em] inline-flex items-center gap-1.5" style={{ color: COR.mute }}>
                <Icon className="w-3.5 h-3.5" strokeWidth={2.2} /> {t.k}
              </p>
              <p className="vant-missao-num text-[24px] leading-none mt-1.5 truncate" style={{ color: t.cor ?? COR.texto }}>{t.v}</p>
              <p className="text-[11px] mt-1 truncate" style={{ color: COR.sub }}>{t.sub}</p>
            </Tag>
          );
        })}
      </div>
      {calote && <div className="mt-2"><CaloteEscolha b={b} fonte={fonteCalote} onFonte={onFonteCalote} /></div>}
      <button type="button" onClick={() => setAberto((a) => !a)}
        className="w-full h-10 mt-1 text-[12px] font-bold inline-flex items-center justify-center gap-1" style={{ color: COR.sub }}>
        {aberto ? "esconder os números" : "ver todos os números"} <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && <RitmoCard b={b} />}
    </div>
  );
}
