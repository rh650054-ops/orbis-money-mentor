/* Produtos e Estoque (24/11/2026, Rick's approved mockup): one product per card. Left: the seller's own
   photo (he adds it right on the card), in a column that never takes more than ~30% of the card. Right:
   name, flavours and ONE status, then Venda | Custo | Margem and the real stock. An incomplete recipe
   shows its saved cost as "Custo parcial" and no margin as if it were final profit (the real cost is
   higher once the recipe is complete), with the way to complete it. */
import { AlertCircle, Check, ChevronRight, FileText, Package } from "lucide-react";
import { lucroDe } from "../lib/conta";
import { situacaoDoEstoque, type PainelDoProduto } from "../lib/painel";
import type { ProdutoComFaixas } from "../types";
import { reais } from "./campos";
import { FotoDoCard } from "./foto-do-card";

/** kept for the "Estoque •" tab dot */
export function estoqueBaixo(p: ProdutoComFaixas): boolean {
  const s = situacaoDoEstoque(p);
  return s === "baixo" || s === "sem";
}

const VERDE = "#3DD68C", OURO = "#F5B800", LARANJA = "#FF9A3D", VERM = "#FF6B5E", CINZA = "#8a857b";

function Status({ p, painel }: { p: ProdutoComFaixas; painel?: PainelDoProduto }) {
  const est = situacaoDoEstoque(p);
  const pill = (cor: string, Icone: typeof Check, texto: string) => (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-bold leading-none whitespace-nowrap" style={{ color: cor, background: `${cor}1c`, border: `1px solid ${cor}45` }}>
      <Icone className="w-3 h-3 shrink-0" strokeWidth={2.5} /> {texto}
    </span>
  );
  // 25/11 (Rick): stock and recipe are different things — one discrete pill for each, when it matters
  const estoque = est === "ok" ? pill(VERDE, Check, "Em estoque") : est === "baixo" ? pill(LARANJA, AlertCircle, "Estoque baixo") : est === "sem" ? pill(VERM, AlertCircle, "Sem estoque") : null;
  const receita = painel?.receita === "incompleta" ? pill(CINZA, FileText, "Receita incompleta") : null;
  if (!estoque && !receita) return null;
  return <span className="inline-flex flex-wrap gap-1">{estoque}{receita}</span>;
}

/** "R$" small, the number big: three values fit side by side on a 360 px phone */
function Valor({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  const [moeda, numero] = valor.startsWith("R$") ? ["R$", valor.slice(2).trim()] : ["", valor];
  return (
    <span className="flex flex-col gap-1 min-w-0 px-2 first:pl-0 last:pr-0">
      <span className="text-[10.5px] font-semibold leading-none whitespace-nowrap" style={{ color: CINZA }}>{rotulo}</span>
      <span className="font-extrabold tabular-nums whitespace-nowrap leading-none tracking-tight" style={{ color: cor ?? "#F4F1EA" }}>
        {moeda && <span className="text-[11px] mr-[2px]">{moeda}</span>}<span className="text-[15px]">{numero}</span>
      </span>
    </span>
  );
}

export function ProdutoCard({ p, i, painel, onClick }: { p: ProdutoComFaixas; i: number; painel?: PainelDoProduto; onClick: () => void }) {
  const est = situacaoDoEstoque(p);
  const temPreco = !p.open_price && p.sale_price > 0;
  const l = lucroDe(p.sale_price, p.cost);
  const venda = p.open_price ? "Na hora" : temPreco ? reais(p.sale_price) : "—";
  const incompleta = painel?.receita === "incompleta";
  const custo = p.cost > 0 ? reais(p.cost) : "—";
  const margem = temPreco && p.cost > 0 ? reais(l.sobra) : "—";
  const sabores = painel?.sabores ?? [];
  const combo = p.faixas[0];
  const corEstoque = est === "sem" ? VERM : est === "baixo" ? LARANJA : "#F4F1EA";
  // 25/11 (Rick): stock in order = green outline, like the approved mockup; low = orange; out = red
  const borda = est === "sem" ? "rgba(255,107,94,.55)" : est === "baixo" ? "rgba(255,154,61,.6)" : est === "ok" || painel?.podeProduzir ? "rgba(61,214,140,.6)" : "#2a2722";
  // sizes taken from the approved mockup at 390 px: a card is ~106 px tall, photo column 84 px
  return (
    <article className="w-full rounded-[16px] overflow-hidden flex" style={{ background: "#151515", border: `1px solid ${borda}` }}>
      <FotoDoCard produtoId={p.id} foto={p.photo_url} emoji={p.emoji} nome={p.name} i={i} onAbrir={onClick} />
      <button type="button" onClick={onClick} aria-label={`Abrir ${p.name}`} className="flex-1 min-w-0 px-3 pt-2.5 pb-2 flex flex-col gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B800]">
        <span className="flex items-start gap-1">
          {/* name and status share the first line; the status drops below when the name is long */}
          <span className="flex-1 min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="min-w-0 max-w-full text-[15.5px] font-extrabold leading-tight truncate">{p.name}</span>
            <Status p={p} painel={painel} />
          </span>
          <ChevronRight className="w-[18px] h-[18px] shrink-0 mt-[1px] -mr-1" style={{ color: "#c9c3b5" }} />
        </span>
        {(sabores.length > 0 || combo) && (
          <span className="-mt-1 text-[11px] font-semibold leading-tight truncate" style={{ color: "#8f897e" }}>
            {sabores.length > 0 ? sabores.join(", ") : ""}{sabores.length > 0 && combo ? " · " : ""}{combo ? `${combo.qty} por ${reais(combo.price).replace(",00", "")}` : ""}
          </span>
        )}
        <span className={`grid divide-x divide-[#2a2722] ${incompleta ? "grid-cols-[1fr_1.25fr_.75fr]" : "grid-cols-3"}`}>
          <Valor rotulo="Venda" valor={venda} />
          {/* incomplete recipe: the saved cost is only part of the real one, so no margin is shown as profit */}
          <Valor rotulo={incompleta ? "Custo parcial" : "Custo"} valor={custo} />
          <Valor rotulo="Margem" valor={incompleta ? "—" : margem} cor={!incompleta && margem !== "—" ? (l.sobra > 0 ? VERDE : VERM) : undefined} />
        </span>
        <span className="flex items-center gap-1.5 pt-1.5 text-[12px] font-semibold" style={{ borderTop: "1px solid #24221e" }}>
          <Package className="w-3.5 h-3.5 shrink-0" style={{ color: CINZA }} />
          <span style={{ color: "#c9c3b5" }}>Estoque:</span>
          <span className="font-extrabold whitespace-nowrap" style={{ color: corEstoque }}>{est === "sem_controle" ? (p.origem === "faz" ? "feito na hora" : "sem controle") : `${p.stock_quantity} un`}</span>
          {incompleta && <span className="ml-auto text-[11.5px] font-extrabold whitespace-nowrap" style={{ color: OURO }}>Completar receita →</span>}
        </span>
      </button>
    </article>
  );
}
