// Bancos brasileiros mais populares — usado no seletor visual de Conta Pix
export interface BrazilianBank {
  id: string;
  name: string;
  emoji: string;
  color: string; // brand color
}

export const BRAZILIAN_BANKS: BrazilianBank[] = [
  { id: "nubank", name: "Nubank", emoji: "💜", color: "#820AD1" },
  { id: "itau", name: "Itaú", emoji: "🟧", color: "#EC7000" },
  { id: "bradesco", name: "Bradesco", emoji: "🔴", color: "#CC092F" },
  { id: "bb", name: "Banco do Brasil", emoji: "🟡", color: "#FAE128" },
  { id: "caixa", name: "Caixa", emoji: "🔷", color: "#1B6FB3" },
  { id: "santander", name: "Santander", emoji: "🔥", color: "#EC0000" },
  { id: "inter", name: "Inter", emoji: "🟠", color: "#FF7A00" },
  { id: "c6", name: "C6 Bank", emoji: "⬛", color: "#242424" },
  { id: "picpay", name: "PicPay", emoji: "💚", color: "#11C76F" },
  { id: "mercadopago", name: "Mercado Pago", emoji: "💙", color: "#00B1EA" },
  { id: "pagbank", name: "PagBank", emoji: "🟦", color: "#FFC600" },
  { id: "next", name: "Next", emoji: "💚", color: "#00FF5F" },
  { id: "neon", name: "Neon", emoji: "💚", color: "#00E08F" },
  { id: "original", name: "Original", emoji: "🟢", color: "#00D26A" },
  { id: "safra", name: "Safra", emoji: "🔵", color: "#003DA5" },
  { id: "btg", name: "BTG Pactual", emoji: "⚫", color: "#001E3C" },
  { id: "sicoob", name: "Sicoob", emoji: "💚", color: "#003641" },
  { id: "sicredi", name: "Sicredi", emoji: "🟢", color: "#3FA535" },
  { id: "outro", name: "Outro banco", emoji: "🏦", color: "#6B7280" },
];

export const getBankById = (id: string) =>
  BRAZILIAN_BANKS.find((b) => b.id === id) || BRAZILIAN_BANKS[BRAZILIAN_BANKS.length - 1];
