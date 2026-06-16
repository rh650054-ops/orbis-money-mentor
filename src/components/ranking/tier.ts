export interface Tier { color: string; glow: string; label: string; }

// Cor por posicao: melhora conforme sobe (aspiracional).
export function getTier(pos: number): Tier {
  if (pos <= 1) return { color: "#C9A6FF", glow: "rgba(176,124,240,0.65)", label: "LENDA" };
  if (pos <= 2) return { color: "#6FD3FF", glow: "rgba(93,173,226,0.55)", label: "DIAMANTE" };
  if (pos <= 3) return { color: "#3EE0C4", glow: "rgba(56,224,192,0.5)", label: "PLATINA" };
  if (pos <= 10) return { color: "#F5B833", glow: "rgba(245,184,51,0.55)", label: "OURO" };
  if (pos <= 30) return { color: "#D7DBE0", glow: "rgba(215,219,224,0.4)", label: "PRATA" };
  if (pos <= 80) return { color: "#E0925A", glow: "rgba(224,146,90,0.4)", label: "BRONZE" };
  return { color: "#9AA0A6", glow: "rgba(154,160,166,0.3)", label: "ASPIRANTE" };
}
