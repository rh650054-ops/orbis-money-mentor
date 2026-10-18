/* Level 4 — work × personal in one line, the rules one tap away. Editing
   happens in the "Gerenciar conexões" sheet so the main screen stays light. */
import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import type { ContaVenda } from "@/components/conectar/pluggy";
import { COR, Secao, Botao } from "@/shared/components/vant-ui";

export function ClassificacaoCard({ contas, onClassificar }: { contas: ContaVenda[]; onClassificar: () => void }) {
  const [ajuda, setAjuda] = useState(false);
  const trabalho = contas.filter((c) => c.papel === "trabalho").length;
  const pessoal = contas.filter((c) => c.papel === "pessoal").length;
  const faltam = contas.length - trabalho - pessoal;

  return (
    <Secao titulo="CLASSIFICAÇÃO DAS CONTAS" id="sec-classificacao">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {faltam > 0
            ? <p className="text-[14px] font-black" style={{ color: COR.ouro }}>Falta dizer pra que serve {faltam === 1 ? "1 conta" : `${faltam} contas`}</p>
            : <p className="text-[14px] font-black">{trabalho} de trabalho · {pessoal} {pessoal === 1 ? "pessoal" : "pessoais"}</p>}
          <p className="text-[12px] mt-0.5" style={{ color: COR.apagado }}>Só conta de trabalho entra nas vendas e no ranking.</p>
        </div>
        <Botao tipo={faltam > 0 ? "ouro" : "linha"} onClick={onClassificar}>{faltam > 0 ? "Classificar" : "Mudar"}</Botao>
      </div>

      <button type="button" onClick={() => setAjuda((v) => !v)} aria-expanded={ajuda}
        className="mt-3 w-full flex items-center gap-2 text-[12.5px] font-extrabold" style={{ color: COR.suave }}>
        <HelpCircle className="w-4 h-4" style={{ color: COR.ouro }} /> Como isso funciona?
        <ChevronDown className={`w-4 h-4 ml-auto transition-transform duration-200 ${ajuda ? "rotate-180" : ""}`} />
      </button>
      {ajuda && (
        <ul className="mt-2 flex flex-col gap-1.5 text-[12.5px] leading-snug" style={{ color: COR.suave }}>
          <li>• Conta <b style={{ color: COR.ouro }}>Trabalho</b> entra nas vendas e no ranking.</li>
          <li>• Conta <b style={{ color: COR.texto }}>Pessoal</b> fica fora das vendas.</li>
          <li>• Você pode mudar quando quiser (1 troca por semana em cada conta).</li>
        </ul>
      )}
    </Secao>
  );
}
