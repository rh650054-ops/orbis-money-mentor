import { useEffect } from "react";

interface DefconTimerProps {
  remainingSeconds: number;
  blockIndex: number;
  onTimeUp: () => void;
}

export function DefconTimer({ remainingSeconds, blockIndex, onTimeUp }: DefconTimerProps) {
  useEffect(() => {
    if (remainingSeconds <= 0) {
      onTimeUp();
    }
  }, [remainingSeconds, onTimeUp]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const progress = ((50 * 60 - remainingSeconds) / (50 * 60)) * 100;

  const isUrgent = remainingSeconds < 300; // last 5 minutes

  return (
    <div className="flex flex-col items-center gap-12 w-full max-w-md">
      {/* Block label */}
      <div className="text-xs font-mono text-neutral-600 tracking-[0.3em] uppercase">
        Bloco de Ataque #{blockIndex + 1}
      </div>

      {/* Timer */}
      <div className={`text-8xl md:text-9xl font-black font-mono tabular-nums tracking-tighter ${
        isUrgent ? "text-red-500 animate-pulse" : "text-white"
      }`}>
        {String(minutes).padStart(2, "0")}
        <span className={isUrgent ? "text-red-500/50" : "text-white/30"}>:</span>
        {String(seconds).padStart(2, "0")}
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-neutral-900 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-1000 ease-linear rounded-full ${
            isUrgent ? "bg-red-500" : "bg-white/20"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Mantra */}
      <p className="text-lg md:text-xl text-neutral-500 font-medium italic text-center">
        "Venda agora. Pense depois."
      </p>
    </div>
  );
}
