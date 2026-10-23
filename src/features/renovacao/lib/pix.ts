/** Copies the Pix "copia e cola"; falls back to a hidden textarea on old browsers. */
export async function copiarPix(codigo: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(codigo); return true; } catch { /* sem permissão: tenta o jeito antigo */ }
  try {
    const t = document.createElement("textarea");
    t.value = codigo; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); document.body.removeChild(t);
    return ok;
  } catch { return false; }
}

/** "vence hoje às 21h" / "vence amanhã" / "vence dia 28/10" */
export function venceTexto(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dif = Math.round((dia(d) - dia(agora)) / 86400000);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (dif <= 0) return `vence hoje às ${hora}`;
  if (dif === 1) return "vence amanhã";
  return `vence dia ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

export const reais = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");
