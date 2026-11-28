/* The statement of ONE bank on the Bancos screen (28/11, Rick). Pure: the rows are the movements
   the app already imported (extrato_lista, the reader the Raio-X uses); here they are only
   filtered by the bank and by type, and summed. Imported rows carry the bank's NAME, not the
   connection, so two connections of the same institution share one statement. */
export interface Movimento {
  id: string; data: string; hora: string | null; descricao: string; comerciante: string | null;
  valor: number; tipo: "entrada" | "saida"; banco: string | null; movimento: string;
}
export type TipoFiltro = "tudo" | "entrada" | "saida";

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export function doBanco(lista: Movimento[], banco: string): Movimento[] {
  const b = norm(banco);
  return lista.filter((m) => norm(m.banco) === b);
}

export function totais(lista: Movimento[]) {
  let entradas = 0, saidas = 0;
  for (const m of lista) { if (m.tipo === "entrada") entradas += m.valor; else saidas += m.valor; }
  return { entradas: Math.round(entradas * 100) / 100, saidas: Math.round(saidas * 100) / 100, qtd: lista.length };
}

export function porTipo(lista: Movimento[], tipo: TipoFiltro): Movimento[] {
  return tipo === "tudo" ? lista : lista.filter((m) => m.tipo === tipo);
}

/** The first day of this month and the previous ones, in Brazil time (yyyy-mm-01). */
export function mesesRecentes(n = 3, agora = new Date()): string[] {
  const hoje = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const ano = Number(hoje.slice(0, 4)), mes = Number(hoje.slice(5, 7));
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(ano, mes - 1 - i, 1));
    return d.toISOString().slice(0, 10);
  });
}

export function nomeDoMes(iso: string): string {
  const s = new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Who/what the movement was, as the Raio-X shows it. */
export const nomeDoMovimento = (m: Movimento) => (m.comerciante?.trim() || m.descricao.trim() || "Movimento");
