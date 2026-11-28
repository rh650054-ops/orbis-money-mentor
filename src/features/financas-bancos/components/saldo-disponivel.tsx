/* 1 · Saldo disponível: the bank accounts only (financas_home). Savings and investments stay in
   "Dinheiro guardado", so nothing is counted twice. */
import { AlertTriangle, Eye, EyeOff, RefreshCw } from "lucide-react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import { Cartao, COR, Divisor, divisaoDaBarra, hora, Titulo } from "@/features/financas-resumo";
import { dinheiro } from "../lib/ocultar";
import { avisosDoSaldo, type Qualidade } from "../lib/qualidade";


function Lado({ rotulo, valor, cor, oculto }: { rotulo: string; valor: number | null | undefined; cor: string; oculto: boolean }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: COR.sub }}>
        <span className="w-2 h-2 rounded-full" style={{ background: cor }} aria-hidden />{rotulo}
      </p>
      <p className="text-[17px] font-black tabular-nums mt-1 truncate" style={{ color: (valor ?? 0) < 0 && !oculto ? COR.vermelho : valor == null ? COR.mute : COR.texto }}>
        {dinheiro(valor, oculto)}
      </p>
    </div>
  );
}

interface Props {
  h: HomeFinancas; oculto: boolean; onOcultar: () => void;
  /** null while the connections are still loading (then nothing is claimed either way) */
  q: Qualidade | null;
  /** balance of the unclassified accounts (in the total, in neither side of the split) */
  semPapel: number | null;
}

export function SaldoDisponivel({ h, oculto, onOcultar, q, semPapel }: Props) {
  const saldo = h.tem_saldo ? h.saldo : null;
  const temDivisao = h.saldo_pessoal != null || (semPapel != null && h.saldo_trabalho != null);
  const barra = temDivisao ? divisaoDaBarra(h.saldo_trabalho ?? 0, h.saldo_pessoal ?? 0) : null;
  const sem = Math.max(0, semPapel ?? 0), lados = Math.max(0, h.saldo_trabalho ?? 0) + Math.max(0, h.saldo_pessoal ?? 0);
  const pctSem = sem > 0 && lados + sem > 0 ? Math.round((sem / (lados + sem)) * 100) : 0;
  const avisos = q ? avisosDoSaldo(q) : [];
  const parcial = saldo != null && avisos.length > 0;
  return (
    <Cartao rotulo="Saldo disponível" tom={saldo != null && saldo < 0 ? "vermelho" : "normal"}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Titulo>Saldo disponível</Titulo>
          {parcial && (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-black tracking-[.08em]"
              style={{ color: "#F2B43A", background: "rgba(242,180,58,.1)", border: "1px solid rgba(242,180,58,.35)" }}>PARCIAL</span>
          )}
        </div>
        <button type="button" onClick={onOcultar} aria-pressed={oculto} aria-label={oculto ? "Mostrar valores" : "Ocultar valores"}
          className="w-10 h-10 -my-2 -mr-2 rounded-xl flex items-center justify-center active:opacity-70" style={{ color: COR.sub }}>
          {oculto ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      </div>
      <p className="text-[32px] font-black tabular-nums leading-none tracking-tight mt-2"
        style={{ color: saldo == null ? COR.mute : saldo < 0 && !oculto ? COR.vermelho : COR.texto, fontSize: saldo == null ? 22 : undefined }}>
        {saldo == null ? "Saldo indisponível" : dinheiro(saldo, oculto)}
      </p>
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold mt-2" style={{ color: COR.sub }}>
        <RefreshCw className="w-3.5 h-3.5" style={{ color: h.atualizado && !parcial && q ? COR.verde : COR.mute }} aria-hidden />
        {!h.atualizado ? "O banco ainda não mandou o saldo" : parcial ? `Leitura mais recente às ${hora(h.atualizado)}` : `Atualizado às ${hora(h.atualizado)}`}
      </p>
      {avisos.map((a) => (
        <p key={a} className="flex items-start gap-1.5 text-[12.5px] font-semibold mt-1.5" style={{ color: "#F2B43A" }}>
          <AlertTriangle className="w-3.5 h-3.5 mt-[2px] shrink-0" aria-hidden />{a}
        </p>
      ))}
      {temDivisao && (
        <>
          <Divisor />
          <div className="grid grid-cols-2 gap-4">
            {/* a side with no account at all is not shown (it is not "indisponível", it does not exist) */}
            {h.saldo_trabalho != null && <Lado rotulo="Trabalho" valor={h.saldo_trabalho} cor={COR.ouro} oculto={oculto} />}
            {h.saldo_pessoal != null && <Lado rotulo="Pessoal" valor={h.saldo_pessoal} cor={COR.azul} oculto={oculto} />}
          </div>
          {(barra || pctSem > 0) && (
            <div className="flex h-[6px] rounded-full overflow-hidden mt-3.5 gap-[3px]" role="img"
              aria-label={oculto ? "Distribuição oculta" : `${Math.round((barra?.trabalho ?? 0) * (100 - pctSem) / 100)}% trabalho, ${Math.round((barra?.pessoal ?? 0) * (100 - pctSem) / 100)}% pessoal${pctSem ? `, ${pctSem}% sem classificação` : ""}`}>
              {oculto && <span className="h-full w-full rounded-full" style={{ background: "#2a2823" }} />}
              {!oculto && barra && barra.trabalho > 0 && <span className="h-full rounded-full" style={{ width: `${barra.trabalho * (100 - pctSem) / 100}%`, background: COR.ouro }} />}
              {!oculto && barra && barra.pessoal > 0 && <span className="h-full rounded-full" style={{ width: `${barra.pessoal * (100 - pctSem) / 100}%`, background: COR.azul }} />}
              {!oculto && pctSem > 0 && <span className="h-full rounded-full" style={{ width: `${pctSem}%`, background: "#5c584f" }} />}
            </div>
          )}
          {semPapel != null && (
            <p className="text-[12px] mt-2" style={{ color: COR.mute }}>{dinheiro(semPapel, oculto)} em banco sem classificação</p>
          )}
        </>
      )}
    </Cartao>
  );
}
