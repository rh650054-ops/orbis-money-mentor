/* Aba Estoque, B · O que precisa de atenção? (25/11, Rick): only real, useful alerts, one line each;
   tapping opens the ingredient and the products it affects. A missing ingredient, a recipe that is
   incomplete and a registration problem ("Produção" typed as an ingredient = a cost, not goods) are
   told apart, and none of them is repeated. */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import type { Alerta } from "../lib/estoque";

const n = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const COR = { esgotado: "#FF6B5E", insuficiente: "#FF9A3D", custo: "#8a857b", incompleta: "#8a857b" } as const;

function frase(a: Alerta): string {
  if (a.tipo === "esgotado") return `${a.titulo} esgotado — faltam ${n(a.falta ?? 0)} ${a.unidade} para a próxima receita`;
  if (a.tipo === "insuficiente") return `${a.titulo}: tem ${n(a.tem ?? 0)} ${a.unidade}, a próxima receita precisa de ${n(a.precisa ?? 0)}`;
  if (a.tipo === "custo") return `Ajuste no cadastro: ${a.ingrediente} está como ingrediente`;
  return `Receita incompleta: ${a.titulo.replace(/^Falta /, "falta ")}`;
}

export function EstoqueAtencao({ alertas, idDoProduto }: { alertas: Alerta[]; idDoProduto: (nome: string) => string | undefined }) {
  const navigate = useNavigate();
  const [aberto, setAberto] = useState<number | null>(null);
  if (alertas.length === 0) {
    return <p className="rounded-[14px] px-3.5 py-2.5 text-[13px] font-bold" style={{ background: "rgba(61,214,140,.07)", border: "1px solid rgba(61,214,140,.3)", color: "#3DD68C" }}>Nada travando: dá para fazer a próxima receita de tudo.</p>;
  }
  return (
    <div className="rounded-[16px] overflow-hidden" style={{ border: "1px solid #2a2722" }}>
      {alertas.map((a, k) => {
        const id = idDoProduto(a.afetados[0] ?? "");
        const abre = aberto === k;
        return (
          <div key={k} style={{ background: "#151515", borderTop: k ? "1px solid #1f1d1a" : undefined }}>
            <button type="button" aria-expanded={abre} onClick={() => setAberto(abre ? null : k)} className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left">
              <span className="w-2 h-2 rounded-full mt-[7px] shrink-0" style={{ background: COR[a.tipo] }} />
              <span className="flex-1 text-[13.5px] font-bold leading-snug">{frase(a)}</span>
              <ChevronDown className={`w-4 h-4 mt-0.5 shrink-0 transition-transform ${abre ? "rotate-180" : ""}`} style={{ color: "#8f897e" }} />
            </button>
            {abre && (
              <div className="px-3.5 pb-3 pl-8 flex flex-col gap-1.5 text-[12.5px] font-semibold" style={{ color: "#c9c3b5" }}>
                {a.tipo === "custo"
                  ? <span className="leading-snug">É custo (mão de obra), não mercadoria: não se compra nem fica guardado. Como ingrediente com {n(a.tem ?? 0)} {a.unidade}, ele trava a produção. Na receita, passe para "custos sem estoque".</span>
                  : a.tipo !== "incompleta" && <span>Tem {n(a.tem ?? 0)} {a.unidade} · 1 receita precisa de {n(a.precisa ?? 0)} · faltam {n(a.falta ?? 0)} {a.unidade}</span>}
                {a.tipo === "incompleta" && <span className="leading-snug">Sem essa informação a VANT não calcula o consumo nem o custo dessa receita.</span>}
                <span style={{ color: "#8f897e" }}>Afeta: {a.afetados.join(", ")}</span>
                {(a.tipo === "custo" || a.tipo === "incompleta") && id && (
                  <button type="button" onClick={() => navigate(`/products/${id}`)} className="self-start font-extrabold" style={{ color: "#F5B800" }}>Abrir a receita ›</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
