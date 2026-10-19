/* "Quantas unidades você vai fazer com essa compra?" (Rick, 19/10): fala 100 e a
   VANT mostra o custo de cada uma (o que pagou ÷ 100). Os insumos ficam no estoque
   até ele produzir — aí ele toca em "Produzi" no Estoque e dá baixa. */
import { useState } from "react";
import { toast } from "@/shared/hooks/use-toast";
import { useRendimentoMutation } from "../api/use-producao-mutations";
import type { ProdutoMercado } from "../lib/mercado";
import { Contador, reais } from "./campos";
import { Chip } from "./mercado-casca";
import { BotaoOuro } from "./quiz-casca";

const OURO = "#F5B800";

export function MercadoRendimento({ compraId, total, faz }: { compraId: string; total: number; faz: ProdutoMercado[] }) {
  const [pid, setPid] = useState<string | null>(faz.length === 1 ? faz[0]?.id ?? null : null);
  const [unidades, setUnidades] = useState(0);
  const salvar = useRendimentoMutation();
  const [feito, setFeito] = useState(false);
  const prod = faz.find((p) => p.id === pid);
  const cada = unidades > 0 ? total / unidades : 0;
  const venda = prod?.sale_price ?? 0;

  if (feito && prod) {
    return (
      <section className="rounded-[18px] px-4 py-3.5 flex flex-col gap-1.5" style={{ background: "rgba(74,222,128,.07)", border: "1px solid rgba(74,222,128,.35)" }}>
        <span className="text-[15px] font-black">✓ {unidades} {prod.name} · {reais(cada)} cada</span>
        <span className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>
          Os insumos estão no estoque. Quando produzir, vai em <b style={{ color: OURO }}>Produtos › Estoque</b> e toca em
          <b style={{ color: OURO }}> Produzi</b> — aí as {prod.name.toLowerCase()}s entram no estoque e os insumos baixam.
        </span>
      </section>
    );
  }
  return (
    <section className="rounded-[18px] px-4 py-3.5 flex flex-col gap-3" style={{ background: "#0e0e10", border: "1px solid rgba(245,184,0,.4)" }}>
      <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: OURO }}>QUANTAS VAI FAZER?</span>
      {faz.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {faz.map((p) => <Chip key={p.id} ativo={pid === p.id} onClick={() => setPid(p.id)}>{p.emoji ?? "📦"} {p.name}</Chip>)}
        </div>
      )}
      <Contador rotulo={`Quantas ${prod ? prod.name.toLowerCase() + "s" : "unidades"} você vai fazer com essa compra?`} valor={unidades} onChange={setUnidades} unidade="un" />
      {unidades > 0 && total > 0 && (
        <span className="text-[14px] font-bold text-center" style={{ color: "#b9b3a6" }}>
          Cada uma vai custar <b className="text-[18px]" style={{ color: OURO }}>{reais(cada)}</b>
          {venda > 0 && <> · sobra <b style={{ color: venda > cada ? "#4ADE80" : "#FF7A6B" }}>{reais(venda - cada)}</b> por venda</>}
        </span>
      )}
      <BotaoOuro disabled={!prod || unidades < 1 || salvar.isPending}
        onClick={() => prod && salvar.mutate({ compra: compraId, produto: prod.id, unidades }, {
          onSuccess: () => setFeito(true),
          onError: () => toast({ title: "Não consegui guardar", description: "Tenta de novo daqui a pouco.", variant: "destructive" }),
        })}>
        {salvar.isPending ? "GUARDANDO…" : "GUARDAR"}
      </BotaoOuro>
    </section>
  );
}
