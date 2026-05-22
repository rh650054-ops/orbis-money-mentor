import { useState } from "react";
import { BatteryLow, BatteryFull } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useBatterySaver } from "@/hooks/useBatterySaver";

interface DefconStartScreenProps {
  dailyGoal: number;
  totalBlocks: number;
  onStart: () => void;
  onExit: () => void;
}

export function DefconStartScreen({ dailyGoal, totalBlocks, onStart, onExit }: DefconStartScreenProps) {
  const { enabled: battery, toggle: toggleBattery } = useBatterySaver();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="h-[100dvh] bg-black pt-safe pb-safe flex flex-col px-6 select-none overflow-hidden">
      {/* Top: brand */}
      <div className="pt-4 text-center">
        <div className="text-[10px] font-mono text-red-500 tracking-[0.5em] uppercase">
          DEFCON 4
        </div>
      </div>

      {/* Middle: hero + plan card */}
      <div className="flex-1 flex flex-col justify-center min-h-0 gap-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-white tracking-tight leading-none">
            MODO
            <br />
            DESAFIO
          </h1>
          <p className="text-[11px] text-neutral-500 font-mono mt-3 max-w-[240px] mx-auto">
            Blocos de 60min. Sem distrações. Apenas vendas.
          </p>
        </div>

        <div className="bg-neutral-900/70 border border-white/5 rounded-2xl p-5 space-y-3.5">
          <Row label="Meta do dia" value={formatCurrency(dailyGoal)} accent />
          <div className="h-px bg-white/5" />
          <Row label="Blocos" value={`${totalBlocks} × 60min`} />
          <Row label="Pausa" value="5 min" muted />
        </div>

        {/* Battery saver */}
        <button
          onClick={toggleBattery}
          className={`flex items-center justify-between gap-3 px-4 h-12 rounded-xl border transition-colors ${
            battery
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-neutral-900/50 border-white/5"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {battery ? (
              <BatteryLow className="w-4 h-4 text-emerald-400" />
            ) : (
              <BatteryFull className="w-4 h-4 text-neutral-500" />
            )}
            <div className="text-left">
              <p className="text-xs font-semibold text-white leading-tight">
                Economia de bateria
              </p>
              <p className="text-[10px] text-neutral-500 leading-tight">
                {battery ? "Animações reduzidas" : "Para celulares fracos"}
              </p>
            </div>
          </div>
          <div
            className={`w-9 h-5 rounded-full transition-colors relative ${
              battery ? "bg-emerald-500" : "bg-neutral-700"
            }`}
          >
            <div
              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                battery ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </div>
        </button>
      </div>

      {/* Bottom: actions */}
      <div className="pb-4 space-y-2">
        <button
          onClick={() => (confirming ? onStart() : setConfirming(true))}
          className={`w-full h-14 rounded-2xl font-black text-base active:scale-[0.98] transition-all ${
            confirming
              ? "bg-red-600 text-white shadow-[0_0_30px_-5px_rgba(220,38,38,0.6)]"
              : "bg-red-600 text-white"
          } ${battery ? "" : "animate-pulse"}`}
        >
          {confirming ? "CONFIRMAR — INICIAR AGORA" : "INICIAR DEFCON 4"}
        </button>
        <button
          onClick={onExit}
          className="w-full h-10 text-neutral-600 font-mono text-xs active:scale-95"
        >
          Sair
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  accent,
  muted,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs font-mono text-neutral-500">{label}</span>
      <span
        className={`font-black ${
          accent ? "text-xl text-[#F4A100]" : muted ? "text-base text-neutral-400" : "text-base text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
