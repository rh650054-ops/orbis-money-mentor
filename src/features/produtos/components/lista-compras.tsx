/* Aba Estoque, C · O que preciso comprar? (25/11, Rick). He says how many of EACH product / flavour he
   wants to produce; "Gerar lista de compras" opens the full list: every ingredient and packaging the
   recipes take — total needed, what is in stock (shared ingredients counted once), what to buy, unit
   and estimated cost when the price is known. Items can be ticked and the list copied or shared.
   Only a calculation: no purchase, no stock change, no production. Purchases are registered in Mercado. */
import { useState } from "react";
import { Check, Copy, Share2, X } from "lucide-react";
import { itensDeProducao, type CatalogoProducao } from "../lib/producao";
import { listaDeCompras, nomeDoItem, qtdNaTela, textoDaLista, type ListaCompras as Lista, type Pedido } from "../lib/estoque";
import { reais } from "./campos";
import { MiniNumero } from "./mini-campos";

const n = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const chave = (p: string, s: string | null) => `${p}:${s ?? "-"}`;

export function ListaCompras({ c }: { c: CatalogoProducao }) {
  const itens = itensDeProducao(c).flatMap((g) => g.itens).filter((i) => i.situacao !== "sem_receita");
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [aberta, setAberta] = useState(false);
  const pedidos: Pedido[] = itens.map((i) => ({ produto: i.produto.id, sabor: i.sabor?.id ?? null, unidades: qtd[chave(i.produto.id, i.sabor?.id ?? null)] ?? 0 })).filter((p) => p.unidades > 0);
  const nomes = itens.filter((i) => (qtd[chave(i.produto.id, i.sabor?.id ?? null)] ?? 0) > 0).map((i) => ({ nome: nomeDoItem(i), unidades: qtd[chave(i.produto.id, i.sabor?.id ?? null)]! }));
  if (itens.length === 0) return <p className="text-[12.5px] px-1" style={{ color: "#7b766e" }}>Monte a receita de um produto para a VANT calcular o que comprar.</p>;
  return (
    <div className="rounded-[16px] px-3.5 py-3 flex flex-col gap-2.5" style={{ background: "#151515", border: "1px solid #2a2722" }}>
      <span className="text-[12.5px] font-semibold leading-snug" style={{ color: "#a8a297" }}>Quantas você quer produzir de cada um?</span>
      {itens.map((i) => {
        const k = chave(i.produto.id, i.sabor?.id ?? null);
        return (
          <div key={k} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 text-[14px] font-extrabold truncate">{i.sabor?.emoji ?? i.produto.emoji ?? "📦"} {nomeDoItem(i)}</span>
            <MiniNumero valor={qtd[k] ?? 0} largura={72} exemplo="0" rotulo={`Quantas de ${nomeDoItem(i)}`} onChange={(v) => setQtd((x) => ({ ...x, [k]: Math.max(0, Math.round(v)) }))} />
            <span className="text-[11.5px] font-semibold w-5" style={{ color: "#8f897e" }}>un</span>
          </div>
        );
      })}
      <button type="button" disabled={pedidos.length === 0} onClick={() => setAberta(true)} className="mt-1 h-11 rounded-[12px] text-[14px] font-extrabold disabled:opacity-40"
        style={{ background: "#F5B800", color: "#1A1200" }}>Gerar lista de compras</button>
      {aberta && <ListaAberta lista={listaDeCompras(c, pedidos)} pedidos={nomes} onFechar={() => setAberta(false)} />}
    </div>
  );
}

