/* 1 · Saldo disponível (Bancos). The big number is ONLY the money with a recent read; the last
   known balances without a recent read and the missing ones are shown apart (lib/saldo.ts, the
   same definition the Resumo uses). Savings and investments stay in "Dinheiro guardado". */
import { Eye, EyeOff } from "lucide-react";
import { Cartao, COR, Divisor, Titulo } from "@/features/financas-resumo";
import { dinheiro } from "../lib/ocultar";
import { distribuicao, type Consolidado, type Papel } from "../lib/saldo";
import { CabecaDoSaldo, LinhasDoSaldo, NumeroDoSaldo } from "./linhas-do-saldo";

const COR_PAPEL: Record<Papel, string> = { trabalho: COR.ouro, pessoal: COR.azul, sem: "#6d685e" };
const ROTULO: Record<Papel, string> = { trabalho: "Trabalho", pessoal: "Pessoal", sem: "Sem classificação" };

function Lado({ papel, c, oculto }: { papel: Papel; c: Consolidado; oculto: boolean }) {
  const v = c.partes[papel].recente;
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold truncate" style={{ color: COR.sub }}>
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COR_PAPEL[papel] }} aria-hidden />{ROTULO[papel]}
      </p>
      {v == null
        ? <p className="text-[13px] font-bold mt-1.5" style={{ color: COR.mute }}>sem leitura recente</p>
        : <p className="text-[17px] font-black tabular-nums mt-1 truncate" style={{ color: v < 0 && !oculto ? COR.vermelho : COR.texto }}>{dinheiro(v, oculto)}</p>}
    </div>
  );
}

interface Props { c: Consolidado; oculto: boolean; onOcultar: () => void }

export function SaldoDisponivel({ c, oculto, onOcultar }: Props) {
  const lados = (["trabalho", "pessoal", "sem"] as Papel[]).filter((p) => c.partes[p].contas > 0);
  const barra = lados.length >= 2 ? distribuicao(c) : null;
  const negativo = c.conferido && (c.recente ?? 0) < 0;
  return (
    <Cartao rotulo="Saldo disponível" tom={negativo ? "vermelho" : "normal"}>
      <div className="flex items-center justify-between gap-2">
        <CabecaDoSaldo c={c}><Titulo>Saldo disponível</Titulo></CabecaDoSaldo>
        <button type="button" onClick={onOcultar} aria-pressed={oculto} aria-label={oculto ? "Mostrar valores" : "Ocultar valores"}
          className="w-10 h-10 -my-2 -mr-2 rounded-xl flex items-center justify-center active:opacity-70 shrink-0" style={{ color: COR.sub }}>
          {oculto ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      </div>
      <NumeroDoSaldo c={c} oculto={oculto} tamanho={32} />
      <LinhasDoSaldo c={c} oculto={oculto} />
      {c.conferido && c.recente != null && lados.length >= 2 && (
        <>
          <Divisor />
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {lados.map((p) => <Lado key={p} papel={p} c={c} oculto={oculto} />)}
          </div>
          {/* no bar when it would mislead: a negative side, or nothing recent to split */}
          {barra && (
            <div className="flex h-[6px] rounded-full overflow-hidden mt-3.5 gap-[3px]" role="img"
              aria-label={oculto ? "Distribuição oculta" : lados.map((p) => `${barra[p]}% ${ROTULO[p].toLowerCase()}`).join(", ")}>
              {oculto
                ? <span className="h-full w-full rounded-full" style={{ background: "#2a2823" }} />
                : lados.filter((p) => barra[p] > 0).map((p) => <span key={p} className="h-full rounded-full" style={{ width: `${barra[p]}%`, background: COR_PAPEL[p] }} />)}
            </div>
          )}
        </>
      )}
    </Cartao>
  );
}
