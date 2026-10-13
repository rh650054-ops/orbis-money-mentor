/* Modelo da mensagem de cobrança no WhatsApp (salvo no aparelho).
   13/10/2026 (Rick): sai o link do Mercado Pago. Os modelos já salvos tinham a
   linha "É só pagar por aqui, cai na hora:" grudada (só a URL era tirada ao
   salvar) e ela voltava duplicada a cada venda. Isto limpa esses restos. */
export function limparModelo(body: string): string {
  return body
    .split("\n")
    .filter((l) => !/^\s*É só pagar por aqui, cai na hora:?\s*$/i.test(l) && !/https?:\/\/\S*mercadopago/i.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
