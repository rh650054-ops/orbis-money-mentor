import { useEffect, useState } from "react";
import { Wallet, FastForward, Play } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import QuickExpenseButton from "@/components/QuickExpenseButton";
import type { MotivoPausa } from "@/hooks/useDefconChallenge";

interface DefconLunchPauseProps {
  lunchPauseRemaining: number;
  totalSold: number;
  onSkip?: () => void;
  /** banheiro / conversar = "até eu voltar" (conta pra cima); almoço = tempo escolhido (conta pra baixo). */
  motivo?: MotivoPausa;
  startedAt?: Date | null;
}

const ROTULO: Record<MotivoPausa, { emoji: string; titulo: string; frase: string }> = {
  banheiro: { emoji: "🚻", titulo: "PAUSA · BANHEIRO", frase: "Vai lá. O relógio da hora está parado." },
  conversar: { emoji: "💬", titulo: "PAUSA · CONVERSA", frase: "Troca a ideia. O relógio da hora está parado." },
  almoco: { emoji: "🍽️", titulo: "PAUSA · ALMOÇO", frase: "Bom apetite. Recarregue as energias." },
};

function mmss(total: number) {
  const m = Math.floor(Math.max(0, total) / 60);
  const s = Math.max(0, total) % 60;
  return { m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0") };
}

export function DefconLunchPause({ lunchPauseRemaining, totalSold, onSkip, motivo = "almoco", startedAt }: DefconLunchPauseProps) {
  const aberta = motivo !== "almoco";
  const [decorrido, setDecorrido] = useState(0);
  const [expenseOpen, setExpenseOpen] = useState(false);

  // Pausa aberta (banheiro/conversar): mostra quanto tempo já passou, segundo a segundo.
  useEffect(() => {
    if (!aberta || !startedAt) return;
    const tick = () => setDecorrido(Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [aberta, startedAt]);

  const { m, s } = mmss(aberta ? decorrido : lunchPauseRemaining);
  const r = ROTULO[motivo] ?? ROTULO.almoco;

  return (
    <div className="min-h-[100dvh] bg-background pt-safe pb-safe flex flex-col items-center justify-center px-6 select-none">
      <div className="text-center space-y-8">
        <div className="text-6xl">{r.emoji}</div>

        <div>
          <div className="text-xs font-mono text-warning/70 tracking-[0.3em] uppercase mb-3">
            {r.titulo}
          </div>
          <div className="text-7xl md:text-8xl font-black font-mono tabular-nums tracking-tighter text-foreground">
            {m}
            <span className="text-foreground/30">:</span>
            {s}
          </div>
          <div className="mt-2 text-[11px] font-mono text-muted-foreground tracking-wider uppercase">
            {aberta ? "tempo de folga" : "volta em"}
          </div>
        </div>

        <p className="text-lg text-warning/60 font-medium">{r.frase}</p>

        <div className="text-sm font-mono text-muted-foreground">
          Vendido até agora: {formatCurrency(totalSold)}
        </div>

        {/* Ações */}
        <div className="flex flex-col items-center gap-3">
          {aberta ? (
            onSkip && (
              <button
                onClick={onSkip}
                data-tour="defcon-voltei"
                className="flex items-center gap-2 px-8 py-4 rounded-full bg-success text-success-foreground font-black text-base tracking-wide shadow-lg shadow-success/20 active:scale-95 transition-[colors,transform,opacity] hover:bg-success/90"
              >
                <Play className="w-4 h-4" strokeWidth={3} />
                VOLTEI — RETOMAR
              </button>
            )
          ) : (
            <>
              <button
                onClick={() => setExpenseOpen(true)}
                className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-warning text-warning-foreground font-black text-sm tracking-wide shadow-lg shadow-warning/20 active:scale-95 transition-[colors,transform,opacity] hover:bg-warning/90"
              >
                <Wallet className="w-4 h-4" strokeWidth={3} />
                REGISTRAR CUSTO DO ALMOÇO
              </button>
              {onSkip && (
                <button
                  onClick={onSkip}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full border border-border bg-foreground/5 text-foreground/80 font-bold text-xs tracking-wide active:scale-95 transition-[colors,transform,opacity] hover:bg-foreground/10 hover:text-foreground"
                >
                  <FastForward className="w-3.5 h-3.5" strokeWidth={3} />
                  VOLTAR AO DESAFIO AGORA
                </button>
              )}
            </>
          )}
        </div>

        <div className="text-xs font-mono text-muted-foreground">
          {aberta ? "Se esquecer, o desafio volta sozinho depois de um tempo" : "O desafio volta automaticamente"}
        </div>
      </div>

      {!aberta && (
        <QuickExpenseButton
          open={expenseOpen}
          onOpenChange={setExpenseOpen}
          hideFab
          initialCategoryKey="almoco"
        />
      )}
    </div>
  );
}
