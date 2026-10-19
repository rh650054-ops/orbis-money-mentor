/* Prévia ao vivo: quantas unidades a compra vira e quanto sai CADA uma — a mesma
   conta que o banco faz ao concluir. Na 1ª compra de um produto sem receita,
   pergunta quantas dá pra fazer (e isso vira a receita). */
import type { PreviaMercado } from "../lib/mercado";
import type { CustoProduto } from "../lib/mercado-produto";
import { Contador, reais } from "./campos";

const un = (n: number) => n.toLocaleString("pt-BR");
const receitasTxt = (n: number) => `${un(n)} ${n === 1 ? "receita" : "receitas"}`;
const lista = (nomes: string[]) =>
  nomes.length <= 1 ? nomes.join("") : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

const CAIXA = { background: "linear-gradient(170deg, #1a1305, #0e0e10 70%)", border: "1px solid rgba(245,184,0,.38)" };

function CustoDeCada({ c }: { c: CustoProduto }) {
  if (!(c.custo > 0)) return null;
  const mudou = c.antes > 0 && Math.abs(c.custo - c.antes) >= 0.01;
  const lucro = c.venda > 0 ? c.venda - c.custo : null;
  return (
    <span className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>
      Cada um sai a <b style={{ color: "#F4F1EA" }}>{reais(c.custo)}</b>
      {mudou && <span style={{ color: c.custo > c.antes ? "#FF7A6B" : "#4ADE80" }}> (era {reais(c.antes)})</span>}
      {lucro != null && <> · sobra <b style={{ color: lucro > 0 ? "#4ADE80" : "#FF7A6B" }}>{reais(lucro)}</b> por venda</>}
    </span>
  );
}

export interface ItemReceita { key: string; nome: string; unidade: string; sugestao: number; valor: number | undefined }

/** 1ª compra de um produto sem receita (Rick, 19/10): quantas dá pra fazer com a compra,
 *  quantas saem de UMA receita, e o que vai em uma receita — com isso a VANT desconta os
 *  insumos do estoque a cada lote e sabe o custo de cada unidade. */
export function PrimeiraCompra({ nome, unidades, rende, total, itens, onUnidades, onRende, onItem }: {
  nome: string; unidades: number; rende: number; total: number; itens: ItemReceita[];
  onUnidades: (n: number) => void; onRende: (n: number) => void; onItem: (key: string, n: number) => void;
}) {
  const lotes = unidades > 0 && rende > 0 ? unidades / rende : 0;
  return (
    <div className="rounded-[18px] px-4 py-3.5 flex flex-col gap-3" style={CAIXA}>
      <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>QUANTO RENDE</span>
      <Contador rotulo={`Com essa compra, dá pra fazer quantas ${nome}?`} valor={unidades} onChange={onUnidades} />
      {unidades > 0 && total > 0 && (
        <span className="text-[13px] font-bold -mt-1" style={{ color: "#b9b3a6" }}>
          Cada uma vai te custar <b style={{ color: "#F5B800", fontSize: 17 }}>{reais(total / unidades)}</b>
        </span>
      )}
      {unidades > 0 && <Contador rotulo={`Uma receita sai quantas ${nome}?`} valor={rende} onChange={onRende} />}
      {lotes > 0 && itens.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold" style={{ color: "#b9b3a6" }}>
            O que vai em UMA receita? <span style={{ color: "#7b766e" }}>(essa compra dá {lotes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} receitas)</span>
          </span>
          {itens.map((it) => (
            <label key={it.key} className="flex items-center gap-2.5">
              <span className="flex-1 min-w-0 text-[13.5px] font-bold truncate">{it.nome}</span>
              <input type="text" inputMode="decimal" aria-label={`${it.nome} por receita`}
                value={it.valor != null ? String(it.valor).replace(".", ",") : ""}
                placeholder={it.sugestao > 0 ? it.sugestao.toLocaleString("pt-BR") : "0"}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => onItem(it.key, Number(e.target.value.replace(",", ".")) || 0)}
                className="w-[76px] h-11 rounded-xl text-center text-[15px] font-extrabold tabular-nums bg-[#121211] border border-[#26241f] focus-visible:outline-none focus-visible:border-[#F5B800]" />
              <span className="w-12 text-[12px] font-bold truncate" style={{ color: "#7b766e" }}>{it.unidade}</span>
            </label>
          ))}
          <span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>
            Já deixei sugerido pela compra; corrige se for diferente. A cada lote a VANT desconta isso do estoque de insumos.
          </span>
        </div>
      )}
      <span className="text-[11.5px] font-bold" style={{ color: "#7b766e" }}>
        {unidades > 0 ? `Vou guardar isso como a receita de ${nome}. Pode ser aproximado.` : "Não sabe ainda? Pode deixar em branco: vai tudo pro estoque de ingredientes."}
      </span>
    </div>
  );
}

export function MercadoPrevia({ previa, custos }: { previa: PreviaMercado; custos: CustoProduto[] }) {
  const sobem = previa.produtos.filter((p) => p.receitas > 0);
  const travados = previa.produtos.filter((p) => p.receitas === 0 && p.faltam.length > 0);
  const nada = sobem.length === 0 && previa.prontos.length === 0;
  return (
    <div className="rounded-[18px] px-4 py-3.5 flex flex-col gap-2.5" style={CAIXA}>
      <span className="text-[10.5px] font-black tracking-[.14em]" style={{ color: "#F5B800" }}>ISSO VIRA NO ESTOQUE</span>
      {nada && (
        <span className="text-[13px] font-bold" style={{ color: "#b9b3a6" }}>
          Põe a quantidade de cada item e a VANT mostra quantas unidades dá pra fazer.
        </span>
      )}
      {sobem.map((p) => {
        const c = custos.find((x) => x.id === p.id);
        return (
          <div key={p.id} className="flex flex-col gap-0.5">
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[14px] font-extrabold">{p.nome} · {receitasTxt(p.receitas)}</span>
              <span className="text-[20px] font-black tabular-nums" style={{ color: "#F5B800" }}>→ {un(p.unidades)} un</span>
            </div>
            {c && <CustoDeCada c={c} />}
          </div>
        );
      })}
      {previa.prontos.map((p) => (
        <div key={p.id} className="flex justify-between items-baseline gap-2">
          <span className="text-[14px] font-extrabold">{p.nome}</span>
          <span className="text-[20px] font-black tabular-nums" style={{ color: "#F5B800" }}>+{un(p.unidades)} un</span>
        </div>
      ))}
      {travados.map((p) => (
        <span key={p.id} className="text-[12px] font-bold" style={{ color: "#b9b3a6" }}>
          {p.nome}: falta {lista(p.faltam)} pra fechar a receita (o resto fica guardado no estoque de ingredientes).
        </span>
      ))}
    </div>
  );
}
