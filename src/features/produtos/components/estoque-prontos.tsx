/* Aba Estoque, B (25/11): finished units, one compact row per product, with its flavours. Keeps the
   "Produzi" / "+ chegou" actions of the old list; tapping the row opens the product sheet. */
import { useNavigate } from "react-router-dom";
import type { ProdutoComFaixas } from "../types";
import type { Sabor } from "../api/use-sabores";
import { situacaoDoEstoque } from "../lib/painel";
import { FotoOuMarca } from "./foto-produto";

const COR = { ok: "#3DD68C", baixo: "#FF9A3D", sem: "#FF6B5E", sem_controle: "#8a857b" } as const;
const TEXTO = { ok: "Em estoque", baixo: "Repor", sem: "Sem estoque", sem_controle: "Sem controle" } as const;

export function EstoqueProntos({ produtos, sabores, faz, destaque, onAcao, daPraMais }: {
  produtos: ProdutoComFaixas[]; sabores: Record<string, Sabor[]> | undefined;
  /** units the stored ingredients still make (null = no recipe to count) */
  daPraMais: (p: ProdutoComFaixas) => number | null;
  faz: (p: ProdutoComFaixas) => boolean; destaque: (p: ProdutoComFaixas) => boolean; onAcao: (p: ProdutoComFaixas) => void;
}) {
  const navigate = useNavigate();
  if (produtos.length === 0) return <p className="text-[13px] text-center py-4" style={{ color: "#7b766e" }}>Nenhum produto com controle de estoque.</p>;
  return (
    <div className="flex flex-col gap-2">
      {produtos.map((p, i) => {
        const est = situacaoDoEstoque(p);
        const sab = sabores?.[p.id] ?? [];
        const semSabor = sab.length ? p.stock_quantity - sab.reduce((t, s) => t + s.estoque, 0) : 0;
        return (
          <div key={p.id} className="rounded-[14px] pl-2 pr-2.5 py-2 flex items-center gap-2.5" style={{ background: "#151515", border: `1px solid ${est === "ok" ? "rgba(61,214,140,.45)" : est === "sem" ? "rgba(255,107,94,.45)" : est === "baixo" ? "rgba(255,154,61,.5)" : "#2a2722"}` }}>
            <button type="button" onClick={() => navigate(`/products/${p.id}`)} aria-label={`Abrir ${p.name}`} className="flex-1 min-w-0 flex items-center gap-2.5 text-left">
              <FotoOuMarca foto={p.photo_url} emoji={p.emoji} i={i} tamanho={44} />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[14.5px] font-extrabold leading-tight truncate">{p.name}</span>
                <span className="text-[11.5px] font-bold" style={{ color: COR[est] }}>{TEXTO[est]}</span>
                {faz(p) && daPraMais(p) !== null && (
                  <span className="text-[11.5px] font-semibold" style={{ color: daPraMais(p)! > 0 ? "#3DD68C" : "#8f897e" }}>
                    {daPraMais(p)! > 0 ? `ingredientes dão para +${daPraMais(p)} un` : "ingredientes não dão para 1 receita"}
                  </span>
                )}
                {sab.length > 0 && (
                  <span className="text-[11.5px] font-semibold truncate" style={{ color: "#a8a297" }}>
                    {sab.map((s) => `${s.emoji} ${s.nome} ${s.estoque}`).join(" · ")}{semSabor > 0 ? ` · ${semSabor} sem sabor` : ""}
                  </span>
                )}
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[20px] font-extrabold tabular-nums leading-none" style={{ color: est === "sem" ? COR.sem : "#F4F1EA" }}>{p.stock_quantity}</span>
                <span className="text-[10.5px] font-semibold" style={{ color: "#8f897e" }}>un</span>
              </span>
            </button>
            <button type="button" onClick={() => onAcao(p)} className="shrink-0 rounded-full px-3 h-8 text-[12px] font-extrabold"
              style={destaque(p) ? { background: "#F5B800", color: "#1A1200" } : { background: "#1a1a19", border: "1px solid #2c2a25", color: "#d8d2c4" }}>
              {faz(p) ? "Produzi" : "+ chegou"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
