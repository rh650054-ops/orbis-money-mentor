/* Raio-X do extrato — as contas do mês: dinheiro que só mudou de lugar (entre contas
   do mesmo dono, fora dos totais), fatura de cartão (conta uma vez só), conta de
   vendas × conta pessoal, corre × pessoal e o que se repete todo mês. */
import type { RaioXResumo, RaioXConta } from "@/hooks/useRaioXExtrato";
import { moeda, bonito } from "./raiox-utils";

interface Props {
  resumo: RaioXResumo;
  onEntreContas: () => void;
  onContaUso: (banco: string, uso: RaioXConta["uso"]) => void;
}

const card = { background: "#131211", borderColor: "rgba(255,255,255,.07)" };
const muted = { color: "#7e7869" };

export default function RaioXContas({ resumo, onEntreContas, onContaUso }: Props) {
  const ec = resumo.entre_contas;
  return (
    <>
      {ec.qtd > 0 && (
        <button type="button" onClick={onEntreContas} className="w-full text-left rounded-2xl border p-3 flex gap-2.5 items-center" style={card}>
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-[17px] shrink-0" style={{ background: "#1c1c1b" }}>🔁</span>
          <div className="min-w-0 flex-1">
            <b className="block text-[13.5px] text-foreground">Entre suas contas: {moeda(Math.max(ec.saiu, ec.entrou))}</b>
            <span className="block text-[11.5px] leading-snug" style={muted}>
              Dinheiro que só mudou de lugar{ec.pares > 0 ? ` (${ec.pares} ${ec.pares === 1 ? "transferência" : "transferências"} de um banco pro outro)` : ""}. Não conta como gasto nem como entrada.
            </span>
          </div>
          <span className="text-[11px] font-extrabold shrink-0" style={{ color: "#FFC800" }}>ver</span>
        </button>
      )}

      {resumo.fatura.total > 0 && (
        <p className="text-[11.5px] leading-snug px-0.5" style={muted}>
          💳 {moeda(resumo.fatura.total)} de fatura de cartão {resumo.fatura.detalhada
            ? "ficaram fora do total — as compras já aparecem pela fatura que você mandou."
            : "entram uma vez só no total. Manda a fatura do cartão pra ver em que foi gasto."}
        </p>
      )}

      {resumo.contas.length > 0 && (
        <>
          <div className="flex justify-between items-baseline px-0.5 mt-1">
            <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">Suas contas</h2>
            <span className="text-[11px] font-bold" style={muted}>toque pra trocar vendas/pessoal</span>
          </div>
          <section className="rounded-2xl border px-3.5" style={card}>
            {resumo.contas.map((c, i) => (
              <div key={c.banco} className="flex items-center gap-2.5 py-2.5" style={{ borderTop: i ? "1px solid rgba(255,255,255,.07)" : undefined }}>
                <div className="min-w-0 flex-1">
                  <b className="block text-[13.5px] text-foreground truncate">🏦 {c.banco}</b>
                  <span className="block text-[11px] font-semibold" style={muted}>entrou {moeda(c.entrou)} · saiu {moeda(c.saiu)}</span>
                </div>
                <button type="button" onClick={() => onContaUso(c.banco, c.uso === "vendas" ? "pessoal" : "vendas")}
                  className="text-[10.5px] font-extrabold uppercase rounded-md px-2 py-1 shrink-0" style={c.uso === "vendas"
                    ? { letterSpacing: ".06em", color: "#3DD68C", background: "rgba(61,214,140,.12)" }
                    : { letterSpacing: ".06em", color: "#B07CFF", background: "rgba(176,124,255,.12)" }}>
                  {c.uso === "vendas" ? "vendas" : "pessoal"}
                </button>
              </div>
            ))}
          </section>
        </>
      )}

      {resumo.saiu > 0 && (
        <>
          <div className="flex justify-between items-baseline px-0.5 mt-1">
            <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">Corre × pessoal</h2>
            <span className="text-[11px] font-bold" style={muted}>o que é do trabalho</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border p-3" style={card}>
              <span className="orbis-section" style={{ color: "#4FA3FF" }}>Do corre</span>
              <div className="text-[20px] font-black tracking-tight tabular-nums mt-1.5 text-foreground">{moeda(resumo.corre)}</div>
              <small className="block text-[11px] font-semibold mt-1" style={muted}>
                {resumo.vendas > 0 ? `vendeu ${moeda(resumo.vendas)} em ${resumo.vendas_qtd} entradas` : "mercadoria, passagem, gelo, DAS"}
              </small>
            </div>
            <div className="rounded-2xl border p-3" style={card}>
              <span className="orbis-section" style={{ color: "#B07CFF" }}>Pessoal</span>
              <div className="text-[20px] font-black tracking-tight tabular-nums mt-1.5 text-foreground">{moeda(resumo.pessoal)}</div>
              <small className="block text-[11px] font-semibold mt-1" style={muted}>{Math.round((resumo.pessoal / resumo.saiu) * 100)}% do que saiu</small>
            </div>
          </div>
        </>
      )}

      {resumo.recorrentes.length > 0 && (
        <section className="rounded-2xl border px-3.5 pt-3 pb-1" style={card}>
          <p className="orbis-section">📅 Todo mês</p>
          {resumo.recorrentes.map((r, i) => (
            <div key={r.chave} className="flex justify-between gap-2 py-2" style={{ borderTop: i ? "1px solid rgba(255,255,255,.07)" : undefined }}>
              <span className="text-[13px] text-foreground truncate">{bonito(r.nome)}</span>
              <b className="text-[13px] tabular-nums text-foreground">{moeda(r.total)}</b>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
