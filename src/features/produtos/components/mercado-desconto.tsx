/* Último passo da compra (Rick, 19/10): apertou CONCLUIR → "Teve algum desconto?".
   Não teve = conclui. Teve = digita o valor da notinha (clube, cupom) e conclui. */
import { useState } from "react";
import { CampoDinheiro, reais } from "./campos";
import { BotaoOuro } from "./quiz-casca";

export function MercadoDesconto({ total, inicial, salvando, onConcluir, onFechar }: {
  total: number; inicial: number; salvando: boolean;
  onConcluir: (desconto: number) => void; onFechar: () => void;
}) {
  const [teve, setTeve] = useState(inicial > 0);
  const [valor, setValor] = useState(inicial);
  const desc = Math.min(Math.max(valor, 0), total);
  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-black/70" onClick={onFechar}>
      <div className="w-full max-w-md mx-auto rounded-t-[26px] px-4 pt-5 flex flex-col gap-3 text-[#F4F1EA]"
        style={{ background: "#0b0b0c", borderTop: "1px solid rgba(245,184,0,.35)", paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Teve algum desconto?">
        <span className="text-[13px] font-bold text-center" style={{ color: "#b9b3a6" }}>Total da compra {reais(total)}</span>
        <h2 className="text-[24px] font-black text-center">Teve algum desconto?</h2>
        {!teve ? (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={salvando} onClick={() => onConcluir(0)} className="h-14 rounded-2xl font-black text-[16px]"
              style={{ background: "#121211", border: "1px solid #26241f" }}>{salvando ? "…" : "Não teve"}</button>
            <button type="button" onClick={() => setTeve(true)} className="h-14 rounded-2xl font-black text-[16px]"
              style={{ background: "#F5B800", color: "#1A1200" }}>Teve</button>
          </div>
        ) : (
          <>
            <CampoDinheiro rotulo="Quanto foi o desconto? (tá na notinha)" valor={valor} onChange={setValor} grande autoFocus />
            <span className="text-[15px] font-bold text-center" style={{ color: "#b9b3a6" }}>
              Você pagou <b className="text-[19px]" style={{ color: "#4ADE80" }}>{reais(total - desc)}</b>
            </span>
            <BotaoOuro onClick={() => onConcluir(desc)} disabled={salvando}>{salvando ? "CONCLUINDO…" : "PRONTO, CONCLUIR"}</BotaoOuro>
            <button type="button" onClick={() => { setTeve(false); setValor(0); }} className="text-[13px] font-bold underline" style={{ color: "#7b766e" }}>
              Não teve desconto
            </button>
          </>
        )}
      </div>
    </div>
  );
}
