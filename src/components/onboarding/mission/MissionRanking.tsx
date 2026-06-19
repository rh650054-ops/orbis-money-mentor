import { getTier } from "@/components/ranking/tier";
import GoldParticles from "../GoldParticles";

interface MissionRankingProps {
  /** Avança pra fase de recompensa. */
  onAdvance: () => void;
}

// Escada de patentes (da inicial pro topo). Usa posições representativas
// pra puxar a cor/escudo certo de cada faixa do ranking real.
const LADDER = [
  { pos: 999, hint: "onde você começa" },
  { pos: 30, hint: "" },
  { pos: 8, hint: "" },
  { pos: 1, hint: "topo" },
];

/**
 * Fase 5 — Ranking & Patentes: explica que o vendedor sobe de patente conforme
 * fatura, que existem ligas e prêmios mensais (em breve), e que ele já entra na
 * Liga Bronze com R$0 — pronto pra subir. Passo informativo: avança no botão.
 */
export default function MissionRanking({ onAdvance }: MissionRankingProps) {
  const bronze = getTier(999);

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center px-6 animate-fade-in overflow-y-auto">
      <GoldParticles />
      <div className="relative flex flex-col items-center text-center max-w-xs py-8">
        <p className="text-[11px] font-bold uppercase tracking-wider text-primary/80 mb-1">
          Fase 5 de 6
        </p>
        <h1 className="text-2xl font-bold text-primary mb-1.5">Ranking & Patentes 🏅</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Cada venda te faz subir de patente. Quanto mais você fatura, mais alto você chega.
        </p>

        {/* Escada de patentes */}
        <div className="flex items-end justify-center gap-2 mb-5">
          {LADDER.map(({ pos, hint }) => {
            const tier = getTier(pos);
            const isStart = pos === 999;
            return (
              <div key={pos} className="flex flex-col items-center gap-1">
                <img
                  src={tier.icon}
                  alt={tier.label}
                  className="object-contain"
                  style={{
                    width: isStart ? 56 : 40,
                    height: isStart ? 56 : 40,
                    filter: `drop-shadow(0 0 ${isStart ? 14 : 8}px ${tier.glow})`,
                    opacity: isStart ? 1 : 0.85,
                  }}
                />
                <span
                  className="text-[9px] font-bold uppercase tracking-wide"
                  style={{ color: tier.color }}
                >
                  {tier.label}
                </span>
                {hint && (
                  <span className="text-[8px] text-muted-foreground">{hint}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Ligas + prêmios */}
        <div className="w-full bg-card border border-border rounded-2xl p-4 mb-4 text-left space-y-2.5">
          <div className="flex items-start gap-2.5">
            <span className="text-base">🏆</span>
            <p className="text-sm text-foreground">
              Você disputa o ranking do mês com outros vendedores.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <span className="text-base">🎁</span>
            <p className="text-sm text-foreground">
              Ligas e <span className="font-semibold text-primary">prêmios mensais</span>{" "}
              <span className="text-muted-foreground">(em breve)</span> pra quem mais vende.
            </p>
          </div>
        </div>

        {/* Onde ele começa */}
        <div
          className="w-full rounded-2xl p-4 mb-6 flex items-center gap-3 text-left"
          style={{
            border: `1px solid ${bronze.color}66`,
            background: `linear-gradient(180deg, ${bronze.glow}, rgba(255,255,255,0.02))`,
          }}
        >
          <img
            src={bronze.icon}
            alt={bronze.label}
            className="w-12 h-12 object-contain shrink-0"
            style={{ filter: `drop-shadow(0 0 10px ${bronze.glow})` }}
          />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: bronze.color }}>
              Você começa na Liga {bronze.label}
            </p>
            <p className="text-lg font-black text-foreground leading-tight">R$ 0,00</p>
            <p className="text-xs text-muted-foreground">É daqui que você começa a subir 🚀</p>
          </div>
        </div>

        <button
          onClick={onAdvance}
          className="w-full py-3.5 rounded-xl font-bold text-primary-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform"
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
