import { useState, useRef, useEffect } from "react";
import { formatCurrency } from "@/lib/utils";

interface DefconStartScreenProps {
  defaultGoal: number;
  onStart: (goal: number) => void;
  onExit: () => void;
}

export function DefconStartScreen({ defaultGoal, onStart, onExit }: DefconStartScreenProps) {
  const [goal, setGoal] = useState(defaultGoal > 0 ? String(defaultGoal) : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (defaultGoal > 0) {
      setGoal(String(defaultGoal));
    }
  }, [defaultGoal]);

  const handleStart = () => {
    const value = parseFloat(goal) || 0;
    if (value <= 0) return;
    onStart(value);
  };

  const numericGoal = parseFloat(goal) || 0;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
      {/* Title */}
      <div className="text-center mb-12">
        <div className="text-xs font-mono text-red-500 tracking-[0.5em] uppercase mb-4">
          DEFCON 4
        </div>
        <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight mb-3">
          MODO DESAFIO
        </h1>
        <p className="text-sm text-neutral-600 font-mono max-w-xs mx-auto">
          Blocos de 50 minutos. Sem distrações. Sem pausas. Apenas vendas.
        </p>
      </div>

      {/* Goal input */}
      <div className="w-full max-w-sm space-y-4 mb-10">
        <label className="block text-sm font-mono text-neutral-500 text-center">
          Qual sua missão de vendas hoje?
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-neutral-600 font-bold">
            R$
          </span>
          <input
            ref={inputRef}
            type="number"
            inputMode="decimal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onFocus={() => { if (goal === "0") setGoal(""); }}
            placeholder="0"
            className="w-full h-20 bg-neutral-900 border-2 border-neutral-800 rounded-xl text-center text-4xl font-black text-white pl-16 pr-4 focus:outline-none focus:border-red-500 transition-colors placeholder:text-neutral-700"
          />
        </div>
        {numericGoal > 0 && (
          <p className="text-center text-sm text-neutral-500 font-mono">
            Meta: {formatCurrency(numericGoal)}
          </p>
        )}
      </div>

      {/* Start button */}
      <div className="w-full max-w-sm space-y-3">
        <button
          onClick={handleStart}
          disabled={numericGoal <= 0}
          className="w-full h-16 bg-red-600 text-white font-black text-xl rounded-xl disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-transform"
        >
          INICIAR DEFCON 4
        </button>

        <button
          onClick={onExit}
          className="w-full h-12 bg-transparent text-neutral-600 font-mono text-sm active:scale-95 transition-transform"
        >
          Sair do modo desafio
        </button>
      </div>

      {/* Rules */}
      <div className="mt-12 max-w-xs text-center">
        <ul className="text-xs text-neutral-700 font-mono space-y-1">
          <li>• Blocos de 50 minutos</li>
          <li>• Sem pausa permitida</li>
          <li>• Registre vendas ao fim de cada bloco</li>
          <li>• Encerrar = perder streak</li>
        </ul>
      </div>
    </div>
  );
}
