/* Aba Estoque: quanto tem em mercadoria, o que precisa repor e os ingredientes
   guardados (antes escondidos na "Ficha técnica", agora aqui — Rick, 12/10/2026). */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ProdutoComFaixas } from "../types";
import { useAProduzirQuery } from "../api/use-producao-mutations";
import { ComprasRecentes } from "./compras-recentes";
import { CompraDetalhe } from "./compra-detalhe";
import { Produzi } from "./produzi";
import { IngredientesGuardados } from "./ingredientes-guardados";
import { reais } from "./campos";
import { estoqueBaixo } from "./produto-card";

export function AbaEstoque({ produtos, userId, onRepor }: {
  produtos: ProdutoComFaixas[]; userId: string | undefined; onRepor: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [produzindo, setProduzindo] = useState<ProdutoComFaixas | null>(null);
  // 26/10: tocar numa compra antiga abre o detalhe (antes ia direto pra editar)
  const [compraAberta, setCompraAberta] = useState<string | null>(null);
  const { data: aProduzir = [] } = useAProduzirQuery(true);
  const faz = (p: ProdutoComFaixas) => p.origem === "faz" || p.recipe_mode === "batch";
  const pendenteDe = (id: string) => aProduzir.find((a) => a.produto_id === id);
  const controlados = produtos.filter((p) => p.controla_estoque !== false || faz(p));
  const valor = controlados.reduce((s, p) => s + Math.max(0, p.stock_quantity) * Math.max(0, p.cost), 0);
  const ordem = [...controlados].sort((a, b) => Number(estoqueBaixo(b)) - Number(estoqueBaixo(a)) || a.stock_quantity - b.stock_quantity);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="rounded-[18px] px-4 py-3.5 flex justify-between items-center" style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
        <span className="text-[13px] font-extrabold" style={{ color: "#b9b3a6" }}>Você tem em mercadoria</span>
        <span className="text-xl font-black">{reais(valor)}</span>
      </div>
      {ordem.map((p) => {
        const baixo = estoqueBaixo(p);
        return (
          <div key={p.id} className="rounded-2xl px-3.5 py-3 flex items-center gap-3"
            style={{ background: "#0f0f10", border: `1px solid ${baixo ? "rgba(255,154,77,.45)" : "#26241f"}` }}>
            <span className="text-xl">{p.emoji ?? "📦"}</span>
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-sm font-black truncate">{p.name}</span>
              <span className="text-xs font-bold" style={{ color: baixo ? "#ff9a4d" : "#7b766e" }}>
                {p.stock_quantity} un{p.cost > 0 ? ` · ${reais(p.stock_quantity * p.cost)}` : ""}
              </span>
            </span>
            {faz(p) ? (
              <button type="button" onClick={() => setProduzindo(p)} className="rounded-full px-3 py-1.5 text-xs font-black"
                style={pendenteDe(p.id) || baixo ? { background: "#F5B800", color: "#1A1200" } : { background: "#121211", border: "1px solid #26241f" }}>
                Produzi
              </button>
            ) : (
              <button type="button" onClick={() => onRepor(p.id)} className="rounded-full px-3 py-1.5 text-xs font-black"
                style={baixo ? { background: "#F5B800", color: "#1A1200" } : { background: "#121211", border: "1px solid #26241f" }}>
                + chegou
              </button>
            )}
          </div>
        );
      })}
      {controlados.length === 0 && (
        <p className="text-sm text-center py-6" style={{ color: "#7b766e" }}>Nenhum produto com controle de estoque.</p>
      )}
      <IngredientesGuardados userId={userId} />
      <ComprasRecentes userId={userId} onAbrir={setCompraAberta} />
      <CompraDetalhe id={compraAberta} onFechar={() => setCompraAberta(null)} onEditar={(id) => navigate(`/products/mercado?editar=${id}`)} />
      <Produzi key={produzindo?.id ?? "x"} produto={produzindo} pendente={produzindo ? pendenteDe(produzindo.id) : undefined} onFechar={() => setProduzindo(null)} />
    </div>
  );
}
