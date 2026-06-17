export interface Tier { color: string; glow: string; label: string; rank: number; }

// 1-3 = PÓDIO (acima das ligas). 4+ = ligas por faixa de posição.
// Cores centralizadas: mude aqui e reflete no app todo.
export function getTier(pos: number): Tier {
  if (pos <= 1) return { color: "#B47CFF", glow: "rgba(176,124,240,0.65)", label: "LENDA", rank: 7 };       // roxo
  if (pos <= 2) return { color: "#E6EEFF", glow: "rgba(205,225,255,0.55)", label: "GRÃO-MESTRE", rank: 6 };  // prata-platina
  if (pos <= 3) return { color: "#4FD8F5", glow: "rgba(79,216,245,0.55)", label: "MESTRE", rank: 5 };        // ciano-diamante
  if (pos <= 10) return { color: "#4AA8E8", glow: "rgba(74,168,232,0.5)", label: "DIAMANTE", rank: 4 };      // azul
  if (pos <= 20) return { color: "#B9C2CE", glow: "rgba(185,194,206,0.42)", label: "PLATINA", rank: 3 };     // prata
  if (pos <= 45) return { color: "#F2B43A", glow: "rgba(242,180,58,0.5)", label: "OURO", rank: 2 };          // dourado
  return { color: "#CD7F45", glow: "rgba(205,127,69,0.42)", label: "BRONZE", rank: 1 };                       // bronze
}

// Liga "pura" (ignora o pódio) pra detectar subida/rebaixamento de liga.
export function leagueRank(pos: number): number {
  return getTier(pos).rank;
}
