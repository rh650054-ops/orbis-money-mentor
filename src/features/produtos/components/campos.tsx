/* Campos do quiz: dinheiro e contador − n +.
   Dinheiro segue a regra do Foco (shared/lib/dinheiro): digitou "5" = R$ 5,00, a
   vírgula é dele quando quiser ("5,50"). Antes os 2 últimos dígitos viravam centavos
   e "5" dava R$ 0,05 (Rick, 12/10/2026). */
import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { arrumarDinheiro, limparDinheiro, reaisDeTexto, textoDeReais } from "@/shared/lib/dinheiro";

const brl2 = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const reais = (n: number) => `R$ ${brl2(n)}`;

/** Texto do campo de dinheiro: mostra o que ele digitou, arruma no blur. */
export function useTextoDinheiro(valor: number, onChange: (n: number) => void) {
  const [texto, setTexto] = useState(textoDeReais(valor));
  return {
    value: texto,
    onChange: (e: { target: { value: string } }) => {
      const t = limparDinheiro(e.target.value);
      setTexto(t);
      onChange(reaisDeTexto(t));
    },
    onBlur: () => setTexto(arrumarDinheiro(texto)),
  };
}

export function CampoDinheiro({ valor, onChange, rotulo, grande, autoFocus }: {
  valor: number; onChange: (n: number) => void; rotulo?: string; grande?: boolean; autoFocus?: boolean;
}) {
  const campo = useTextoDinheiro(valor, onChange);
  return (
    <label className="flex flex-col gap-1.5">
      {rotulo && <span className="text-xs font-extrabold" style={{ color: "#b9b3a6" }}>{rotulo}</span>}
      <span className={`flex items-center rounded-2xl px-4 ${grande ? "h-16 justify-center" : "h-[54px]"}`}
        style={{ border: "1.5px solid #F5B800", background: "#0f0d08" }}>
        <span className="mr-2 font-bold" style={{ color: "#7b766e", fontSize: grande ? 17 : 15 }}>R$</span>
        <input
          type="text" inputMode="decimal" placeholder="0" autoFocus={autoFocus} {...campo}
          className={`bg-transparent outline-none font-black tabular-nums ${grande ? "text-[26px] w-40 text-center" : "text-xl w-full"}`}
          aria-label={rotulo ?? "Valor"}
        />
      </span>
    </label>
  );
}

export function Contador({ valor, onChange, min = 0, grande, unidade, rotulo }: {
  valor: number; onChange: (n: number) => void; min?: number; grande?: boolean; unidade?: string; rotulo?: string;
}) {
  const [texto, setTexto] = useState(valor ? String(valor) : "");
  // − / + (ou o pai) mudaram o valor: o campo acompanha
  useEffect(() => { setTexto((t) => (parseInt(t, 10) === valor || (t === "" && !valor) ? t : valor ? String(valor) : "")); }, [valor]);
  const lado = grande ? "w-[70px] h-[70px] rounded-[20px]" : "w-[54px] h-[54px] rounded-2xl";
  const caixa = { background: "#121211", border: "1px solid #26241f" };
  return (
    <div className="flex flex-col gap-1.5">
      {rotulo && <span className="text-xs font-extrabold" style={{ color: "#b9b3a6" }}>{rotulo}</span>}
      <div className="flex items-center gap-2.5">
        <button type="button" aria-label="Menos" onClick={() => onChange(Math.max(min, valor - 1))} className={`${lado} flex items-center justify-center`} style={caixa}>
          <Minus className="w-6 h-6" />
        </button>
        <div className={`flex-1 flex flex-col items-center justify-center ${grande ? "h-[90px] rounded-[22px]" : "h-[54px] rounded-2xl"}`}
          style={grande ? { border: "1.5px solid #F5B800", background: "#0f0d08" } : caixa}>
          <input type="text" inputMode="numeric" value={texto} placeholder={String(min)}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => {
              // deixa apagar tudo e digitar de novo ("1" → "" → "6"); o mínimo só vale ao sair
              const t = e.target.value.replace(/\D/g, "").slice(0, 6);
              setTexto(t);
              if (t !== "" && parseInt(t, 10) >= min) onChange(parseInt(t, 10));
            }}
            onBlur={() => { const n = Math.max(min, parseInt(texto, 10) || 0); setTexto(n ? String(n) : ""); onChange(n); }}
            className={`w-full bg-transparent text-center font-black outline-none tabular-nums ${grande ? "text-[30px] leading-none" : "text-[22px]"}`}
            aria-label={rotulo ?? "Quantidade"} />
          {unidade && <span className="text-[11px] font-extrabold" style={{ color: "#7b766e" }}>{unidade}</span>}
        </div>
        <button type="button" aria-label="Mais" onClick={() => onChange(valor + 1)} className={`${lado} flex items-center justify-center`} style={caixa}>
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}

/** Abas de duas opções ("Comprei em pacote" | "Sei o preço de 1"). */
export function DuasAbas<T extends string>({ valor, opcoes, onChange }: {
  valor: T; opcoes: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1.5 p-1 rounded-[14px]" style={{ background: "#121211" }}>
      {opcoes.map(([v, txt]) => (
        <button key={v} type="button" onClick={() => onChange(v)} className="flex-1 py-2.5 rounded-[10px] text-[13px] font-black"
          style={valor === v ? { background: "#F5B800", color: "#1A1200" } : { color: "#b9b3a6" }}>
          {txt}
        </button>
      ))}
    </div>
  );
}
