/* One request per account per install: the server decides who gets the 30-day test. */
const chave = (userId: string) => `vant_cortesia_loja_${userId}`;

export function jaPediu(userId: string): boolean {
  try { return localStorage.getItem(chave(userId)) === "1"; } catch { return false; }
}

export function marcarPedido(userId: string): void {
  try { localStorage.setItem(chave(userId), "1"); } catch { /* sem storage: pede de novo na próxima, o servidor responde 'ja_tinha' */ }
}
