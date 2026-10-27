/* Step 1 of the challenge: how much profit, in how many days. */
import { Minus, Plus } from "lucide-react";
import { MoneyInput } from "@/shared/ui/money-input";
import { Chip, COR, PRESS } from "./ui";
import { brl0 } from "../lib/formato";

const VALORES = [1000, 3000, 5000, 10000];
const PRAZOS = [7, 15, 30];

interface Props {
  alvo: number;
  dias: number;
  onAlvo: (v: number) => void;
  onDias: (v: number) => void;
  onAnalisar: () => void;
}

export function PassoMeta({ alvo, dias, onAlvo, onDias, onAnalisar }: Props) {
  return (
    <>
      <p className="orbis-section mt-5 mb-2.5 px-0.5">1 · Quanto de lucro?</p>
      <div className="flex items-center h-16 px-4 rounded-[14px]" style={{ background: "#0a0a0d", border: "1px solid rgba(245,184,0,.4)" }}>
        <MoneyInput value={alvo} onChange={onAlvo} decimals={0} placeholder="R$ 0"
          className="border-0 bg-transparent px-0 h-12 text-[24px] font-black tracking-tight focus-visible:ring-0" />
      </div>
      <div className="flex flex-wrap gap-2 mt-2.5">
        {VALORES.map((v) => <Chip key={v} on={alvo === v} onClick={() => onAlvo(v)}>{brl0(v)}</Chip>)}
      </div>

      <p className="orbis-section mt-5 mb-2.5 px-0.5">2 · Em quantos dias?</p>
      <div className="flex items-center gap-2 flex-wrap">
        {PRAZOS.map((d) => <Chip key={d} on={dias === d} onClick={() => onDias(d)}>{d} dias</Chip>)}
        <span className="inline-flex items-center gap-1 ml-auto">
          <Passo onClick={() => onDias(Math.max(1, dias - 1))} label="Menos um dia"><Minus className="w-4 h-4" /></Passo>
          <span className="orbis-num w-10 text-center text-[17px] font-black">{dias}</span>
          <Passo onClick={() => onDias(Math.min(90, dias + 1))} label="Mais um dia"><Plus className="w-4 h-4" /></Passo>
        </span>
      </div>
      <p className="text-[12px] mt-2" style={{ color: COR.mute }}>Conta a partir de hoje. Lucro = o que você vende menos o custo de cada unidade.</p>

      <button type="button" disabled={alvo <= 0} onClick={onAnalisar}
        className="orbis-cta w-full mt-5 disabled:opacity-40" style={{ height: 56 }}>
        ANALISAR MEU CORRE
      </button>
    </>
  );
}

export function Passo({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className={`w-10 h-10 rounded-full flex items-center justify-center ${PRESS}`}
      style={{ background: COR.caixa, border: "1px solid rgba(255,255,255,.12)", color: COR.texto }}>
      {children}
    </button>
  );
}
