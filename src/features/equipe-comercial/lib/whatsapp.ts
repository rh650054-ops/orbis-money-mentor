/** wa.me link with the opening line the team uses with a lead from the ranking. */
export function linkWhatsappLead(numero: string, nome: string | null): string {
  const quem = (nome ?? "").trim().split(/\s+/)[0] || "";
  const texto = `Oi${quem ? `, ${quem}` : ""}! Aqui é da equipe VANT. Vi você no ranking e queria trocar uma ideia sobre o seu corre. Tem um minuto?`;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
