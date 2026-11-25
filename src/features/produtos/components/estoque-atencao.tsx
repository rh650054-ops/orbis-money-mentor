/* Aba Estoque, C (25/11): what blocks the NEXT recipe, by ingredient, with numbers — what there is,
   what one recipe takes, what is missing and which products it affects. An incomplete recipe is said
   as such (never as a missing ingredient), and a cost typed as an ingredient is pointed out. */
import { useNavigate } from "react-router-dom";
import type { Alerta } from "../lib/estoque";

const n = (x: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const ESTILO = {
  esgotado: { cor: "#FF6B5E", rotulo: "ESGOTADO" },
  insuficiente: { cor: "#FF9A3D", rotulo: "NÃO DÁ PARA 1 RECEITA" },
  custo: { cor: "#F5B800", rotulo: "É CUSTO, NÃO INGREDIENTE" },
  incompleta: { cor: "#F5B800", rotulo: "RECEITA INCOMPLETA" },
} as const;
const lista = (a: string[]) => (a.length <= 2 ? a.join(" e ") : `${a.slice(0, 2).join(", ")} e mais ${a.length - 2}`);

export function EstoqueAtencao({ alertas, idDoProduto }: { alertas: Alerta[]; idDoProduto: (nome: string) => string | undefined }) {
  const navigate = useNavigate();
  if (alertas.length === 0) {
    return <p className="rounded-[14px] px-3.5 py-3 text-[13px] font-bold" style={{ background: "rgba(61,214,140,.07)", border: "1px solid rgba(61,214,140,.35)", color: "#3DD68C" }}>Tudo certo: dá para fazer a próxima receita de todos os produtos.</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      {alertas.map((a, k) => {
        const e = ESTILO[a.tipo];
        const id = idDoProduto(a.afetados[0] ?? "");
        return (
          <div key={k} className="rounded-[14px] px-3.5 py-2.5 flex flex-col gap-1" style={{ background: "#151515", border: `1px solid ${e.cor}55` }}>
            <span className="text-[10px] font-black tracking-[.12em]" style={{ color: e.cor }}>{e.rotulo}</span>
            <span className="text-[14.5px] font-extrabold leading-tight">{a.titulo}</span>
            {a.tipo !== "incompleta" && a.tem !== undefined && (
              <span className="text-[12.5px] font-semibold leading-snug" style={{ color: "#c9c3b5" }}>
                {a.tipo === "custo"
                  ? `Está na receita como ingrediente com ${n(a.tem)} ${a.unidade} guardado, então bloqueia a produção. Mão de obra entra no custo, não no estoque.`
                  : <>Tem <b className="text-[#F4F1EA]">{n(a.tem)} {a.unidade}</b> · 1 receita precisa de <b className="text-[#F4F1EA]">{n(a.precisa ?? 0)}</b> · faltam <b style={{ color: e.cor }}>{n(a.falta ?? 0)} {a.unidade}</b></>}
              </span>
            )}
            <span className="text-[11.5px] font-semibold" style={{ color: "#8f897e" }}>Afeta: {lista(a.afetados)}</span>
            {(a.tipo === "incompleta" || a.tipo === "custo") && id && (
              <button type="button" onClick={() => navigate(`/products/${id}`)} className="self-start text-[12px] font-extrabold pt-0.5" style={{ color: "#F5B800" }}>
                {a.tipo === "custo" ? "Abrir a receita ›" : "Completar receita ›"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
