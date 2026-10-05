/* 5 · PARA REVISAR — substitui o "Piloto automático ligado" por uma ação.
   Pix pra pessoas e gastos não identificados que ninguém confirmou entram na fila
   (é o que deixa as categorias certas: quanto mais ele confirma, menos sobra aqui). */
import { CheckCircle2, ChevronRight, ListChecks } from "lucide-react";
import { COR, Cartao, Rotulo } from "../planejar/ui";
import type { Revisao } from "./tipos";

export function ParaRevisar({ r, onRevisar, onPerguntas }: { r: Revisao; onRevisar: () => void; onPerguntas: () => void }) {
  const n = r.total_pendentes;
  if (n === 0) {
    return (
      <Cartao className="flex items-center gap-3">
        <CheckCircle2 className="w-6 h-6 shrink-0" strokeWidth={2} style={{ color: COR.verde }} />
        <span className="min-w-0">
          <span className="block text-[16px] font-bold" style={{ color: COR.texto }}>Tudo organizado</span>
          <span className="block text-[13px] mt-0.5" style={{ color: COR.sub }}>
            {r.organizados} {r.organizados === 1 ? "gasto categorizado" : "gastos categorizados"} automaticamente
          </span>
          {r.perguntas > 0 && <LinkPerguntas n={r.perguntas} onClick={onPerguntas} />}
        </span>
      </Cartao>
    );
  }
  return (
    <Cartao className="p-0">
      <button type="button" onClick={onRevisar}
        className="group w-full text-left p-4 flex gap-3 rounded-[18px] transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-white/[.05]">
        <span className="w-9 h-9 shrink-0 rounded-[11px] flex items-center justify-center" style={{ background: "rgba(245,184,0,.12)" }} aria-hidden>
          <ListChecks className="w-5 h-5" strokeWidth={2} style={{ color: COR.ouro }} />
        </span>
        <span className="flex-1 min-w-0">
          <Rotulo cor={COR.sub}>Para revisar</Rotulo>
          <span className="block text-[17px] font-bold leading-snug mt-1 tabular-nums" style={{ color: COR.texto }}>
            {n === 1 ? "1 gasto precisa da sua confirmação" : `${n} gastos precisam da sua confirmação`}
          </span>
          <span className="block text-[13px] mt-1" style={{ color: COR.sub }}>
            {r.organizados} {r.organizados === 1 ? "outro foi organizado" : "outros foram organizados"} automaticamente
          </span>
          <span className="inline-flex items-center gap-0.5 mt-2 text-[14px] font-extrabold" style={{ color: COR.ouro }}>
            {n === 1 ? "Revisar gasto" : "Revisar gastos"} <ChevronRight className="w-4 h-4 transition-transform duration-[120ms] group-active:translate-x-0.5" strokeWidth={2.6} />
          </span>
        </span>
      </button>
    </Cartao>
  );
}

function LinkPerguntas({ n, onClick }: { n: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-1 inline-flex items-center gap-0.5 text-[13px] font-bold min-h-9" style={{ color: COR.ouro }}>
      {n === 1 ? "1 pergunta da Vant no Raio-X" : `${n} perguntas da Vant no Raio-X`} <ChevronRight className="w-4 h-4" strokeWidth={2.4} />
    </button>
  );
}
