import bronzeIcon from "@/assets/badges/bronze.png";
import ouroIcon from "@/assets/badges/ouro.png";
import platinaIcon from "@/assets/badges/platina.png";
import diamanteIcon from "@/assets/badges/diamante.png";
import graoMestreIcon from "@/assets/badges/grao-mestre.png";
import lendaIcon from "@/assets/badges/lenda.png";

// Patentes da mais alta pra mais baixa. Bronze é onde todo mundo começa.
// Ordem das ligas: Diamante > Ouro > Platina > Bronze (definida em ranking/tier.ts).
const PATENTES = [
  { label: "LENDA", icon: lendaIcon, color: "#B47CFF", hint: "Top 1" },
  { label: "GRÃO-MESTRE", icon: graoMestreIcon, color: "#E6EEFF", hint: "Top 2" },
  { label: "MESTRE", icon: diamanteIcon, color: "#4FD8F5", hint: "Top 3" },
  { label: "DIAMANTE", icon: diamanteIcon, color: "#4FD8F5", hint: "Top 10" },
  { label: "OURO", icon: ouroIcon, color: "#F2B43A", hint: "Top 20" },
  { label: "PLATINA", icon: platinaIcon, color: "#9FB2CC", hint: "Top 45" },
  { label: "BRONZE", icon: bronzeIcon, color: "#CD7F45", hint: "Você começa aqui", start: true },
];

/**
 * Card de patentes pro onboarding do ranking: mostra TODAS as patentes com as
 * insígnias, da Lenda (topo) ao Bronze (onde o vendedor começa). Renderizado
 * dentro do balão do ScreenCoach.
 */
export default function PatentesCard() {
  return (
    <div>
      <h3 className="text-base font-bold text-foreground mb-1">Ranking e patentes 🏅</h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
        Cada venda te faz subir. Você começa no <span className="font-semibold" style={{ color: "#CD7F45" }}>Bronze</span> e mira o topo:
      </p>

      <div className="space-y-1.5 mb-1 max-h-[46vh] overflow-y-auto pr-1">
        {PATENTES.map((p) => (
          <div
            key={p.label}
            className="flex items-center gap-3 rounded-xl px-2.5 py-1.5"
            style={
              p.start
                ? {
                    border: `1px solid ${p.color}80`,
                    background: `linear-gradient(180deg, ${p.color}1f, transparent)`,
                  }
                : { border: "1px solid hsl(var(--border))" }
            }
          >
            <img
              src={p.icon}
              alt={p.label}
              className="w-8 h-8 object-contain shrink-0"
              style={{ filter: `drop-shadow(0 0 6px ${p.color}66)` }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black leading-tight" style={{ color: p.color }}>
                {p.label}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">{p.hint}</p>
            </div>
            {p.start && <span className="text-base shrink-0">🚀</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
