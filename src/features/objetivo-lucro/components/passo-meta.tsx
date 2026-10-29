/* Step 1 of the mission: how much profit, in how many days — HUD style, with the
   live "per day" read so the number already means something before the analysis. */
import { Minus, Plus, Crosshair } from "lucide-react";
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
  const fim = new Date(); fim.setDate(fim.getDate() + dias - 1);
  return (
    <>
      <section className="vant-hud mt-4 rounded-[24px] px-5 pt-5 pb-5 overflow-hidden" style={{ border: "1px solid rgba(245,184,0,.35)" }}>
        <span className="vant-canto" />
        <p className="orbis-section inline-flex items-center gap-1.5" style={{ color: COR.ouro }}><Crosshair className="w-3.5 h-3.5" /> Definir a missão</p>

        <p className="orbis-section mt-5" style={{ color: COR.mute }}>01 · Quanto de lucro?</p>
        <div className="mt-2 flex items-baseline gap-2 pb-2" style={{ borderBottom: "1.5px solid rgba(245,184,0,.5)" }}>
          <span className="vant-missao-num text-[34px] leading-none" style={{ color: COR.ouro }}>R$</span>
          <MoneyInput value={alvo} onChange={onAlvo} decimals={0} placeholder="0"
            className="vant-missao-num border-0 bg-transparent px-0 h-14 text-[52px] leading-none tracking-tight focus-visible:ring-0" />
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {VALORES.map((v) => <Chip key={v} on={alvo === v} onClick={() => onAlvo(v)}>{brl0(v)}</Chip>)}
        </div>

        <p className="orbis-section mt-6" style={{ color: COR.mute }}>02 · Em quantos dias?</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1">
            <Passo onClick={() => onDias(Math.max(1, dias - 1))} label="Menos um dia"><Minus className="w-4 h-4" /></Passo>
            {/* 29/10 (Rick): tocar no número e digitar o período (1 a 90 dias) */}
            <input type="number" inputMode="numeric" min={1} max={90} aria-label="Quantos dias"
              value={dias} onFocus={(e) => e.currentTarget.select()}
              onChange={(e) => { const v = Math.round(Number(e.target.value)); if (v >= 1) onDias(Math.min(90, v)); }}
              className="vant-missao-num w-16 text-center text-[40px] leading-none bg-transparent rounded-[10px] outline-none focus:ring-1 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              style={{ color: COR.texto, borderBottom: "1.5px dashed rgba(245,184,0,.45)" }} />
            <Passo onClick={() => onDias(Math.min(90, dias + 1))} label="Mais um dia"><Plus className="w-4 h-4" /></Passo>
          </span>
          <span className="text-right">
            <span className="block text-[12px] font-bold" style={{ color: COR.sub }}>de hoje até</span>
            <span className="vant-missao-num block text-[22px] leading-none mt-0.5" style={{ color: COR.ouro }}>{fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span>
          </span>
        </div>
        <div className="flex gap-2 mt-3">
          {PRAZOS.map((d) => <Chip key={d} on={dias === d} onClick={() => onDias(d)}>{d} dias</Chip>)}
          <span className="self-center text-[11px] font-bold" style={{ color: COR.mute }}>ou toque no número</span>
        </div>

        {alvo > 0 && (
          <div className="mt-5 rounded-[14px] px-4 py-3 flex items-center justify-between gap-3" style={{ background: "rgba(0,0,0,.45)", border: `1px solid ${COR.linha}` }}>
            <span className="text-[12px] font-bold leading-snug" style={{ color: COR.sub }}>Lucro por dia corrido<br /><span style={{ color: COR.mute }}>a Vant ajusta pelos seus dias de trabalho</span></span>
            <span className="vant-missao-num text-[30px] leading-none shrink-0" style={{ color: COR.texto }}>{brl0(alvo / dias)}</span>
          </div>
        )}
      </section>

      <button type="button" disabled={alvo <= 0} onClick={onAnalisar}
        className="orbis-cta w-full mt-4 disabled:opacity-40" style={{ height: 56 }}>
        VANT, ANALISA MEU CORRE
      </button>
      <p className="text-[11.5px] mt-2 text-center" style={{ color: COR.mute }}>Banco (Open Finance) · vendas no app · calotes · custo por produto · últimos 60 dias</p>
    </>
  );
}

export function Passo({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className={`w-10 h-10 rounded-full flex items-center justify-center ${PRESS}`}
      style={{ background: COR.caixa, border: "1px solid rgba(255,255,255,.14)", color: COR.texto }}>
      {children}
    </button>
  );
}
