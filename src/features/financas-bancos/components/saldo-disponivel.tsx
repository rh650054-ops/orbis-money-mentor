/* 1 · Saldo disponível: the bank accounts only (financas_home). Savings and investments stay in
   "Dinheiro guardado", so nothing is counted twice. */
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import { Cartao, COR, Divisor, divisaoDaBarra, hora, Titulo } from "@/features/financas-resumo";
import { dinheiro } from "../lib/ocultar";


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

export function SaldoDisponivel({ h, oculto, onOcultar }: { h: HomeFinancas; oculto: boolean; onOcultar: () => void }) {
  const saldo = h.tem_saldo ? h.saldo : null;
  const temDivisao = h.saldo_pessoal != null;
  const barra = temDivisao ? divisaoDaBarra(h.saldo_trabalho ?? 0, h.saldo_pessoal ?? 0) : null;
  return (
    <Cartao rotulo="Saldo disponível" tom={saldo != null && saldo < 0 ? "vermelho" : "normal"}>
      <div className="flex items-center justify-between gap-2">
        <Titulo>Saldo disponível</Titulo>
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
        <RefreshCw className="w-3.5 h-3.5" style={{ color: h.atualizado ? COR.verde : COR.mute }} aria-hidden />
        {h.atualizado ? `Atualizado às ${hora(h.atualizado)}` : "O banco ainda não mandou o saldo"}
      </p>
      {temDivisao && (
        <>
          <Divisor />
          <div className="grid grid-cols-2 gap-4">
            <Lado rotulo="Trabalho" valor={h.saldo_trabalho} cor={COR.ouro} oculto={oculto} />
            <Lado rotulo="Pessoal" valor={h.saldo_pessoal} cor={COR.azul} oculto={oculto} />
          </div>
          {barra && (
            <div className="flex h-[6px] rounded-full overflow-hidden mt-3.5 gap-[3px]" role="img" aria-label={`${barra.trabalho}% trabalho, ${barra.pessoal}% pessoal`}>
              {barra.trabalho > 0 && <span className="h-full rounded-full" style={{ width: `${barra.trabalho}%`, background: COR.ouro }} />}
              {barra.pessoal > 0 && <span className="h-full rounded-full" style={{ width: `${barra.pessoal}%`, background: COR.azul }} />}
            </div>
          )}
        </>
      )}
    </Cartao>
  );
}
