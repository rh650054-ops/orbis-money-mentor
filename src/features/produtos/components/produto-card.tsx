/* Produtos e Estoque (24/11/2026, Rick's mockup): one product per card. Left: the seller's own photo (he
   adds it right on the card). Right: name and status, Venda | Custo | Margem, the real stock and, for an
   incomplete recipe, the way to complete it. The cost shown is the product's saved cost (24/11, Rick:
   the value, not "parcial"); an incomplete recipe is said by the status and "Completar receita". */
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
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap" style={{ color: cor, background: `${cor}1c`, border: `1px solid ${cor}40` }}>
      <Icone className="w-3.5 h-3.5" strokeWidth={2.5} /> {texto}
    </span>
  );
  if (painel?.receita === "incompleta") return pill("#d8d2c4", FileText, "Receita incompleta");
  if (est === "sem") return pill(VERM, AlertCircle, "Sem estoque");
  if (est === "baixo") return pill(LARANJA, AlertCircle, "Repor estoque");
  if (painel?.podeProduzir) return pill(VERDE, Check, "Pronto para produzir");
  if (painel?.receita === "completa") return pill(VERDE, Check, "Receita completa");
  return null;
}

function Valor({ rotulo, valor, cor }: { rotulo: string; valor: string; cor?: string }) {
  return (
    <span className="flex flex-col gap-0.5 min-w-0 px-1.5 first:pl-0">
      <span className="text-[11px] font-semibold" style={{ color: CINZA }}>{rotulo}</span>
      <span className="text-[13.5px] font-black tabular-nums whitespace-nowrap tracking-tight" style={{ color: cor ?? "#F4F1EA" }}>{valor}</span>
    </span>
  );
}

export function ProdutoCard({ p, i, painel, onClick }: { p: ProdutoComFaixas; i: number; painel?: PainelDoProduto; onClick: () => void }) {
  const est = situacaoDoEstoque(p);
  const temPreco = !p.open_price && p.sale_price > 0;
  const l = lucroDe(p.sale_price, p.cost);
  const venda = p.open_price ? "Na hora" : temPreco ? reais(p.sale_price) : "—";
  const custo = p.cost > 0 ? reais(p.cost) : "—";
  const margem = temPreco && p.cost > 0 ? reais(l.sobra) : "—";
  const incompleta = painel?.receita === "incompleta";
  const sabores = painel?.sabores ?? [];
  const combo = p.faixas[0];
  const corEstoque = est === "sem" ? VERM : est === "baixo" ? LARANJA : "#F4F1EA";
  const borda = est === "sem" ? "rgba(255,107,94,.45)" : est === "baixo" ? "rgba(255,154,61,.5)" : painel?.podeProduzir ? "rgba(61,214,140,.45)" : "#2a2722";
  return (
    <article className="w-full rounded-[20px] overflow-hidden flex" style={{ background: "#151515", border: `1px solid ${borda}` }}>
      <FotoDoCard produtoId={p.id} foto={p.photo_url} emoji={p.emoji} nome={p.name} i={i} onAbrir={onClick} />
      <button type="button" onClick={onClick} aria-label={`Abrir ${p.name}`} className="flex-1 min-w-0 p-3 flex flex-col gap-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F5B800]">
        <span className="flex items-start gap-2">
          <span className="flex-1 min-w-0 flex flex-col gap-1">
            <span className="text-[17px] font-black leading-tight truncate">{p.name}</span>
            {(sabores.length > 0 || combo) && (
              <span className="text-[11.5px] font-bold truncate" style={{ color: CINZA }}>
                {sabores.length > 0 ? sabores.join(", ") : ""}{sabores.length > 0 && combo ? " · " : ""}{combo ? `${combo.qty} por ${reais(combo.price).replace(",00", "")}` : ""}
              </span>
            )}
            <span className="flex"><Status p={p} painel={painel} /></span>
          </span>
          <ChevronRight className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#d8d2c4" }} />
        </span>
        <span className="grid grid-cols-3 divide-x divide-[#2a2722]">
          <Valor rotulo="Venda" valor={venda} />
          <Valor rotulo="Custo" valor={custo} />
          <Valor rotulo="Margem" valor={margem} cor={margem !== "—" ? (l.sobra > 0 ? VERDE : VERM) : undefined} />
        </span>
        <span className="flex items-center flex-wrap gap-x-1.5 gap-y-1 pt-2.5 text-[12.5px] font-bold" style={{ borderTop: "1px solid #24221e" }}>
          <Package className="w-4 h-4 shrink-0" style={{ color: CINZA }} />
          <span style={{ color: "#d8d2c4" }}>Estoque:</span>
          <span className="font-black whitespace-nowrap" style={{ color: corEstoque }}>{est === "sem_controle" ? (p.origem === "faz" ? "feito na hora" : "sem controle") : `${p.stock_quantity} un`}</span>
          {incompleta && <span className="ml-auto text-[12px] font-black whitespace-nowrap" style={{ color: OURO }}>Completar receita →</span>}
        </span>
      </button>
    </article>
  );
}
