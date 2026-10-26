/* "SOBROU NO ESTOQUE" na compra concluída (Rick, 26/10/2026): o que ficou guardado
   de cada ingrediente da receita, quantas levas a mais dá e o que falta comprar. */
import { reais } from "./campos";
import { sobraDoProduto, type ItemReceitaEstoque } from "../lib/sobra";

const OURO = "#F5B800";

export function MercadoSobra({ nome, itens, porLeva, custo }: { nome: string; itens: ItemReceitaEstoque[]; porLeva: number; custo: number }) {
  const s = sobraDoProduto(itens);
  const comSobra = s.sobras.filter((x) => !x.falta);
  if (s.sobras.length === 0) return null;
  return (
    <div className="rounded-[14px] px-3 py-2.5 flex flex-col gap-1.5" style={{ background: "#121211", border: "1px solid #26241f" }}>
      <span className="text-[10px] font-black tracking-[.14em]" style={{ color: OURO }}>SOBROU NO ESTOQUE · {nome.toUpperCase()}</span>
      {comSobra.length === 0 && <span className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>Usou tudo: nada sobrou pra outra leva.</span>}
      {comSobra.map((x) => (
        <div key={x.nome} className="flex items-baseline justify-between gap-2 text-[13px] font-bold">
          <span className="truncate">{x.nome} <span style={{ color: "#7b766e" }}>· {x.texto}</span></span>
          <span className="shrink-0 tabular-nums" style={{ color: "#4ADE80" }}>+{x.levas} {x.levas === 1 ? "leva" : "levas"}</span>
        </div>
      ))}
      {s.levasPossiveis > 0 ? (
        <span className="text-[12.5px] font-extrabold" style={{ color: "#4ADE80" }}>
          Dá pra fazer mais {s.levasPossiveis * porLeva} sem comprar nada{custo > 0 ? ` · ${reais(custo)} cada` : ""}.
        </span>
      ) : s.faltam.length > 0 && comSobra.length > 0 ? (
        <span className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>
          Pra próxima leva falta: <b style={{ color: "#F4F1EA" }}>{s.faltam.join(", ")}</b>. O resto já está guardado e entra no custo pelo preço que você pagou.
        </span>
      ) : null}
    </div>
  );
}
