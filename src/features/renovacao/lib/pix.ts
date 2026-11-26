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

/** Hotmart customer area: "Minhas compras" > the subscription > pay / generate a new Pix. */
export const HOTMART_AREA_CLIENTE = "https://consumer.hotmart.com/purchase";

/** "venceu ontem" / "venceu dia 22/10" */
export function venceuTexto(iso: string, agora: Date = new Date()): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "venceu";
  const dia = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dif = Math.round((dia(agora) - dia(d)) / 86400000);
  if (dif <= 0) return "venceu hoje";
  if (dif === 1) return "venceu ontem";
  return `venceu dia ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`;
}

/** "Gerar Pix" (official Hotmart negotiation) is OFF until the real integration is validated:
    it only shows when the build sets VITE_GERAR_PIX=1. The server has its own switch as well. */
export const gerarPixLigado = (): boolean => import.meta.env.VITE_GERAR_PIX === "1";

/** What to tell the person when no Pix came back. hotmart = offer the Hotmart area as the way out. */
export function avisoDoGerarPix(r: { acao: string; motivo?: string }): { texto: string; hotmart: boolean } {
  if (r.acao === "em_andamento") return { texto: "Seu Pix já está sendo gerado. Espere alguns segundos e toque de novo.", hotmart: false };
  if (r.acao === "falhou") return { texto: "A Hotmart não gerou o Pix agora. Tente de novo em alguns minutos.", hotmart: true };
  if (r.acao === "incerto") return { texto: "Não consegui confirmar se o Pix foi gerado. Para você não pagar duas vezes, veja a cobrança na Hotmart.", hotmart: true };
  if (r.motivo === "pix_automatico") return { texto: "Sua assinatura é no Pix Automático: autorize o débito no app do seu banco ou pague pela Hotmart.", hotmart: true };
  return { texto: "Não deu para gerar o Pix por aqui agora. Você pode pagar pela Hotmart.", hotmart: true };
}
