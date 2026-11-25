/* Aba Estoque, A · Produtos prontos (25/11, Rick): one compact row per product — small photo, name,
   flavours and the quantity in front. No prices here (they live on the Produtos tab). Tapping opens
   the detail: how the units split by flavour and what can be done (adjust in the sheet, "chegou
   mercadoria" for resale, produce only when the ingredients allow it). */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import type { ProdutoComFaixas } from "../types";
import type { Sabor } from "../api/use-sabores";
import { situacaoDoEstoque } from "../lib/painel";
import { FotoOuMarca } from "./foto-produto";

const COR = { ok: "#3DD68C", baixo: "#FF9A3D", sem: "#FF6B5E", sem_controle: "#8a857b" } as const;
const TEXTO = { ok: "Em estoque", baixo: "Estoque baixo", sem: "Sem estoque", sem_controle: "Sem controle de estoque" } as const;

export function EstoqueProntos({ produtos, sabores, faz, daPraMais, onChegou }: {
  produtos: ProdutoComFaixas[]; sabores: Record<string, Sabor[]> | undefined; faz: (p: ProdutoComFaixas) => boolean;
  /** units the stored ingredients still make (null = no recipe to count) */
  daPraMais: (p: ProdutoComFaixas) => number | null;
  onChegou: (id: string) => void;
}) {
  const [aberto, setAberto] = useState<ProdutoComFaixas | null>(null);
  if (produtos.length === 0) return <p className="text-[13px] text-center py-3" style={{ color: "#7b766e" }}>Nenhum produto com controle de estoque.</p>;
  return (
    <>
      <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid #2a2722" }}>
        {produtos.map((p, i) => {
          const est = situacaoDoEstoque(p);
          const sab = sabores?.[p.id] ?? [];
          return (
            <button key={p.id} type="button" onClick={() => setAberto(p)} aria-label={`Estoque de ${p.name}`} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left"
              style={{ background: "#151515", borderTop: i ? "1px solid #1f1d1a" : undefined }}>
              <FotoOuMarca foto={p.photo_url} emoji={p.emoji} i={i} tamanho={40} />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[14.5px] font-extrabold leading-tight truncate">{p.name}</span>
                <span className="text-[11.5px] font-semibold truncate" style={{ color: sab.length ? "#a8a297" : COR[est] }}>
                  {sab.length ? sab.map((s) => `${s.emoji} ${s.nome} ${s.estoque}`).join(" · ") : TEXTO[est]}
                </span>
              </span>
              <span className="flex items-baseline gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full self-center" style={{ background: COR[est] }} />
                <span className="text-[22px] font-extrabold tabular-nums leading-none">{p.stock_quantity}</span>
                <span className="text-[11px] font-semibold" style={{ color: "#8f897e" }}>un</span>
              </span>
            </button>
          );
        })}
      </div>
      {aberto && <Detalhe p={aberto} sab={sabores?.[aberto.id] ?? []} faz={faz(aberto)} mais={daPraMais(aberto)} onFechar={() => setAberto(null)} onChegou={() => { onChegou(aberto.id); setAberto(null); }} />}
    </>
  );
}

function Detalhe({ p, sab, faz, mais, onFechar, onChegou }: { p: ProdutoComFaixas; sab: Sabor[]; faz: boolean; mais: number | null; onFechar: () => void; onChegou: () => void }) {
  const navigate = useNavigate();
  const est = situacaoDoEstoque(p);
  // the product's stock = its flavours + what was entered without a flavour (before the flavours existed)
  const semSabor = sab.length ? p.stock_quantity - sab.reduce((t, s) => t + s.estoque, 0) : 0;
  const Linha = ({ k, v }: { k: string; v: number }) => (
    <div className="flex justify-between text-[14px] font-bold"><span style={{ color: "#c9c3b5" }}>{k}</span><span className="tabular-nums">{v} un</span></div>
  );
  return (
    <div className="fixed inset-0 z-[80] flex items-end" style={{ background: "rgba(0,0,0,.65)" }} onClick={onFechar}>
      <div className="w-full max-w-md mx-auto rounded-t-[22px] px-4 pt-4 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}
        style={{ background: "#121212", border: "1px solid #2a2722", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}>
        <div className="flex items-start gap-2">
          <span className="flex-1 flex flex-col">
            <span className="text-[17px] font-black">{p.name}</span>
            <span className="text-[13px] font-bold" style={{ color: COR[est] }}>{TEXTO[est]} · {p.stock_quantity} un prontas</span>
          </span>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="p-1" style={{ color: "#8f897e" }}><X className="w-5 h-5" /></button>
        </div>
        {sab.length > 0 && (
          <div className="rounded-[14px] px-3.5 py-2.5 flex flex-col gap-1.5" style={{ background: "#181818" }}>
            {sab.map((s) => <Linha key={s.id} k={`${s.emoji} ${s.nome}`} v={s.estoque} />)}
            {semSabor > 0 && <Linha k="Sem sabor definido" v={semSabor} />}
            {semSabor > 0 && <span className="text-[11.5px] font-semibold leading-snug" style={{ color: "#8f897e" }}>São unidades lançadas no produto sem dizer o sabor (por exemplo, antes de criar os sabores). Elas contam no total; a VANT não muda o sabor delas sozinha.</span>}
          </div>
        )}
        {faz && mais !== null && (
          <span className="text-[12.5px] font-bold" style={{ color: mais > 0 ? "#3DD68C" : "#FF9A3D" }}>
            {mais > 0 ? `Os ingredientes guardados dão para mais ${mais} un.` : "Os ingredientes guardados não dão para 1 receita. Veja \"O que precisa de atenção?\"."}
          </span>
        )}
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => navigate(`/products/${p.id}`)} className="h-11 rounded-[12px] text-[14px] font-extrabold" style={{ background: "#1c1c1c", border: "1px solid #2c2a25" }}>Ajustar estoque na ficha</button>
          {!faz && <button type="button" onClick={onChegou} className="h-11 rounded-[12px] text-[14px] font-extrabold" style={{ background: "#1c1c1c", border: "1px solid #2c2a25" }}>Chegou mercadoria</button>}
          {faz && mais !== null && mais > 0 && (
            <button type="button" onClick={() => navigate(`/products/produzir?p=${p.id}`)} className="h-11 rounded-[12px] text-[14px] font-extrabold" style={{ background: "#F5B800", color: "#1A1200" }}>Produzir</button>
          )}
        </div>
      </div>
    </div>
  );
}
