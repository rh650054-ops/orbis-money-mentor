/* Aba Estoque, D (25/11): the ingredients, with search and filters, each in its own unit ("1 un" is
   never read as 1 litre). Legible rows (name left, quantity right, a dot when low or out); tapping
   one opens its sheet: stock, unit, package content, last price, "Ajustar estoque" and history. */
import { useState } from "react";
import { ChevronRight, Search, X } from "lucide-react";
import type { CatalogoProducao } from "../lib/producao";
import { pareceCusto, qtdNaTela, type SituacaoIngrediente } from "../lib/estoque";
import { useMovimentosIngredienteQuery } from "../api/use-movimentos-ingrediente";
import { useAjustarEstoqueMutation, useAjusteDisponivel } from "../api/use-ajuste-estoque";
import { reais } from "./campos";
import { MiniNumero } from "./mini-campos";

type Filtro = "todos" | SituacaoIngrediente;
const FILTROS: [Filtro, string][] = [["todos", "Todos"], ["disponivel", "Disponíveis"], ["baixo", "Baixo"], ["esgotado", "Esgotados"]];
const COR: Record<SituacaoIngrediente, string> = { disponivel: "#F4F1EA", baixo: "#FF9A3D", esgotado: "#FF6B5E" };
const n = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).replace(",", " ·");

export function EstoqueIngredientes({ c, situacao, usadoEm }: { c: CatalogoProducao; situacao: Map<string, SituacaoIngrediente>; usadoEm: (id: string) => string[] }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [aberto, setAberto] = useState<string | null>(null);
  const t = busca.trim().toLowerCase();
  // 25/11 (Rick): a cost typed as an ingredient ("Produção") is not goods on a shelf: never listed here
  // (the row is kept in the database; "O que precisa de atenção?" still points to it)
  const fisicos = c.ingredientes.filter((i) => !pareceCusto(i.name));
  const lista = fisicos.filter((i) => (!t || i.name.toLowerCase().includes(t)) && (filtro === "todos" || situacao.get(i.id) === filtro));
  if (fisicos.length === 0) return <p className="text-[13px] px-1" style={{ color: "#7b766e" }}>Nenhum ingrediente ainda. Eles aparecem quando você monta a receita na ficha do produto.</p>;
  return (
    <div className="flex flex-col gap-2.5">
      <label className="h-11 rounded-[14px] px-3.5 flex items-center gap-2" style={{ background: "#151515", border: "1px solid #2a2722" }}>
        <Search className="w-4 h-4 shrink-0" style={{ color: "#8f897e" }} />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar ingrediente" aria-label="Buscar ingrediente" className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-semibold" />
      </label>
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
        {FILTROS.map(([f, r]) => (
          <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)} className="shrink-0 rounded-full px-3.5 h-9 text-[13px] font-extrabold"
            style={filtro === f ? { background: "#F5B800", color: "#1A1200" } : { background: "#151515", border: "1px solid #2a2722", color: "#d8d2c4" }}>{r}</button>
        ))}
      </div>
      <div className="rounded-[16px] overflow-hidden" style={{ background: "#151515", border: "1px solid #2a2722" }}>
        {lista.length === 0 && <p className="px-4 py-4 text-[13px]" style={{ color: "#7b766e" }}>Nada nesse filtro.</p>}
        {lista.map((i, k) => {
          const s = situacao.get(i.id) ?? "disponivel";
          return (
            <button key={i.id} type="button" onClick={() => setAberto(i.id)} aria-label={`Abrir ${i.name}`}
              className="w-full min-h-[56px] flex items-center gap-3 px-4 py-3 text-left active:bg-[#1c1c1c]" style={{ borderTop: k ? "1px solid #22201c" : undefined }}>
              <span className="flex-1 min-w-0 text-[15px] font-bold truncate" style={{ color: "#F4F1EA" }}>{i.name}</span>
              {s !== "disponivel" && <span className="w-2 h-2 rounded-full shrink-0" aria-label={s === "esgotado" ? "esgotado" : "estoque baixo"} style={{ background: COR[s] }} />}
              <span className="shrink-0 text-[15px] font-extrabold tabular-nums" style={{ color: COR[s] }}>{qtdNaTela(i.stock_quantity, i.unit).principal}</span>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "#5a564e" }} />
            </button>
          );
        })}
      </div>
      {aberto && <Detalhe c={c} id={aberto} usadoEm={usadoEm(aberto)} onFechar={() => setAberto(null)} />}
    </div>
  );
}

const Caixa = ({ k, v }: { k: string; v: string }) => (
  <span className="rounded-[12px] px-3 py-2.5 flex flex-col gap-0.5" style={{ background: "#181818" }}>
    <span className="text-[11px] font-bold" style={{ color: "#8f897e" }}>{k}</span>
    <span className="text-[14px] font-extrabold">{v}</span>
  </span>
);
const NOME_UNIDADE: Record<string, string> = { un: "unidade (un)", g: "gramas (g)", kg: "quilos (kg)", ml: "mililitros (ml)", l: "litros (L)" };