function ListaAberta({ lista, pedidos, onFechar }: { lista: Lista; pedidos: { nome: string; unidades: number }[]; onFechar: () => void }) {
  const [feitos, setFeitos] = useState<Set<string>>(new Set());
  const [copiou, setCopiou] = useState(false);
  const fisicos = lista.linhas.filter((l) => !l.custo);
  const comprar = fisicos.filter((l) => l.falta > 0);
  const total = comprar.reduce((t, l) => t + (l.custoCompra ?? 0), 0);
  const semPreco = comprar.some((l) => l.custoCompra === null);
  const texto = () => textoDaLista(pedidos, lista, feitos);
  const compartilhar = async () => {
    try { if (navigator.share) { await navigator.share({ text: texto() }); return; } } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(texto()); setCopiou(true); } catch { /* no clipboard */ }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end" style={{ background: "rgba(0,0,0,.7)" }} onClick={onFechar}>
      <div className="w-full max-w-md mx-auto rounded-t-[24px] flex flex-col max-h-[88dvh]" onClick={(e) => e.stopPropagation()} style={{ background: "#121212", border: "1px solid #2a2722" }}>
        <div className="px-4 pt-4 pb-2 flex items-start gap-2">
          <span className="flex-1 flex flex-col">
            <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>LISTA DE COMPRAS</span>
            <span className="text-[16px] font-extrabold leading-snug">Para {pedidos.map((p) => `${p.unidades} ${p.nome}`).join(" + ")}</span>
          </span>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1" style={{ color: "#8f897e" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-2">
          {lista.parciais.map((p) => <p key={p.item} className="rounded-[12px] px-3 py-2 text-[12px] font-bold leading-snug" style={{ background: "#1a1305", color: "#F5B800" }}>Previsão parcial de {p.item}: {p.motivo}. Esse item fica fora da conta até completar a receita.</p>)}
          {fisicos.map((l) => {
            const feito = feitos.has(l.ingrediente);
            return (
              <button key={l.ingrediente} type="button" onClick={() => setFeitos((s) => { const x = new Set(s); if (x.has(l.ingrediente)) x.delete(l.ingrediente); else x.add(l.ingrediente); return x; })}
                className="w-full rounded-[14px] px-3 py-2.5 flex items-start gap-2.5 text-left" style={{ background: "#181818", border: `1px solid ${l.falta > 0 ? "rgba(255,154,61,.35)" : "#24221e"}`, opacity: feito ? .55 : 1 }}>
                <span className="w-5 h-5 mt-0.5 rounded-md flex items-center justify-center shrink-0" style={feito ? { background: "#3DD68C", color: "#0b0b0b" } : { border: "1.5px solid #3a3833" }}>{feito && <Check className="w-3.5 h-3.5" strokeWidth={3.5} />}</span>
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className={`text-[14px] font-extrabold ${feito ? "line-through" : ""}`}>{l.nome}</span>
                  <span className="text-[11.5px] font-semibold" style={{ color: "#a8a297" }}>precisa {n(l.precisa)} · tem {n(l.tem)} {l.unidade}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[14px] font-extrabold tabular-nums" style={{ color: l.falta > 0 ? "#FF9A3D" : "#3DD68C" }}>{l.falta > 0 ? `comprar ${qtdNaTela(l.falta, l.unidade).principal}` : "tem o bastante"}</span>
                  {l.custoCompra !== null && <span className="text-[11.5px] font-semibold" style={{ color: "#8f897e" }}>≈ {reais(l.custoCompra)}</span>}
                </span>
              </button>
            );
          })}
          {lista.linhas.some((l) => l.custo) && <p className="text-[11.5px] font-semibold" style={{ color: "#8f897e" }}>{lista.linhas.filter((l) => l.custo).map((l) => l.nome).join(", ")}: custo, não mercadoria. Fica fora da lista.</p>}
        </div>
        <div className="px-4 pt-3 flex flex-col gap-2 border-t" style={{ borderColor: "#24221e", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          <div className="flex justify-between text-[13px] font-bold">
            <span style={{ color: "#c9c3b5" }}>{comprar.length} {comprar.length === 1 ? "item" : "itens"} para comprar</span>
            <span className="tabular-nums">{total > 0 ? `≈ ${reais(total)}${semPreco ? " + itens sem preço" : ""}` : semPreco ? "sem preço conhecido" : ""}</span>
          </div>
          <button type="button" onClick={() => { void compartilhar(); }} className="h-11 rounded-[12px] text-[14px] font-extrabold flex items-center justify-center gap-2" style={{ background: "#1c1c1c", border: "1px solid #2c2a25" }}>
            {copiou ? <><Copy className="w-4 h-4" /> Lista copiada</> : <><Share2 className="w-4 h-4" /> Copiar ou compartilhar a lista</>}
          </button>
          <span className="text-[10.5px] font-semibold text-center" style={{ color: "#7b766e" }}>Só a lista: nada sai do estoque e nenhuma compra é registrada. Ao comprar, registre no Mercado.</span>
        </div>
      </div>
    </div>
  );
}
