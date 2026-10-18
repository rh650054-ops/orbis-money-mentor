import type { Resumo } from "../lib/derivar";
import { brl } from "../lib/periodo";
import { COR, Cartao, Fato, Secao } from "./ui-bits";

const CORES: Record<string, string> = { pix: COR.gold, dinheiro: COR.ok, cartao: "#5aa9ff" };

/** Como você recebeu: count + value + share per method (Rick: "a quantidade de vendas
 *  em dinheiro precisa existir explicitamente"). Counts come from defcon_sales, so a
 *  day typed by hand without the Foco shows value but 0 sales. */
export function BlocoRecebeu({ r }: { r: Resumo }) {
  const { metodos, gorjeta, caiuDepois, totalN } = r.recebeu;
  const maxN = Math.max(1, ...metodos.map((m) => m.n));
  if (totalN === 0 && metodos.every((m) => m.valor === 0)) return null;
  return (
    <Secao kicker="Como você recebeu">
      <Cartao className="orbis-num">
        <div className="grid gap-2.5">
          {metodos.map((m) => {
            const vazio = m.n === 0 && m.valor === 0;
            return (
              <div key={m.chave} className={`grid grid-cols-[76px_1fr_auto] items-center gap-2.5 ${vazio ? "text-muted-foreground/60" : ""}`}>
                <div className="font-bold">{m.nome}<small className="block text-[12px] font-medium text-muted-foreground">{m.n} {m.n === 1 ? "venda" : "vendas"}</small></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary"><i className="orbis-fill block h-full" style={{ width: `${Math.round((m.n / maxN) * 100)}%`, background: CORES[m.chave] }} /></div>
                <div className="text-right font-bold">{brl(m.valor)}<small className="block text-[12px] font-medium text-muted-foreground">{vazio ? "—" : `${m.pctN}%`}</small></div>
              </div>
            );
          })}
        </div>
        <Fato>
          {gorjeta.n > 0 ? <>Gorjetas: <b>{brl(gorjeta.total)}</b> em {gorjeta.n} {gorjeta.n === 1 ? "venda" : "vendas"} (já dentro do dinheiro)</> : <>Sem gorjeta no período</>}
          {" · "}Pix que caiu depois do dia: <b>{brl(caiuDepois)}</b>.
        </Fato>
      </Cartao>
    </Secao>
  );
}