function Detalhe({ c, id, usadoEm, onFechar }: { c: CatalogoProducao; id: string; usadoEm: string[]; onFechar: () => void }) {
  const i = c.ingredientes.find((x) => x.id === id);
  const mov = useMovimentosIngredienteQuery(id);
  const pode = useAjusteDisponivel().data === true;
  const [ajustando, setAjustando] = useState(false);
  if (!i) return null;
  const pacote = i.pacote_qtd && i.pacote_qtd > 1 ? i.pacote_qtd : 1;
  const preco = (i.cost_per_unit ?? 0) * pacote;
  // the package as registered (pote de 650 g, pacote de 100 un); a box counted by the unit has none
  const conteudo = pacote > 1 ? `${qtdNaTela(pacote, i.unit).principal} por embalagem` : null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end" style={{ background: "rgba(0,0,0,.65)" }} onClick={onFechar}>
      <div className="w-full max-w-md mx-auto rounded-t-[22px] px-4 pt-4 flex flex-col gap-3 max-h-[85dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}
        style={{ background: "#121212", border: "1px solid #2a2722", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
        <div className="flex items-start gap-2">
          <span className="flex-1 flex flex-col gap-0.5">
            <span className="text-[18px] font-black">{i.name}</span>
            <span className="text-[12px] font-bold" style={{ color: "#8f897e" }}>Estoque atual</span>
            <span className="text-[28px] font-extrabold tabular-nums leading-tight">{qtdNaTela(i.stock_quantity, i.unit).principal}</span>
          </span>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1" style={{ color: "#8f897e" }}><X className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Caixa k="Unidade de medida" v={NOME_UNIDADE[i.unit] ?? i.unit} />
          <Caixa k="Último preço" v={preco > 0 ? `${reais(preco)}${pacote > 1 ? " a compra" : ` por ${i.unit}`}` : "sem preço"} />
          {conteudo && <Caixa k="Conteúdo da embalagem" v={conteudo} />}
        </div>
        {pode && !ajustando && <button type="button" onClick={() => setAjustando(true)} className="h-12 rounded-[14px] text-[15px] font-extrabold" style={{ background: "#F5B800", color: "#1A1200" }}>Ajustar estoque</button>}
        {ajustando && <AjustarEstoque id={i.id} atual={i.stock_quantity} unidade={i.unit} onPronto={() => setAjustando(false)} />}
        {usadoEm.length > 0 && <span className="text-[12.5px] font-bold" style={{ color: "#8f897e" }}>Usado em: {usadoEm.join(", ")}</span>}
        <span className="text-[11px] font-black tracking-[.12em] mt-1" style={{ color: "#F5B800" }}>ÚLTIMAS MOVIMENTAÇÕES</span>
        {mov.isLoading && <span className="text-[12.5px]" style={{ color: "#8f897e" }}>Carregando…</span>}
        {mov.data?.length === 0 && <span className="text-[12.5px]" style={{ color: "#8f897e" }}>Nenhuma compra, produção ou ajuste ainda.</span>}
        {mov.data?.map((m, k) => (
          <div key={k} className="flex justify-between gap-2 text-[13px] font-bold">
            <span className="min-w-0 truncate" style={{ color: "#c9c3b5" }}>{quando(m.quando)} · {m.tipo === "compra" ? "Compra" : m.tipo === "producao" ? "Produção" : `Ajuste: ${m.motivo}`}</span>
            <span className="tabular-nums shrink-0" style={{ color: m.quantidade >= 0 ? "#3DD68C" : "#FF9A3D" }}>{m.quantidade >= 0 ? "+" : ""}{n(m.quantidade)} {i.unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOTIVOS = ["Contei e é diferente", "Perdeu ou estragou", "Usei fora da receita"];
/** A physical count, not a purchase: the counted number + a reason, recorded with history. */
function AjustarEstoque({ id, atual, unidade, onPronto }: { id: string; atual: number; unidade: string; onPronto: () => void }) {
  const [contado, setContado] = useState(Math.max(0, atual));
  const [motivo, setMotivo] = useState(MOTIVOS[0]!);
  const m = useAjustarEstoqueMutation();
  return (
    <div className="rounded-[14px] px-3 py-3 flex flex-col gap-2.5" style={{ background: "#181818", border: "1px solid rgba(245,184,0,.35)" }}>
      <span className="text-[13px] font-bold" style={{ color: "#c9c3b5" }}>Quanto você tem de verdade agora?</span>
      <div className="flex items-center gap-2">
        <MiniNumero valor={contado} largura={96} exemplo="0" rotulo="Quantidade contada" onChange={(v) => setContado(Math.max(0, v))} />
        <span className="text-[13px] font-bold" style={{ color: "#a8a297" }}>{unidade} · era {n(atual)}{contado !== atual ? ` · diferença ${contado > atual ? "+" : ""}${n(contado - atual)}` : ""}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {MOTIVOS.map((x) => (
          <button key={x} type="button" aria-pressed={motivo === x} onClick={() => setMotivo(x)} className="rounded-full px-3 h-8 text-[12px] font-extrabold"
            style={motivo === x ? { background: "#F5B800", color: "#1A1200" } : { background: "#121212", border: "1px solid #2c2a25", color: "#d8d2c4" }}>{x}</button>
        ))}
      </div>
      {m.isError && <span className="text-[12px] font-bold" style={{ color: "#FF6B5E" }}>Não consegui ajustar. Tente de novo.</span>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onPronto} className="h-10 rounded-[12px] text-[13px] font-extrabold" style={{ background: "#121212", border: "1px solid #2c2a25" }}>Cancelar</button>
        <button type="button" disabled={m.isPending || contado === atual} onClick={() => m.mutate({ ingrediente: id, contado, motivo }, { onSuccess: onPronto })}
          className="h-10 rounded-[12px] text-[13px] font-extrabold disabled:opacity-40" style={{ background: "#F5B800", color: "#1A1200" }}>{m.isPending ? "Salvando…" : "Salvar ajuste"}</button>
      </div>
      <span className="text-[10.5px] font-semibold" style={{ color: "#7b766e" }}>Fica no histórico. Não é compra: não entra custo nem Mercado.</span>
    </div>
  );
}
