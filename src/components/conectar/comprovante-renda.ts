/* ============================================================
   COMPROVANTE DE RENDA (Lote 6, 03/10/2026) — PDF pra alugar casa ou pedir
   crédito. Mês a mês: o que o BANCO confirmou (entradas e Pix recebidos, sem
   transferência entre contas próprias) ao lado do que foi lançado no DEFCON.
   Os números vêm de comprovante_renda() (servidor), que também registra o
   comprovante com um código de verificação.
   ============================================================ */
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/shared/lib/utils";

export interface MesRenda { mes: string; parcial: boolean; entradas_banco: number; pix_banco: number; vendas_lancadas: number; dias_trabalhados: number }
export interface Comprovante { codigo: string; gerado_em: string; nome: string | null; cpf_mascarado: string | null; bancos: string[]; verificado: boolean; meses: MesRenda[] }

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const nomeMes = (ym: string) => `${MESES[Number(ym.slice(5, 7)) - 1] ?? ym} de ${ym.slice(0, 4)}`;

/** Média mensal só dos meses FECHADOS (o mês atual entra na tabela, não na média). */
export function mediaMensal(meses: MesRenda[]): { banco: number; lancado: number; mesesBanco: number } {
  const fechados = meses.filter((m) => !m.parcial);
  const comBanco = fechados.filter((m) => m.entradas_banco > 0);
  const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return {
    banco: comBanco.length ? soma(comBanco.map((m) => m.entradas_banco)) / comBanco.length : 0,
    lancado: fechados.length ? soma(fechados.map((m) => m.vendas_lancadas)) / fechados.length : 0,
    mesesBanco: comBanco.length,
  };
}

export async function gerarComprovante(meses = 3): Promise<Comprovante> {
  const { data, error } = await (supabase as unknown as { rpc: (f: string, a: object) => Promise<{ data: unknown; error: { message: string } | null }> })
    .rpc("comprovante_renda", { p_meses: meses });
  if (error || !data) throw new Error(error?.message || "sem dados");
  const c = data as Comprovante;
  return { ...c, bancos: c.bancos ?? [], meses: (c.meses ?? []).map((m) => ({ ...m, entradas_banco: Number(m.entradas_banco) || 0, pix_banco: Number(m.pix_banco) || 0, vendas_lancadas: Number(m.vendas_lancadas) || 0, dias_trabalhados: Number(m.dias_trabalhados) || 0 })) };
}

export function baixarComprovantePDF(c: Comprovante) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const brl = (v: number) => formatCurrency(v);
  const gerado = new Date(c.gerado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  doc.setFillColor(11, 11, 13); doc.rect(0, 0, W, 38, "F");
  doc.setTextColor(245, 184, 0); doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("VANT", 16, 18);
  doc.setTextColor(255, 255, 255); doc.setFontSize(13);
  doc.text("Comprovante de renda do vendedor", 16, 28);
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
  doc.text(`Código de verificação: ${c.codigo}`, W - 16, 18, { align: "right" });
  doc.text(`Gerado em ${gerado}`, W - 16, 24, { align: "right" });

  doc.setTextColor(20, 20, 20); doc.setFontSize(11);
  let y = 50;
  doc.setFont("helvetica", "bold"); doc.text(c.nome || "Vendedor", 16, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5);
  if (c.cpf_mascarado) doc.text(`CPF ${c.cpf_mascarado}`, 16, y + 6);
  doc.text(c.verificado ? `Bancos conectados por Open Finance: ${c.bancos.join(", ")}` : "Sem banco conectado: valores apenas lançados pelo vendedor.", 16, y + 12);

  const m = mediaMensal(c.meses);
  y = 76;
  doc.setDrawColor(230, 230, 230); doc.setFillColor(250, 246, 232); doc.roundedRect(16, y, W - 32, 22, 3, 3, "F");
  doc.setFontSize(8.5); doc.setTextColor(120, 110, 90);
  doc.text(m.mesesBanco > 0 ? `MÉDIA MENSAL CONFIRMADA PELO BANCO (${m.mesesBanco} ${m.mesesBanco === 1 ? "mês fechado" : "meses fechados"})` : "MÉDIA MENSAL LANÇADA NO DEFCON (meses fechados)", 22, y + 8);
  doc.setFontSize(16); doc.setTextColor(20, 20, 20); doc.setFont("helvetica", "bold");
  doc.text(brl(m.mesesBanco > 0 ? m.banco : m.lancado), 22, y + 17);

  y = 110;
  doc.setFontSize(8.5); doc.setTextColor(120, 120, 120); doc.setFont("helvetica", "bold");
  const cols = [16, 66, 106, 146, 180];
  ["MÊS", "ENTROU NO BANCO", "PIX RECEBIDOS", "LANÇADO NO APP", "DIAS"].forEach((h, i) => doc.text(h, cols[i]!, y));
  doc.setDrawColor(220, 220, 220); doc.line(16, y + 2.5, W - 16, y + 2.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(20, 20, 20);
  c.meses.forEach((r, i) => {
    const yy = y + 10 + i * 9;
    doc.text(`${nomeMes(r.mes)}${r.parcial ? " (até hoje)" : ""}`, cols[0]!, yy);
    doc.text(r.entradas_banco > 0 ? brl(r.entradas_banco) : "—", cols[1]!, yy);
    doc.text(r.pix_banco > 0 ? brl(r.pix_banco) : "—", cols[2]!, yy);
    doc.text(brl(r.vendas_lancadas), cols[3]!, yy);
    doc.text(String(r.dias_trabalhados), cols[4]!, yy);
  });

  y = y + 16 + c.meses.length * 9;
  doc.setFontSize(8); doc.setTextColor(110, 110, 110);
  const notas = [
    "\"Entrou no banco\": tudo o que entrou nas contas conectadas por Open Finance (Pluggy, autorizado pelo Banco Central),",
    "sem contar transferências entre contas do próprio vendedor. \"—\" = banco ainda não estava conectado naquele mês.",
    "\"Lançado no app\": vendas registradas pelo vendedor no DEFCON (dinheiro, Pix e cartão).",
    "A Vant nunca vê a senha do banco: só lê o que entrou e saiu. Este documento não substitui declaração de imposto de renda.",
  ];
  notas.forEach((t, i) => doc.text(t, 16, y + i * 4.5));
  doc.save(`vant-comprovante-renda-${c.codigo}.pdf`);
}
