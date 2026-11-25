/* Carga do dia — "Escolher o que vou levar" (25/11/2026, Rick). The old dialog closed after each
   "Levar", so only one product went in at a time. Now every product has its own − / + (no keyboard
   needed; the number can still be typed), the products already in the load show it, and ONE button
   takes them all. Above the stock it asks per product ("tenho mais") instead of blocking. */
import { useState } from "react";
import { Check, Loader2, Minus, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { LoadoutItem, ProductOption } from "@/hooks/useDefconLoadout";

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type Escolha = { qty: number; tenhoMais?: boolean };

function Contador({ valor, onMudar, rotulo }: { valor: number; onMudar: (n: number) => void; rotulo: string }) {
  return (
    <div className="flex items-center h-11 rounded-[14px] overflow-hidden shrink-0" style={{ background: "#0c0c0c", border: "1px solid rgba(255,255,255,.12)" }}>
      <button type="button" onClick={() => onMudar(Math.max(0, valor - 1))} aria-label={`Menos ${rotulo}`} className="w-10 h-full flex items-center justify-center active:bg-white/10" style={{ color: "#d8d2c4" }}><Minus className="w-4 h-4" /></button>
      <input type="text" inputMode="numeric" pattern="[0-9]*" value={valor > 0 ? String(valor) : ""} placeholder="0" aria-label={`Quantidade de ${rotulo}`}
        onFocus={(e) => { e.currentTarget.select(); e.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" }); }}
        onChange={(e) => onMudar(Math.min(9999, parseInt(e.target.value.replace(/\D/g, ""), 10) || 0))}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-12 h-full bg-transparent text-center text-[18px] font-extrabold outline-none tabular-nums" />
      <button type="button" onClick={() => onMudar(valor + 1)} aria-label={`Mais ${rotulo}`} className="w-10 h-full flex items-center justify-center active:bg-white/10" style={{ color: "#F5B800" }}><Plus className="w-4 h-4" strokeWidth={3} /></button>
    </div>
  );
}

export function CargaEscolher({ aberto, products, loadout, onFechar, onLevar }: {
  aberto: boolean; products: ProductOption[]; loadout: LoadoutItem[]; onFechar: () => void;
  onLevar: (itens: { product: ProductOption; qty: number; tenhoMais?: boolean }[]) => Promise<void>;
}) {
  const [escolha, setEscolha] = useState<Record<string, Escolha>>({});
  const [salvando, setSalvando] = useState(false);
  if (!aberto) return null;
  const naCarga = (id: string) => loadout.find((l) => l.product_id === id);
  const valorDe = (p: ProductOption) => escolha[p.id]?.qty ?? Number(naCarga(p.id)?.qty_initial ?? 0);
  const mudar = (p: ProductOption, m: Partial<Escolha>) => setEscolha((x) => ({ ...x, [p.id]: { qty: valorDe(p), ...x[p.id], ...m } }));
  // only what changed is saved: a product already in the load keeps its row unless he changed it
  const mudados = products.filter((p) => escolha[p.id] && escolha[p.id]!.qty > 0 && escolha[p.id]!.qty !== Number(naCarga(p.id)?.qty_initial ?? 0));
  const unidades = mudados.reduce((s, p) => s + (escolha[p.id]?.qty ?? 0), 0);
  const levar = async () => {
    setSalvando(true);
    try { await onLevar(mudados.map((p) => ({ product: p, qty: escolha[p.id]!.qty, tenhoMais: escolha[p.id]!.tenhoMais }))); setEscolha({}); onFechar(); }
    finally { setSalvando(false); }
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-end" style={{ background: "rgba(0,0,0,.72)" }} onClick={onFechar}>
      <div className="w-full max-w-md mx-auto rounded-t-[26px] flex flex-col max-h-[88dvh]" onClick={(e) => e.stopPropagation()}
        style={{ background: "linear-gradient(180deg,#151515,#0b0b0b)", border: "1px solid rgba(245,184,0,.22)" }}>
        <div className="px-5 pt-4 pb-3 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-[10.5px] font-black uppercase tracking-[.16em]" style={{ color: "#F5B800" }}>Carga do dia</p>
            <p className="text-[20px] font-extrabold leading-tight mt-0.5">O que você vai levar?</p>
            <p className="text-[12.5px] mt-1" style={{ color: "#a19b90" }}>Escolha quantos de cada. Pode levar vários.</p>
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "#1c1c1c", color: "#a19b90" }}><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-3 flex flex-col gap-2.5">
          {products.map((p) => {
            const q = valorDe(p);
            const carga = naCarga(p.id);
            const controla = p.controla_estoque !== false;
            const pode = Math.max(0, Number(p.stock_quantity) || 0) + Number(carga?.qty_sold ?? 0);
            const acima = controla && q > pode;
            const ativo = q > 0;
            return (
              <div key={p.id} className="rounded-[18px] px-3.5 py-3 flex flex-col gap-2" style={{ background: ativo ? "rgba(245,184,0,.06)" : "#121212", border: `1px solid ${ativo ? "rgba(245,184,0,.45)" : "rgba(255,255,255,.08)"}` }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15.5px] font-extrabold truncate">{p.name}</p>
                    <p className="text-[12px] font-semibold mt-0.5" style={{ color: "#a19b90" }}>
                      {Number(p.sale_price) > 0 ? `${brl(Number(p.sale_price))} · ` : ""}{controla ? `${Math.max(0, Number(p.stock_quantity) || 0)} no estoque` : "sem controle de estoque"}
                    </p>
                    {carga && <p className="text-[11.5px] font-bold mt-0.5 inline-flex items-center gap-1" style={{ color: "#3DD68C" }}><Check className="w-3.5 h-3.5" /> na carga: {Number(carga.qty_initial)}</p>}
                  </div>
                  <Contador valor={q} rotulo={p.name} onMudar={(n) => mudar(p, { qty: n })} />
                </div>
                {controla && pode > 0 && q !== pode && (
                  <button type="button" onClick={() => mudar(p, { qty: pode, tenhoMais: false })} className="self-start rounded-full px-3 h-8 text-[12px] font-extrabold" style={{ background: "#1c1c1c", color: "#F5B800", border: "1px solid rgba(245,184,0,.3)" }}>
                    Levar tudo do estoque ({pode})
                  </button>
                )}
                {acima && (
                  <label className="flex items-start gap-2 rounded-[12px] px-3 py-2 text-[12px] font-bold leading-snug" style={{ background: "rgba(255,154,61,.08)", color: "#FF9A3D" }}>
                    <input type="checkbox" checked={!!escolha[p.id]?.tenhoMais} onChange={(e) => mudar(p, { tenhoMais: e.target.checked })} className="mt-0.5 accent-[#F5B800]" />
                    <span>Tenho {q}: atualizar o estoque. <span style={{ color: "#c9a27a" }}>O estoque diz {pode}; sem marcar, leva só {pode}.</span></span>
                  </label>
                )}
              </div>
            );
          })}
          <Link to="/products/novo" className="block text-center text-[12.5px] font-bold py-2" style={{ color: "#F5B800" }}>+ cadastrar um produto novo</Link>
        </div>
        <div className="px-4 pt-3 border-t" style={{ borderColor: "rgba(255,255,255,.08)", paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          <button type="button" disabled={mudados.length === 0 || salvando} onClick={() => { void levar(); }}
            className="w-full h-[54px] rounded-[16px] text-[15.5px] font-extrabold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[.98]"
            style={{ background: "#F5B800", color: "#1A1200" }}>
            {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : mudados.length === 0 ? "Escolha a quantidade" : `Levar ${mudados.length} ${mudados.length === 1 ? "produto" : "produtos"} · ${unidades} un`}
          </button>
        </div>
      </div>
    </div>
  );
}
