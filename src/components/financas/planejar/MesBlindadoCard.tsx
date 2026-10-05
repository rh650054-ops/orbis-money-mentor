/* MÊS BLINDADO — quanto do mês já está garantido. "Entender cálculo" abre a folha. */
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
    <Cartao style={{ borderColor: "rgba(61,214,140,.2)" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <ShieldCheck className="w-5 h-5" style={{ color: COR.verde }} strokeWidth={2} />
          <Rotulo cor={COR.texto}>Mês blindado</Rotulo>
        </span>
        <span className="text-[13px] font-medium whitespace-nowrap tabular-nums" style={{ color: COR.sub }}>
          {cobertas} de {contas} {contas === 1 ? "conta coberta" : "contas cobertas"}
        </span>
      </div>
      <p className="text-[13px] mt-1" style={{ color: COR.sub }}>Quanto do seu mês já está garantido</p>

      <div className="flex items-end gap-3 mt-4">
        <p className="text-[52px] leading-none font-extrabold tracking-tight tabular-nums" style={{ color: COR.verde }}>{Math.round(pct)}%</p>
        <p className="text-[15px] pb-1.5 tabular-nums">
          <b style={{ color: COR.texto }}>{formatCurrency(protegido)}</b>
          <span style={{ color: COR.mute }}> de {formatCurrency(custo)}</span>
        </p>
      </div>
      <div className="mt-3"><Barra pct={pct} altura={9} /></div>

      <p className="text-[16px] font-medium mt-3" style={{ color: COR.texto }}>
        {blindado ? "Seu mês está protegido." : <>Faltam <b className="tabular-nums">{formatCurrency(falta)}</b> para proteger seu mês</>}
      </p>

      {!blindado && (
        <div className="flex items-center gap-3 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <Lightbulb className="w-5 h-5 shrink-0" style={{ color: COR.sub }} strokeWidth={2} />
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold tabular-nums" style={{ color: COR.texto }}>{formatCurrency(metaDia)} por dia de trabalho</p>
            <p className="text-[13px]" style={{ color: COR.sub }}>é o ritmo necessário para cobrir suas contas</p>
          </div>
        </div>
      )}
      <button type="button" onClick={() => setCalculo(true)}
        className="mt-1 -ml-2 min-h-11 px-2 inline-flex items-center gap-0.5 rounded-[10px] text-[14px] font-semibold transition-colors active:bg-white/[.05]"
        style={{ color: COR.ouro }}>
        Entender cálculo <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
      </button>

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
