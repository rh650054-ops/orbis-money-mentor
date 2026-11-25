/* VANT Receita Inteligente (quiz and product sheet). 25/11 (Rick): three steps on one screen —
   1 · Seu produto (how many units the recipe yields), 2 · Receita Inteligente split into
   "Ingredientes da receita" (per recipe) and "Custos de cada unidade" (bottle, sticker, labour…),
   3 · Seu resultado. A line moves between the two lists without being typed again. Until the
   database has the per-unit migration, the editor is the single per-recipe list it always was. */
import { Plus } from "lucide-react";
import { useReceitaPorUnidadeDisponivel } from "../api/use-receita-por-unidade";
import { useIngredientesGuardadosQuery } from "../api/use-ingredientes-guardados-query";
import { pareceCusto } from "../lib/estoque";
import { linhasRepetidas, novoIngrediente, precoDe1, qtdNaLeva, resumoDoCusto, type CustoExtra, type IngredienteRascunho, type PorConsumo } from "../lib/receitas";
import { CustosSemEstoque } from "./custos-sem-estoque";
import { LinhaIngrediente } from "./linha-ingrediente";
import { MiniNumero } from "./mini-campos";
import { ResumoDoCusto } from "./resumo-custo";

export { LinhaIngrediente } from "./linha-ingrediente";

const Etapa = ({ n, titulo, sub }: { n: number; titulo: string; sub?: string }) => (
  <div className="flex items-start gap-2 mt-1">
    <span className="w-6 h-6 rounded-full flex items-center justify-center text-[12px] font-black shrink-0" style={{ background: "#F5B800", color: "#1A1200" }}>{n}</span>
    <div className="flex flex-col">
      <span className="text-[15px] font-black leading-tight">{titulo}</span>
      {sub && <span className="text-[11.5px] font-bold leading-snug" style={{ color: "#8f897e" }}>{sub}</span>}
    </div>
  </div>
);
const Grupo = ({ titulo, sub }: { titulo: string; sub: string }) => (
  <div className="flex flex-col pt-1">
    <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>{titulo}</span>
    <span className="text-[11.5px] font-bold" style={{ color: "#8f897e" }}>{sub}</span>
  </div>
);

