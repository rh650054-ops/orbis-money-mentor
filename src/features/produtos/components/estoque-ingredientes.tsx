/* Aba Estoque, D (25/11): the ingredients, with search and filters, each in its own unit ("1 un" is
   never read as 1 litre). Tapping one shows what it is used in and its recent movements. */
import { useState } from "react";
import { Search, X } from "lucide-react";
import type { CatalogoProducao } from "../lib/producao";
import { pareceCusto, qtdNaTela, type SituacaoIngrediente } from "../lib/estoque";
import { useMovimentosIngredienteQuery } from "../api/use-movimentos-ingrediente";

type Filtro = "todos" | SituacaoIngrediente;
const FILTROS: [Filtro, string][] = [["todos", "Todos"], ["disponivel", "Disponíveis"], ["baixo", "Estoque baixo"], ["esgotado", "Esgotados"]];
const COR: Record<SituacaoIngrediente, string> = { disponivel: "#F4F1EA", baixo: "#FF9A3D", esgotado: "#FF6B5E" };
const n = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " ·");

export function EstoqueIngredientes({ c, situacao, usadoEm }: { c: CatalogoProducao; situacao: Map<string, SituacaoIngrediente>; usadoEm: (id: string) => string[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const t = busca.trim().toLowerCase();
  const lista = c.ingredientes.filter((i) => (!t || i.name.toLowerCase().includes(t)) && (filtro === "todos" || situacao.get(i.id) === filtro));
  if (c.ingredientes.length === 0) return <p className="text-[12.5px] px-1" style={{ color: "#7b766e" }}>Nenhum ingrediente ainda. Eles aparecem quando você monta a receita na ficha do produto.</p>;
  return (
    <div className="flex flex-col gap-2">
      <label className="h-10 rounded-[12px] px-3 flex items-center gap-2" style={{ background: "#151515", border: "1px solid #2a2722" }}>
        <Search className="w-4 h-4 shrink-0" style={{ color: "#8f897e" }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ingrediente" aria-label="Buscar ingrediente" className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-semibold" />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map(([f, r]) => (
          <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)} className="shrink-0 rounded-full px-3 h-8 text-[12px] font-extrabold"
            style={filtro === f ? { background: "#F5B800", color: "#1A1200" } : { background: "#151515", border: "1px solid #2a2722", color: "#d8d2c4" }}>{r}</button>
        ))}
      </div>
      <div className="rounded-[14px] overflow-hidden" style={{ border: "1px solid #2a2722" }}>
        {lista.length === 0 && <p className="px-3.5 py-3 text-[12.5px]" style={{ background: "#151515", color: "#7b766e" }}>Nada nesse filtro.</p>}
        {lista.map((i, k) => {
          const s = situacao.get(i.id) ?? "disponivel";
          const custo = pareceCusto(i.name);
          return (
            <button key={i.id} type="button" onClick={() => setAberto(i.id)} className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left" style={{ background: "#151515", borderTop: k ? "1px solid #1f1d1a" : undefined }}>
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-[13.5px] font-extrabold truncate">{i.name}</span>
                {custo && <span className="text-[11px] font-bold" style={{ color: "#F5B800" }}>parece custo, não ingrediente</span>}
              </span>
              <span className="shrink-0 flex flex-col items-end">
                <span className="text-[13.5px] font-extrabold tabular-nums" style={{ color: custo ? "#8f897e" : COR[s] }}>{qtdNaTela(i.stock_quantity, i.unit, i.pacote_qtd).principal}</span>
                {qtdNaTela(i.stock_quantity, i.unit, i.pacote_qtd).sub && <span className="text-[10.5px] font-semibold" style={{ color: "#8f897e" }}>{qtdNaTela(i.stock_quantity, i.unit, i.pacote_qtd).sub}</span>}
              </span>
            </button>
          );
        })}
      </div>
      {aberto && <Detalhe c={c} id={aberto} usadoEm={usadoEm(aberto)} onFechar={() => setAberto(null)} />}
    </div>
  );
}

function Detalhe({ c, id, usadoEm, onFechar }: { c: CatalogoProducao; id: string; usadoEm: string[]; onFechar: () => void }) {
  const i = c.ingredientes.find((x) => x.id === id);
  const mov = useMovimentosIngredienteQuery(id);
  if (!i) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end" style={{ background: "rgba(0,0,0,.65)" }} onClick={onFechar}>
      <div className="w-full max-w-md mx-auto rounded-t-[22px] px-4 pt-4 flex flex-col gap-3 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
        style={{ background: "#121212", border: "1px solid #2a2722", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
        <div className="flex items-start gap-2">
          <span className="flex-1 flex flex-col">
            <span className="text-[17px] font-black">{i.name}</span>
            <span className="text-[13px] font-bold" style={{ color: "#c9c3b5" }}>Tem {qtdNaTela(i.stock_quantity, i.unit, i.pacote_qtd).principal}{qtdNaTela(i.stock_quantity, i.unit, i.pacote_qtd).sub ? ` · ${qtdNaTela(i.stock_quantity, i.unit, i.pacote_qtd).sub}` : ""}</span>
          </span>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1" style={{ color: "#8f897e" }}><X className="w-5 h-5" /></button>
        </div>
        {pareceCusto(i.name) && <p className="text-[12.5px] font-bold leading-snug rounded-[12px] px-3 py-2" style={{ background: "#1a1305", color: "#F5B800" }}>Isso parece custo (mão de obra, gás, taxa), não algo que fica guardado. Na receita, ele deve ir em "custos sem estoque" para não bloquear a produção.</p>}
        <span className="text-[12px] font-bold" style={{ color: "#8f897e" }}>Usado em: {usadoEm.length ? usadoEm.join(", ") : "nenhuma receita"}</span>
        <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>ÚLTIMAS MOVIMENTAÇÕES</span>
        {mov.isLoading && <span className="text-[12px]" style={{ color: "#8f897e" }}>Carregando…</span>}
        {mov.data?.length === 0 && <span className="text-[12px]" style={{ color: "#8f897e" }}>Nenhuma compra ou produção registrada ainda.</span>}
        {mov.data?.map((m, k) => (
          <div key={k} className="flex justify-between gap-2 text-[12.5px] font-bold">
            <span style={{ color: "#c9c3b5" }}>{quando(m.quando)} · {m.tipo === "compra" ? "Compra" : "Produção"}</span>
            <span className="tabular-nums" style={{ color: m.quantidade >= 0 ? "#3DD68C" : "#FF9A3D" }}>{m.quantidade >= 0 ? "+" : ""}{n(m.quantidade)} {i.unit}</span>
          </div>
        ))}
        <p className="text-[11px] font-semibold leading-snug" style={{ color: "#7b766e" }}>Para corrigir a quantidade, registre a compra no Mercado ou corrija a produção na tela Produção: os dois guardam o histórico.</p>
      </div>
    </div>
  );
}
