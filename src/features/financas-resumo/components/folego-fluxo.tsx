/* 5 · Fôlego financeiro and 6 · Fluxo de caixa. Both read financas_home() as it is:
   fôlego = bank balance ÷ (fixed bills of the month ÷ 30); flow = bank entries and exits of the month
   (the same extrato_base month the Raio-X reads, so the two screens show the same numbers). */
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import type { HomeFinancas } from "@/components/financas/FinancasHome";
import { Atalho, Cartao, COR, comSinal, Divisor, reais, Titulo, Valor } from "./pecas";

export function FolegoFinanceiro({ h, onPlanejar }: { h: HomeFinancas; onPlanejar: () => void }) {
  const [comoCalcula, setComoCalcula] = useState(false);
  const dias = h.folego_dias;
  const cor = dias == null ? COR.sub : dias < 7 ? COR.vermelho : dias < 15 ? COR.ouro : COR.verde;
  return (
    <Cartao rotulo="Fôlego financeiro">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(61,214,140,.1)", border: "1px solid rgba(61,214,140,.25)" }}>
          <ShieldCheck className="w-5 h-5" style={{ color: COR.verde }} aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-black" style={{ color: COR.texto }}>Fôlego financeiro</p>
          <p className="text-[12.5px]" style={{ color: COR.sub }}>Se você parar de vender</p>
        </div>
        {dias != null && (
          <p className="text-[22px] font-black tabular-nums shrink-0" style={{ color: cor }}>{dias} {dias === 1 ? "dia" : "dias"}</p>
        )}
      </div>
      {dias != null ? (
        <>
          <p className="text-[13.5px] mt-3" style={{ color: COR.texto }}>Tempo estimado pagando apenas suas contas fixas.</p>
          <button type="button" onClick={() => setComoCalcula((v) => !v)} aria-expanded={comoCalcula}
            className="self-start min-h-9 text-[12.5px] font-bold underline underline-offset-2" style={{ color: COR.sub }}>
            {comoCalcula ? "Fechar" : "Como calculamos?"}
          </button>
          {comoCalcula && (
            <p className="text-[12.5px] rounded-xl px-3 py-2" style={{ color: COR.sub, background: "#1a1916" }}>
              Saldo dos bancos ÷ o que suas contas fixas custam por dia ({reais(h.fixas_mes)} no mês ÷ 30).
            </p>
          )}
        </>
      ) : h.fixas_mes > 0 ? (
        <p className="text-[13.5px] mt-3" style={{ color: COR.sub }}>
          {h.tem_saldo && (h.saldo ?? 0) <= 0 ? "Sem saldo positivo nos bancos, não há fôlego para contar." : "Aparece quando o saldo for lido."}
        </p>
      ) : (
        <>
          <p className="text-[13.5px] mt-3" style={{ color: COR.sub }}>Cadastre suas contas fixas (aluguel, luz, celular) para ver quantos dias você aguenta.</p>
          <Atalho onClick={onPlanejar}>Cadastrar contas fixas</Atalho>
        </>
      )}
    </Cartao>
  );
}

export function FluxoDeCaixa({ h, onVer }: { h: HomeFinancas; onVer: () => void }) {
  const dif = h.entrou - h.saiu;
  return (
    <Cartao rotulo="Fluxo de caixa">
      <div className="grid grid-cols-2 gap-4">
        <Valor rotulo="Entradas" valor={reais(h.entrou)} cor={COR.verde}
          icone={<ArrowDownLeft className="w-3.5 h-3.5" style={{ color: COR.verde }} aria-hidden />} />
        <Valor rotulo="Saídas" valor={reais(h.saiu)} cor={COR.vermelho}
          icone={<ArrowUpRight className="w-3.5 h-3.5" style={{ color: COR.vermelho }} aria-hidden />} />
      </div>
      <Divisor />
      <Titulo>Diferença entre entradas e saídas</Titulo>
      <p className="text-[22px] font-black tabular-nums mt-1.5" style={{ color: dif < 0 ? COR.vermelho : COR.verde }}>{comSinal(dif)}</p>
      <Atalho onClick={onVer}>Ver movimentações</Atalho>
    </Cartao>
  );
}
