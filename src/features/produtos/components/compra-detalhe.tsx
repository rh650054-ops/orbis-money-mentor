/* Compra antiga aberta (Rick, 26/10/2026): o que foi comprado e por quanto, o que virou
   produto, o custo de cada unidade e o que tem guardado AGORA de cada ingrediente. */
import { X } from "lucide-react";
import { useCompraDetalheQuery } from "../api/use-compra-detalhe-query";
import { useSobraEstoqueQuery } from "../api/use-sobra-estoque-query";
import { textoEstoque } from "../lib/sobra";
import { MercadoSobra } from "./mercado-sobra";
import { reais } from "./campos";
import { BotaoOuro } from "./quiz-casca";

const OURO = "#F5B800";
const CARTAO = { background: "#0e0e10", border: "1px solid #26241f" };
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " ·");

export function CompraDetalhe({ id, onFechar, onEditar }: { id: string | null; onFechar: () => void; onEditar: (id: string) => void }) {
  const q = useCompraDetalheQuery(id);
  const c = q.data;
  const sobra = useSobraEstoqueQuery((c?.feitos ?? []).map((f) => f.id), id ?? "");
  if (!id) return null;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black text-[#F4F1EA]" role="dialog" aria-label="Compra do mercado">
      <div className="min-h-[100dvh] max-w-md mx-auto px-4 flex flex-col gap-3" style={{ paddingTop: "calc(env(safe-area-inset-top) + 16px)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: OURO }}>COMPRA DO MERCADO</span>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#121211", color: "#b9b3a6" }}><X className="w-4 h-4" /></button>
        </div>
        {q.isLoading && <div className="h-40 rounded-[18px] animate-pulse" style={CARTAO} />}
        {q.isError && <p className="text-[13px] font-bold" style={{ color: "#FF7A6B" }}>Não consegui abrir essa compra. Tenta de novo.</p>}
        {c && (
          <>
            <section className="rounded-[22px] px-5 py-4 flex flex-col items-center text-center gap-1" style={{ background: "radial-gradient(120% 90% at 50% 0%, rgba(245,184,0,.22), #0b0b0c 75%)", border: "1px solid rgba(245,184,0,.35)" }}>
              <span className="text-[38px] leading-none font-black tabular-nums">{reais(c.total)}</span>
              <span className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>{quando(c.criadaEm)} · {c.itens.length} {c.itens.length === 1 ? "item" : "itens"}</span>
            </section>

            {c.feitos.length > 0 && (
              <section className="rounded-[18px] px-4 py-3.5 flex flex-col gap-3" style={CARTAO}>
                <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: OURO }}>VIROU ESTOQUE</span>
                {c.feitos.map((f) => (
                  <div key={f.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[15px] font-black">{f.nome}</span>
                      <span className="text-[24px] leading-none font-black tabular-nums" style={{ color: OURO }}>+{f.unidades.toLocaleString("pt-BR")}</span>
                    </div>
                    {f.custo > 0 && (
                      <div className="flex items-baseline justify-between gap-2 rounded-[12px] px-3 py-2" style={{ background: "rgba(245,184,0,.08)", border: "1px solid rgba(245,184,0,.3)" }}>
                        <span className="text-[12.5px] font-extrabold" style={{ color: "#b9b3a6" }}>Custo de cada (hoje)</span>
                        <span className="text-[19px] leading-none font-black tabular-nums" style={{ color: OURO }}>{reais(f.custo)}</span>
                      </div>
                    )}
                    <span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>{f.levas} {f.levas === 1 ? "leva" : "levas"} da receita</span>
                    {sobra.data?.[f.id] && f.levas > 0 && (
                      <MercadoSobra nome={`${f.nome} · agora`} itens={sobra.data[f.id] ?? []} porLeva={Math.round(f.unidades / f.levas)} custo={f.custo} />
                    )}
                  </div>
                ))}
              </section>
            )}

            <section className="rounded-[18px] px-4 py-3.5 flex flex-col gap-2" style={CARTAO}>
              <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: OURO }}>O QUE VOCÊ COMPROU</span>
              {c.itens.map((i, k) => {
                const unidades = i.pacote > 1 ? i.qtd / i.pacote : i.qtd;
                const preco = unidades > 0 ? i.total / unidades : 0;
                return (
                  <div key={`${i.nome}-${k}`} className="flex items-baseline justify-between gap-2 text-[13px] font-bold">
                    <span className="min-w-0 truncate">{i.nome} <span style={{ color: "#7b766e" }}>· {textoEstoque(i.qtd, i.unidade, i.pacote)}</span></span>
                    <span className="shrink-0 tabular-nums text-right">{reais(i.total)}{preco > 0 && unidades > 1 ? <span style={{ color: "#7b766e" }}> · {reais(preco)} un</span> : null}</span>
                  </div>
                );
              })}
              {c.itens.length === 0 && <span className="text-[12.5px]" style={{ color: "#7b766e" }}>Compra lançada só pelo total.</span>}
            </section>
          </>
        )}
        <div className="flex-grow" />
        <div className="sticky bottom-0 -mx-4 px-4 pt-3 flex flex-col gap-2 bg-black" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}>
          <BotaoOuro onClick={() => onEditar(id)}>EDITAR COMPRA</BotaoOuro>
          <button type="button" onClick={onFechar} className="w-full h-12 rounded-2xl font-extrabold" style={{ background: "#121211", border: "1px solid #26241f" }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
