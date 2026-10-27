/* What the Vant read: four tiles with the number that came out of each source.
   Tapping "ver os números" opens the full breakdown (RitmoCard). */
import { useState } from "react";
import { ChevronDown, Landmark, Package, Smartphone, TriangleAlert, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import type { BaseLucro } from "../types";
import { nomeUnidade } from "../lib/plano";
import { RitmoCard } from "./ritmo-card";
import { COR } from "./ui";

export function FontesLidas({ b }: { b: BaseLucro }) {
  const [aberto, setAberto] = useState(false);
  const un = nomeUnidade(b.produto_nome);
  const tiles: Array<{ icon: LucideIcon; k: string; v: string; sub: string; cor?: string }> = [
    { icon: Landmark, k: "Banco", v: b.banco ? formatCurrency(b.gastos_corre) : "—", sub: b.banco ? "saídas do corre" : "não conectado" },
    { icon: Smartphone, k: "Vendas no app", v: `${b.unidades.toLocaleString("pt-BR")} ${un}`, sub: `${b.dias_vendidos} dias de venda` },
    { icon: TriangleAlert, k: "Calotes", v: formatCurrency(b.calote.valor), sub: b.calote.perdido > 0 ? `${formatCurrency(b.calote.perdido)} perdidos` : "tudo recuperado", cor: b.calote.perdido > 0 ? COR.vermelho : undefined },
    { icon: Package, k: `Custo por ${nomeUnidade(b.produto_nome, 1)}`, v: formatCurrency(b.custo_unid), sub: b.fonte_custo === "extrato" ? "pelo banco" : "pela receita" },
  ];
  return (
    <div className="mt-3">
      <p className="orbis-section px-0.5 mb-2" style={{ color: COR.mute }}>O que a Vant leu · últimos {b.janela_dias} dias</p>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.k} className="rounded-[16px] px-3.5 py-3 min-w-0" style={{ background: COR.caixa, border: `1px solid ${COR.linha}` }}>
              <p className="text-[10.5px] font-bold uppercase tracking-[.06em] inline-flex items-center gap-1.5" style={{ color: COR.mute }}>
                <Icon className="w-3.5 h-3.5" strokeWidth={2.2} /> {t.k}
              </p>
              <p className="orbis-num text-[17px] font-black mt-1 truncate" style={{ color: t.cor ?? COR.texto }}>{t.v}</p>
              <p className="text-[11.5px] truncate" style={{ color: COR.sub }}>{t.sub}</p>
            </div>
          );
        })}
      </div>
      <button type="button" onClick={() => setAberto((a) => !a)}
        className="w-full h-10 mt-1 text-[12.5px] font-bold inline-flex items-center justify-center gap-1" style={{ color: COR.sub }}>
        {aberto ? "esconder os números" : "ver todos os números"} <ChevronDown className={`w-4 h-4 transition-transform ${aberto ? "rotate-180" : ""}`} />
      </button>
      {aberto && <RitmoCard b={b} />}
    </div>
  );
}
