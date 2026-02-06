import { useState, useRef, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface DefconCheckpointProps {
  blockIndex: number;
  onSubmit: (amount: number) => void;
}

export function DefconCheckpoint({ blockIndex, onSubmit }: DefconCheckpointProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const amount = parseFloat(value) || 0;
    onSubmit(amount);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  };

  const numericValue = parseFloat(value) || 0;

  return (
    <div className="flex flex-col items-center gap-10 w-full max-w-sm">
      {/* Block ended */}
      <div className="text-center">
        <div className="text-xs font-mono text-red-500/60 tracking-[0.3em] uppercase mb-2">
          Tempo esgotado
        </div>
        <div className="text-2xl font-bold text-white">
          Bloco #{blockIndex + 1} encerrado
        </div>
      </div>

      {/* Sales input */}
      <div className="w-full space-y-3">
        <label className="block text-sm font-mono text-neutral-500 text-center">
          Quanto você vendeu nesse bloco?
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-neutral-600 font-bold">
            R$
          </span>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="0"
            className="w-full h-20 bg-neutral-900 border-2 border-neutral-700 rounded-xl text-center text-4xl font-black text-white pl-16 pr-4 focus:outline-none focus:border-red-500 transition-colors placeholder:text-neutral-700"
          />
        </div>
        {numericValue > 0 && (
          <p className="text-center text-sm text-neutral-500 font-mono">
            {formatCurrency(numericValue)}
          </p>
        )}
      </div>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        className="w-full h-16 bg-white text-black font-black text-xl rounded-xl active:scale-95 transition-transform"
      >
        REGISTRAR
      </button>
    </div>
  );
}
