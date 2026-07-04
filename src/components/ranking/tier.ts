import lendaIcon from "@/assets/badges/lenda.png";
import graoMestreIcon from "@/assets/badges/grao-mestre.png";
import diamanteIcon from "@/assets/badges/diamante.png";
import platinaIcon from "@/assets/badges/platina.png";
import ouroIcon from "@/assets/badges/ouro.png";
import bronzeIcon from "@/assets/badges/bronze.png";

export interface Tier { color: string; glow: string; label: string; rank: number; icon: string; }

// 1=Lenda, 2=Grao-Mestre, 3=Mestre (topo do Diamante, mesma cor/escudo),
// 4-10 Diamante, 11-20 Ouro, 21-45 Platina, 46+ Bronze.
// Paleta OFICIAL do app: degradê dourado do topo pro meio e neutros embaixo.
// Sem roxo/azul/ciano — as ligas se distinguem pelo tom de dourado + os escudos.
export function getTier(pos: number): Tier {
  if (pos <= 1) return { color: "#FFCF5A", glow: "rgba(255,207,90,0.55)", label: "LENDA", rank: 7, icon: lendaIcon };
  if (pos <= 2) return { color: "#F5B544", glow: "rgba(245,181,68,0.5)", label: "GRÃO-MESTRE", rank: 6, icon: graoMestreIcon };
  if (pos <= 3) return { color: "#E0A63A", glow: "rgba(224,166,58,0.5)", label: "MESTRE", rank: 5, icon: diamanteIcon };
  if (pos <= 10) return { color: "#C79A46", glow: "rgba(199,154,70,0.45)", label: "DIAMANTE", rank: 4, icon: diamanteIcon };
  if (pos <= 20) return { color: "#B0862E", glow: "rgba(176,134,46,0.45)", label: "OURO", rank: 3, icon: ouroIcon };
  if (pos <= 45) return { color: "#8B9299", glow: "rgba(139,146,153,0.4)", label: "PLATINA", rank: 2, icon: platinaIcon };
  return { color: "#A06A3A", glow: "rgba(160,106,58,0.4)", label: "BRONZE", rank: 1, icon: bronzeIcon };
}

export function leagueRank(pos: number): number { return getTier(pos).rank; }
