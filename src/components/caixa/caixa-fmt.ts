/* Contas e formatos do Caixa da Vant (sem React — dá pra testar). */
export const moeda = (v: number, semCentavos = false) =>
  (v < 0 ? "− " : "") + "R$ " + Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: semCentavos ? 0 : 2, maximumFractionDigits: semCentavos ? 0 : 2 });
export const dataBR = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");
export const dataBRano = (iso: string | null | undefined) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const mesNome = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1] ?? iso} ${iso.slice(0, 4)}`;
export const hojeBR = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });


/** "12,50" / "12.50" / "1.234,56" -> 12.5 */
export function lerValor(txt: string): number {
  const t = txt.replace(/[^\d,.-]/g, "");
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const v = Number(norm);
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

/** Projeção mês a mês: churn tira assinantes, novos entram, cada ativo rende o líquido e o gasto sai. */
export function projetar(p: { saldo: number; ativos: number; liquido: number; novos: number; churn: number; gastoMes: number }) {
  let at = p.ativos, sal = p.saldo;
  const serie = [sal];
  for (let m = 0; m < 3; m++) {
    at = Math.max(0, Math.round(at * (1 - p.churn / 100)) + p.novos);
    sal += at * p.liquido - p.gastoMes;
    serie.push(Math.round(sal * 100) / 100);
  }
  return { serie, ativos: at };
}

