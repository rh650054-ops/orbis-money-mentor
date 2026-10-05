/* MÊS BLINDADO — quanto do mês já está garantido. Compacto (V2, 05/10): fica
   depois das contas e não disputa atenção com o Guardar hoje. */
import { useState } from "react";
import { ChevronRight, Lightbulb, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { Barra, BotaoPrimario, BotaoSecundario, COR, Cartao, Folha, LinhaValor, Rotulo } from "./ui";

interface Props {
  custo: number;
  protegido: number;
  cobertas: number;
  contas: number;
  diasRestantes: number;   // dias de trabalho até o fim do mês
  onVerContas: () => void;
  onAjustar: () => void;
}

export function MesBlindadoCard({ custo, protegido, cobertas, contas, diasRestantes, onVerContas, onAjustar }: Props) {
  const [calculo, setCalculo] = useState(false);
  const falta = Math.max(0, custo - protegido);
  const pct = custo > 0 ? Math.min(100, (protegido / custo) * 100) : 0;
  const metaDia = falta > 0 ? falta / Math.max(1, diasRestantes) : 0;
  const blindado = falta <= 0.005;

  return (
    <Cartao style={{ borderColor: "rgba(61,214,140,.22)" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <ShieldCheck className="w-4 h-4" style={{ color: COR.verde }} strokeWidth={2.4} />
          <Rotulo cor={COR.texto}>Mês blindado</Rotulo>
        </span>
        <span className="text-[12px] font-black uppercase tracking-[.1em] whitespace-nowrap tabular-nums" style={{ color: COR.verde }}>
          {cobertas} de {contas} {contas === 1 ? "coberta" : "cobertas"}
        </span>
      </div>
      <p className="text-[13px] mt-0.5" style={{ color: COR.mute }}>Quanto do seu mês já está garantido</p>

      <div className="flex items-end justify-between gap-3 mt-2.5">
        {protegido > 0.005
          ? <p className="text-[36px] leading-none font-black tracking-tight tabular-nums" style={{ color: COR.verde }}>{Math.round(pct)}%</p>
          : <p className="text-[16px] font-bold leading-snug" style={{ color: COR.texto }}>Nenhuma conta coberta ainda</p>}
        <p className="text-[14px] tabular-nums pb-0.5 text-right shrink-0">
          <b style={{ color: COR.texto }}>{formatCurrency(protegido)}</b>
          <span style={{ color: COR.mute }}> de {formatCurrency(custo)}</span>
        </p>
      </div>
      <div className="mt-2"><Barra pct={pct} altura={6} /></div>

      <p className="text-[14px] font-semibold mt-2.5" style={{ color: COR.texto }}>
        {blindado ? "Seu mês está protegido." : <>Faltam <span className="tabular-nums">{formatCurrency(falta)}</span> para proteger seu mês</>}
      </p>
      <div className="mt-1">
        {!blindado && (
          <p className="text-[13px] leading-snug flex items-start gap-1.5" style={{ color: COR.sub }}>
            <Lightbulb className="w-4 h-4 shrink-0 mt-px" strokeWidth={2} />
            <span><b className="tabular-nums" style={{ color: COR.texto }}>{formatCurrency(metaDia)}</b> por dia de trabalho é o ritmo necessário para cobrir suas contas</span>
          </p>
        )}
        <button type="button" onClick={() => setCalculo(true)}
          className="min-h-10 -ml-1.5 px-1.5 inline-flex items-center gap-0.5 rounded-[10px] text-[13px] font-extrabold transition-colors active:bg-white/[.05]"
          style={{ color: COR.ouro }}>
          Entender cálculo <ChevronRight className="w-4 h-4" strokeWidth={2.6} />
        </button>
      </div>

      <Folha open={calculo} onOpenChange={setCalculo} titulo="Como calculamos sua meta">
        <div>
          <LinhaValor rotulo="Custo do mês" valor={formatCurrency(custo)} />
          <LinhaValor rotulo="Já protegido" valor={formatCurrency(protegido)} cor={COR.verde} />
          <LinhaValor rotulo="Falta proteger" valor={formatCurrency(falta)} forte />
          <LinhaValor rotulo="Dias de trabalho restantes" valor={`${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}`} />
          <LinhaValor rotulo="Meta média" valor={`${formatCurrency(metaDia)}/dia`} cor={COR.ouro} forte />
        </div>
        <BotaoPrimario onClick={() => { setCalculo(false); onVerContas(); }}>Editar contas do mês</BotaoPrimario>
        <BotaoSecundario onClick={() => { setCalculo(false); onAjustar(); }}>Ajustar planejamento</BotaoSecundario>
      </Folha>
    </Cartao>
  );
}
