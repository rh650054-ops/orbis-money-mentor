/* Compact inputs of the recipe lines (approved design: dark cards, 36px fields). */
import { useEffect, useState } from "react";
import { reaisDeTexto } from "@/shared/lib/dinheiro";
import { useTextoDinheiro } from "./campos";

import { fmt } from "../lib/formato";

/** Número que aceita apagar tudo e meio ("0,5"). */
export function MiniNumero({ valor, onChange, rotulo, largura = 64, exemplo = "1" }: { valor: number; onChange: (n: number) => void; rotulo: string; largura?: number; exemplo?: string }) {
  const [t, setT] = useState(valor > 0 ? fmt(valor) : "");
  // 12/11: o que aparece é o que entra na conta (o texto antigo ficava quando o valor mudava por fora)
  useEffect(() => {
    setT((x) => (Math.abs(reaisDeTexto(x) - valor) < 0.0005 ? x : valor > 0 ? fmt(valor) : ""));
  }, [valor]);
  return (
    <input type="text" inputMode="decimal" placeholder={exemplo} value={t} aria-label={rotulo}
      onFocus={(e) => e.currentTarget.select()}
      // left empty while the value stayed (a field that ignores zero): show the value that counts again
      onBlur={() => { if (!t && valor > 0) setT(fmt(valor)); }}
      onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, "").slice(0, 8); setT(v); onChange(reaisDeTexto(v)); }}
      style={{ width: largura }} className="h-9 rounded-[10px] text-center bg-[#1a1a19] outline-none text-sm font-black tabular-nums text-[#F4F1EA]" />
  );
}

export function MiniDinheiro({ valor, onChange, rotulo = "Quanto paga nessa compra" }: { valor: number; onChange: (n: number) => void; rotulo?: string }) {
  const campo = useTextoDinheiro(valor, onChange);
  return (
    <span className="w-[92px] h-9 rounded-[10px] bg-[#1a1a19] flex items-center px-2 gap-1">
      <span className="text-[11px] font-bold" style={{ color: "#7b766e" }}>R$</span>
      <input type="text" inputMode="decimal" placeholder="0" aria-label={rotulo} {...campo}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full bg-transparent text-right outline-none text-sm font-black tabular-nums text-[#F4F1EA]" />
    </span>
  );
}