export function EditorReceita({ itens, rende, onItens, onRende, estoques, nomeProduto = "unidades", precoVenda, resumoFixo, extras = [], onExtras }: {
  itens: IngredienteRascunho[]; rende: number;
  onItens: (i: IngredienteRascunho[]) => void; onRende: (n: number) => void;
  /** stock of each ingredient by name (lower case), when it exists */
  estoques?: Map<string, number>;
  nomeProduto?: string;
  /** 24/11: with a sale price, the live summary shows the estimated contribution margin */
  precoVenda?: number;
  /** the live cost stays on screen while scrolling (registration) */
  resumoFixo?: boolean;
  /** 25/11: costs without stock (labour, fees); without onExtras the per-unit part is not offered */
  extras?: CustoExtra[]; onExtras?: (e: CustoExtra[]) => void;
}) {
  const guardados = useIngredientesGuardadosQuery().data ?? [];
  const porUnidade = useReceitaPorUnidadeDisponivel().data === true && !!onExtras;
  const mudar = (i: number, m: Partial<IngredienteRascunho>) => onItens(itens.map((it, j) => (j === i ? { ...it, ...m } : it)));
  const mover = (i: number, por: PorConsumo) => mudar(i, { por, confirmar: false });
  const repetidas = linhasRepetidas(itens);
  // before the migration nothing is per unit and nothing is asked
  const contas = porUnidade ? itens : itens.map((i) => ({ ...i, por: "receita" as const, confirmar: false }));
  const resumo = resumoDoCusto(contas, rende, porUnidade ? extras : []);
  // 25/11 (Rick, Estoque): labour typed as an ingredient ("Produção", stock 0) blocks every production.
  // One tap moves it to the costs without stock, keeping its cost (per unit when the yield is known).
  const paraCusto = (i: number) => {
    const it = itens[i]!;
    const total = qtdNaLeva(it, rende) * precoDe1(it);
    onItens(itens.filter((_, j) => j !== i));
    onExtras?.([...extras, rende >= 1 ? { nome: it.nome.trim(), valor: Math.round((total / rende) * 100) / 100, por: "unidade" } : { nome: it.nome.trim(), valor: Math.round(total * 100) / 100, por: "receita" }]);
  };
  const linha = (it: IngredienteRascunho, i: number) => (
    <div key={i} className="flex flex-col gap-1">
    {porUnidade && it.usa && pareceCusto(it.nome) && (
      <button type="button" onClick={() => paraCusto(i)} className="self-start rounded-full px-3 py-1.5 text-[12px] font-extrabold" style={{ background: "#1a1305", border: "1px solid rgba(245,184,0,.45)", color: "#F5B800" }}>
        {it.nome.trim()} é custo, não ingrediente: mover para custos sem estoque
      </button>
    )}
    <LinhaIngrediente it={porUnidade ? it : { ...it, por: "receita", confirmar: false }} rende={rende} nomeProduto={nomeProduto} repetido={repetidas.has(i)}
      estoque={estoques?.get(it.nome.trim().toLowerCase())} onMudar={(m) => mudar(i, m)} {...(porUnidade ? { onMover: (p: PorConsumo) => mover(i, p) } : {})}
      sugestoes={guardados.filter((g) => !itens.some((x, j) => j !== i && x.id === g.id))} />
    </div>
  );
  const adicionar = (por: PorConsumo, rotulo: string) => (
    <button type="button" onClick={() => onItens([...itens, novoIngrediente("", por === "unidade" ? 1 : 0, por)])}
      className="flex items-center gap-1 text-[12.5px] font-black px-0.5 py-1 self-start" style={{ color: "#F5B800" }}>
      <Plus className="w-3.5 h-3.5" /> {rotulo}
    </button>
  );
  const daReceita = itens.map((it, i) => [it, i] as const).filter(([it]) => !porUnidade || it.por !== "unidade");
  const deCada = itens.map((it, i) => [it, i] as const).filter(([it]) => porUnidade && it.por === "unidade");
  return (
    <div className="flex flex-col gap-2.5">
      <Etapa n={1} titulo="Seu produto" />
      {/* 24/11 (Receita Inteligente): the yield comes first and is always HIS number */}
      <div className="flex flex-col gap-2 rounded-[14px] px-3 py-3" style={{ background: "#151515", border: `1px solid ${rende >= 1 ? "#26241f" : "#F5B800"}` }}>
        <span className="text-[15px] font-black">Quantas unidades essa receita rende?</span>
        <div className="flex items-center gap-2">
          <MiniNumero valor={rende} largura={84} exemplo="?" rotulo="Quanto a receita rende" onChange={(n) => onRende(Math.max(0, Math.round(n)))} />
          <span className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>{nomeProduto}</span>
        </div>
        {!(rende >= 1) && <span className="text-[11.5px] font-bold" style={{ color: "#F5B800" }}>Ex.: 5 garrafinhas de 300 ml. Só você sabe esse número: a VANT nunca calcula sozinha.</span>}
      </div>

      <Etapa n={2} titulo="Receita Inteligente" sub="Para cada item: quanto compra, quanto paga e quanto usa. A VANT calcula o resto." />
      {porUnidade && <Grupo titulo="INGREDIENTES DA RECEITA" sub="Vão uma vez em cada receita: leite condensado, creme de leite, fruta, leite." />}
      {daReceita.map(([it, i]) => linha(it, i))}
      {adicionar("receita", "adicionar ingrediente")}
      {porUnidade && (
        <>
          <Grupo titulo="CUSTOS DE CADA UNIDADE" sub={`Vão em cada ${nomeProduto.replace(/s$/, "")}: garrafa, adesivo, canudo, recheio individual.`} />
          {deCada.map(([it, i]) => linha(it, i))}
          {adicionar("unidade", "adicionar item de cada unidade")}
          <Grupo titulo="CUSTOS SEM ESTOQUE" sub="Mão de obra, gás e outros: entram no custo e não saem do estoque." />
          <CustosSemEstoque extras={extras} rende={rende} onMudar={onExtras!} />
        </>
      )}

      <Etapa n={3} titulo="Seu resultado" />
      {resumo.total > 0 || rende >= 1
        ? <ResumoDoCusto r={resumo} rende={rende} nomeProduto={nomeProduto} precoVenda={precoVenda} fixo={resumoFixo} />
        : <p className="text-[11.5px] font-bold px-1" style={{ color: "#8A8A8A" }}>Sem preço? Tudo bem: o custo aparece quando você anotar a compra no "Tô no mercado".</p>}
    </div>
  );
}
