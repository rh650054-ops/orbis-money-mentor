/* Quantos dias de Vant Pro uma compra dá (19/10/2026: uma venda do anual pela oferta
   t9xt3k4z, que não estava na lista, virou assinatura comum de 30 dias e sem Pro —
   o comprador via "assine o anual" logo depois de pagar o anual).
   1º a oferta conhecida; senão o NOME do plano que a Hotmart manda
   ("VANT Pro Anual", "Vant Pro"), pra uma oferta nova nunca mais cair fora. */
export const PRO_OFFERS: Record<string, number> = {
  "5y86n311": 30,   // mensal
  "6vkxbh8c": 365,  // anual antigo (quem já assinou)
  "ew11enu0": 365,  // anual R$ 418,80 (06/10)
  "t9xt3k4z": 365,  // anual R$ 319,08 (19/10)
  "ckkw1xkf": 30,   // mensal "Vant Pro" R$ 22 (24/10: já vendia, entrava só pelo nome)
};

export function diasDePro(offerCode: string, planoNome: string): number | null {
  const dias = PRO_OFFERS[offerCode.trim()];
  if (dias) return dias;
  const nome = planoNome.toLowerCase();
  if (!/\bpro\b/.test(nome)) return null;
  return /anual|annual|12 ?meses/.test(nome) ? 365 : 30;
}
