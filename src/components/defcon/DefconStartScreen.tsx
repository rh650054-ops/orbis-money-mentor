import { useState } from "react";
import { BatteryLow, BatteryFull } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { useBatterySaver } from "@/shared/hooks/use-battery-saver";

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
    <div className="h-[100dvh] bg-background pt-safe pb-safe flex flex-col px-6 select-none overflow-hidden">
      {/* Top: brand */}
      <div className="pt-4 text-center">
        <div className="text-xs font-mono text-destructive tracking-[0.5em] uppercase">
          DEFCON 4
        </div>
      </div>

      {/* Middle: hero + plan card */}
      <div className="flex-1 flex flex-col justify-center min-h-0 gap-6">
        <div className="text-center">
          <h1 className="text-4xl font-black text-foreground tracking-tight leading-none">
            MODO
            <br />
            DESAFIO
          </h1>
          <p className="text-xs text-muted-foreground font-mono mt-3 max-w-[240px] mx-auto">
            Blocos de 60min. Sem distrações. Apenas vendas.
          </p>
        </div>

        <div className="bg-card/70 border border-border rounded-2xl p-5 space-y-3.5">
          <Row label="Meta do dia" value={formatCurrency(dailyGoal)} accent />
          <div className="h-px bg-border" />
          <Row label="Blocos" value={`${totalBlocks} × 60min`} />
          <Row label="Pausa" value="5 min" muted />
        </div>

        {/* Battery saver */}
        <button
          onClick={toggleBattery}
          className={`flex items-center justify-between gap-3 px-4 h-12 rounded-xl border transition-colors ${
            battery
              ? "bg-success/10 border-success/30"
              : "bg-card/50 border-border"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {battery ? (
              <BatteryLow className="w-4 h-4 text-success" />
            ) : (
              <BatteryFull className="w-4 h-4 text-muted-foreground" />
            )}
            <div className="text-left">
              <p className="text-xs font-semibold text-foreground leading-tight">
                Economia de bateria
              </p>
              <p className="text-xs text-muted-foreground leading-tight">
                {battery ? "Animações reduzidas" : "Para celulares fracos"}
              </p>
            </div>
          </div>
          <div
            className={`w-9 h-5 rounded-full transition-colors relative ${
              battery ? "bg-success" : "bg-muted"
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
          className={`w-full h-14 rounded-2xl font-black text-base active:scale-[0.98] transition-[colors,transform,opacity] ${
            confirming
              ? "bg-destructive text-destructive-foreground shadow-[0_0_30px_-5px_hsl(var(--destructive)/0.6)]"
              : "bg-destructive text-destructive-foreground"
          }`}
        >
          {confirming ? "CONFIRMAR — INICIAR AGORA" : "INICIAR DEFCON 4"}
        </button>
        <button
          onClick={onExit}
          className="w-full h-10 text-muted-foreground font-mono text-xs active:scale-95"
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
      <span className="text-xs font-mono text-muted-foreground">{label}</span>
      <span
        className={`font-black ${
          accent ? "text-xl text-primary" : muted ? "text-base text-muted-foreground" : "text-base text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
