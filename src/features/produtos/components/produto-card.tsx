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
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-[5px] text-[12px] font-extrabold leading-none whitespace-nowrap" style={{ color: cor, background: `${cor}1c`, border: `1px solid ${cor}45` }}>
      <Icone className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} /> {texto}
    </span>
  );
  if (painel?.receita === "incompleta") return pill(OURO, FileText, "Receita incompleta");
  if (est === "sem") return pill(VERM, AlertCircle, "Sem estoque");
  if (est === "baixo") return pill(LARANJA, AlertCircle, "Repor estoque");
  if (painel?.podeProduzir) return pill(VERDE, Check, "Pronto para produzir");
  if (painel?.receita === "completa") return pill(VERDE, Check, "Receita completa");
  return null;
}

/** "R$" small, the number big: three values fit side by side on a 360 px phone */
function Valor({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  const [moeda, numero] = valor.startsWith("R$") ? ["R$", valor.slice(2).trim()] : ["", valor];
  return (
    <span className="flex flex-col gap-1 min-w-0 px-2 first:pl-0 last:pr-0">
      <span className="text-[11.5px] font-bold leading-none whitespace-nowrap" style={{ color: CINZA }}>{rotulo}</span>
      <span className="font-black tabular-nums whitespace-nowrap leading-none tracking-tight" style={{ color: cor ?? "#F4F1EA" }}>
        {moeda && <span className="text-[11px] font-extrabold mr-[2px]">{moeda}</span>}<span className="text-[16px]">{numero}</span>
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
  // with an incomplete recipe the saved cost is only part of the real one: no "final" margin
  const margem = temPreco && p.cost > 0 ? reais(l.sobra) : "—";
  const sabores = painel?.sabores ?? [];
  const combo = p.faixas[0];
  const corEstoque = est === "sem" ? VERM : est === "baixo" ? LARANJA : "#F4F1EA";
  const borda = est === "sem" ? "rgba(255,107,94,.45)" : est === "baixo" ? "rgba(255,154,61,.5)" : painel?.podeProduzir ? "rgba(61,214,140,.45)" : "#2a2722";
  return (
    <article className="w-full rounded-[20px] overflow-hidden flex" style={{ background: "#151515", border: `1px solid ${borda}` }}>
      <FotoDoCard produtoId={p.id} foto={p.photo_url} emoji={p.emoji} nome={p.name} i={i} onAbrir={onClick} />
      <button type="button" onClick={onClick} aria-label={`Abrir ${p.name}`} className="flex-1 min-w-0 px-3 pt-3 pb-2.5 flex flex-col gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B800]">
        <span className="flex items-start gap-1.5">
          <span className="flex-1 min-w-0 flex flex-col gap-1.5">
            <span className="text-[18px] font-black leading-tight line-clamp-2 break-words">{p.name}</span>
            {(sabores.length > 0 || combo) && (
              <span className="text-[12.5px] font-bold leading-snug line-clamp-2" style={{ color: "#a8a297" }}>
                {sabores.length > 0 ? sabores.join(", ") : ""}{sabores.length > 0 && combo ? " · " : ""}{combo ? `${combo.qty} por ${reais(combo.price).replace(",00", "")}` : ""}
              </span>
            )}
            <span className="flex"><Status p={p} painel={painel} /></span>
          </span>
          <ChevronRight className="w-5 h-5 shrink-0 mt-0.5 -mr-1" style={{ color: "#8a857b" }} />
        </span>
        {incompleta ? (
          // incomplete recipe: two columns (room for "Custo parcial") and the margin said, not computed
          <span className="flex flex-col gap-2">
            <span className="grid grid-cols-2 divide-x divide-[#2a2722]">
              <Valor rotulo="Venda" valor={venda} />
              <Valor rotulo="Custo parcial" valor={custo} />
            </span>
            <span className="text-[12px] font-bold leading-snug" style={{ color: "#a8a297" }}>Margem: <span style={{ color: OURO }}>a calcular</span> quando a receita estiver completa.</span>
          </span>
        ) : (
          <span className="grid grid-cols-3 divide-x divide-[#2a2722]">
            <Valor rotulo="Venda" valor={venda} />
            <Valor rotulo="Custo" valor={custo} />
            <Valor rotulo="Margem" valor={margem} cor={margem !== "—" ? (l.sobra > 0 ? VERDE : VERM) : undefined} />
          </span>
        )}
        <span className="flex items-center flex-wrap gap-x-1.5 gap-y-1.5 pt-2.5 text-[13px] font-bold" style={{ borderTop: "1px solid #24221e" }}>
          <Package className="w-4 h-4 shrink-0" style={{ color: CINZA }} />
          <span style={{ color: "#c9c3b5" }}>Estoque:</span>
          <span className="font-black whitespace-nowrap" style={{ color: corEstoque }}>{est === "sem_controle" ? (p.origem === "faz" ? "feito na hora" : "sem controle") : `${p.stock_quantity} un`}</span>
          {incompleta && <span className="ml-auto text-[13px] font-black whitespace-nowrap" style={{ color: OURO }}>Completar receita →</span>}
        </span>
      </button>
    </article>
  );
}
