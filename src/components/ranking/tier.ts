import lendaIcon from "@/assets/badges/lenda.png";
import graoMestreIcon from "@/assets/badges/grao-mestre.png";
import diamanteIcon from "@/assets/badges/diamante.png";
import platinaIcon from "@/assets/badges/platina.png";
import ouroIcon from "@/assets/badges/ouro.png";
import bronzeIcon from "@/assets/badges/bronze.png";

export interface Tier { color: string; glow: string; label: string; rank: number; icon: string; }

// 1=Lenda, 2=Grao-Mestre, 3=Mestre (topo do Diamante, mesma cor/escudo),
// 4-10 Diamante, 11-20 Platina, 21-45 Ouro, 46+ Bronze.
export function getTier(pos: number): Tier {
  if (pos <= 1) return { color: "#B47CFF", glow: "rgba(176,124,240,0.65)", label: "LENDA", rank: 7, icon: lendaIcon };
  if (pos <= 2) return { color: "#E6EEFF", glow: "rgba(205,225,255,0.55)", label: "GRÃO-MESTRE", rank: 6, icon: graoMestreIcon };
  if (pos <= 3) return { color: "#4FD8F5", glow: "rgba(79,216,245,0.55)", label: "MESTRE", rank: 5, icon: diamanteIcon };
  if (pos <= 10) return { color: "#4FD8F5", glow: "rgba(79,216,245,0.55)", label: "DIAMANTE", rank: 4, icon: diamanteIcon };
  if (pos <= 20) return { color: "#9FB2CC", glow: "rgba(159,178,204,0.45)", label: "PLATINA", rank: 3, icon: platinaIcon };
  if (pos <= 45) return { color: "#F2B43A", glow: "rgba(242,180,58,0.5)", label: "OURO", rank: 2, icon: ouroIcon };
  return { color: "#CD7F45", glow: "rgba(205,127,69,0.45)", label: "BRONZE", rank: 1, icon: bronzeIcon };
}

export function leagueRank(pos: number): number { return getTier(pos).rank; }
