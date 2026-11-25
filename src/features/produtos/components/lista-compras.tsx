/* "O que preciso comprar?" (25/11, Rick): "quero produzir 40 garrafas de maracujá". The seller types
   how many of each product / flavour; the VANT reads each recipe and its real yield, adds up what
   shared ingredients take (their stock counted once), compares with what is stored and lists what to
   buy. Only a query: nothing leaves the stock and no production is recorded. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { itensDeProducao, type CatalogoProducao } from "../lib/producao";
import { listaDeCompras, nomeDoItem, qtdNaTela, type Pedido } from "../lib/estoque";
import { MiniNumero } from "./mini-campos";

const n = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const chave = (p: string, s: string | null) => `${p}:${s ?? "-"}`;

export function ListaCompras({ c }: { c: CatalogoProducao }) {
  const navigate = useNavigate();
  const itens = itensDeProducao(c).flatMap((g) => g.itens).filter((i) => i.situacao !== "sem_receita");
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const pedidos: Pedido[] = itens.map((i) => ({ produto: i.produto.id, sabor: i.sabor?.id ?? null, unidades: qtd[chave(i.produto.id, i.sabor?.id ?? null)] ?? 0 })).filter((p) => p.unidades > 0);
  const r = listaDeCompras(c, pedidos);
  const comprar = r.linhas.filter((l) => l.falta > 0);
  if (itens.length === 0) return <p className="text-[12.5px] px-1" style={{ color: "#7b766e" }}>Monte a receita de um produto para a VANT calcular o que comprar.</p>;
  return (
    <div className="rounded-[16px] px-3.5 py-3 flex flex-col gap-2.5" style={{ background: "#151515", border: "1px solid #2a2722" }}>
      <span className="text-[13px] font-bold leading-snug" style={{ color: "#c9c3b5" }}>Quantas você quer produzir? A VANT soma as receitas e mostra o que falta.</span>
      {itens.map((i) => {
        const k = chave(i.produto.id, i.sabor?.id ?? null);
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-[13.5px] font-extrabold truncate">{i.sabor?.emoji ?? i.produto.emoji ?? "📦"} {nomeDoItem(i)}</span>
            <MiniNumero valor={qtd[k] ?? 0} largura={68} exemplo="0" rotulo={`Quantas de ${nomeDoItem(i)}`} onChange={(v) => setQtd((x) => ({ ...x, [k]: Math.max(0, Math.round(v)) }))} />
            <span className="text-[11.5px] font-semibold w-6" style={{ color: "#8f897e" }}>un</span>
          </div>
        );
      })}
      {pedidos.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: "1px solid #24221e" }}>
          {r.parciais.map((p) => (
            <p key={p.item} className="text-[12px] font-bold leading-snug" style={{ color: "#F5B800" }}>Previsão parcial para {p.item}: {p.motivo}. Esses itens não entram na conta até você completar.</p>
          ))}
          <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: comprar.length ? "#FF9A3D" : "#3DD68C" }}>
            {comprar.length ? "PRECISA COMPRAR" : "DÁ PARA PRODUZIR COM O QUE VOCÊ TEM"}
          </span>
          {r.linhas.filter((l) => !l.custo).map((l) => (
            <div key={l.ingrediente} className="flex items-baseline justify-between gap-2 text-[13px] font-bold">
              <span className="min-w-0 truncate">{l.nome}</span>
              <span className="tabular-nums shrink-0 text-right" style={{ color: l.falta > 0 ? "#FF9A3D" : "#c9c3b5" }}>
                {l.falta > 0 ? <>comprar <b>{qtdNaTela(l.falta, l.unidade).principal}</b></> : "ok"}
                <span className="block text-[11px] font-semibold" style={{ color: "#8f897e" }}>precisa {n(l.precisa)} · tem {n(l.tem)} {l.unidade}</span>
              </span>
            </div>
          ))}
          {r.linhas.some((l) => l.custo) && (
            <p className="text-[11.5px] font-semibold leading-snug" style={{ color: "#8f897e" }}>
              {r.linhas.filter((l) => l.custo).map((l) => l.nome).join(", ")}: é custo, não se compra. Fica fora da lista.
            </p>
          )}
          {comprar.length > 0 && (
            <button type="button" onClick={() => navigate("/products/mercado")} className="mt-1 h-11 rounded-[12px] flex items-center justify-center gap-2 text-[14px] font-extrabold" style={{ background: "#F5B800", color: "#1A1200" }}>
              <ShoppingCart className="w-4 h-4" /> Registrar essa compra no Mercado
            </button>
          )}
          <span className="text-[10.5px] font-semibold" style={{ color: "#7b766e" }}>Só uma conta: nada sai do estoque e nenhuma produção é registrada.</span>
        </div>
      )}
    </div>
  );
}
