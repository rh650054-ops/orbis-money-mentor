import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { formatBrazilDate } from "@/shared/lib/date-utils";

/**
 * Geração e download do "Relatório financeiro" do Orbis nos formatos
 * PDF (jsPDF, desenhado à mão), CSV (pt-BR, separado por ;) e Excel (.xls via HTML).
 *
 * A estrutura (Excel/CSV) segue a planilha do vendedor: por dia traz unidades
 * vendidas/pagas/não pagas, gorjeta, dinheiro, Pix, Pix recebido depois, cartão,
 * valor bruto, não recebido (prejuízo), custo, transporte, alimentação, líquido e OBS.
 *
 * Tudo é client-side. Só `jspdf` (já instalado) é importado; CSV e Excel são manuais.
 */

export type ReportFormat = "pdf" | "csv" | "xls";

/** Cor primária dourada do app (#E6A817) em RGB, para as bandas do PDF. */
const GOLD: [number, number, number] = [230, 168, 23];
const DARK: [number, number, number] = [20, 20, 20];

interface DailySaleRow {
  date: string;
  total_profit: number | null;
  cost: number | null;
  transport_cost: number | null;
  food_cost: number | null;
  total_debt: number | null;
  cash_sales: number | null;
  pix_sales: number | null;
  card_sales: number | null;
  tip_sales: number | null;
  unpaid_units: number | null;
  notes: string | null;
}

/** Linha já normalizada (sem nulls) usada por todos os formatos. */
interface ReportDay {
  date: string; // YYYY-MM-DD
  unidVendidas: number; // contagem de vendas do DEFCON no dia
  unidPagas: number; // vendidas - não pagas
  unidNaoPagas: number; // unpaid_units
  gorjeta: number; // tip_sales
  dinheiro: number; // cash_sales
  pix: number; // pix_sales (inclui o Pix recebido depois)
  pixDepois: number; // late_pix_entries (Pix que caiu depois) do dia
  cartao: number; // card_sales
  vendido: number; // total_profit (valor bruto)
  fiado: number; // total_debt (não recebido / prejuízo)
  mercadoria: number; // cost (custo produto)
  transporte: number; // transport_cost
  alimentacao: number; // food_cost
  liquido: number; // vendido - mercadoria - transporte - alimentacao
  obs: string; // notes
}

interface ReportTotals {
  unidVendidas: number;
  unidPagas: number;
  unidNaoPagas: number;
  gorjeta: number;
  dinheiro: number;
  pix: number;
  pixDepois: number;
  cartao: number;
  vendido: number;
  fiado: number;
  mercadoria: number;
  transporte: number;
  alimentacao: number;
  liquido: number;
  custos: number; // mercadoria + transporte + alimentacao
  dias: number; // nº de dias com registro
  mediaLiquido: number; // liquido / dias
}

const n = (v: number | null | undefined): number => Number(v || 0);

/** DD/MM/AAAA a partir de "YYYY-MM-DD" (sem problemas de fuso). */
function brDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "R$ 1.234,56" para o PDF (sempre 2 casas, mais legível em tabela). */
function brCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** "1234,56" — número puro com vírgula decimal (pt-BR) para CSV/Excel. */
function brNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

/** Inteiro (contagem de unidades). */
function brInt(value: number): string {
  return String(Math.round(value || 0));
}

/** Texto seguro pra CSV/Excel (sem ; nem quebra de linha). */
function safeText(s: string): string {
  return (s || "").replace(/[;\r\n]+/g, " ").trim();
}

const COLUMNS = [
  "Data",
  "Unid. vendidas",
  "Unid. pagas",
  "Unid. não pagas",
  "Gorjeta",
  "Dinheiro",
  "Pix",
  "Pix recebido depois",
  "Cartão",
  "Valor bruto",
  "Não recebido",
  "Custo produto",
  "Transporte",
  "Alimentação",
  "Líquido",
  "OBS",
] as const;

/** Busca os dados do período e do usuário e normaliza em ReportDay[]. */
export async function fetchReportData(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<ReportDay[]> {
  const [salesRes, blocksRes, lateRes] = await Promise.all([
    supabase
      .from("daily_sales")
      .select(
        "date,total_profit,cost,transport_cost,food_cost,total_debt,cash_sales,pix_sales,card_sales,tip_sales,unpaid_units,notes",
      )
      .eq("user_id", userId)
      .gte("date", startISO)
      .lte("date", endISO)
      .order("date", { ascending: true }),
    // Unidades vendidas = nº de vendas do DEFCON, agrupado por dia (fuso de Brasília).
    supabase
      .from("challenge_blocks")
      .select("sales_count,created_at")
      .eq("user_id", userId)
      .gte("created_at", `${startISO}T00:00:00-03:00`)
      .lte("created_at", `${endISO}T23:59:59-03:00`),
    // Pix que caiu depois (lançado num dia anterior), por dia creditado.
    supabase
      .from("late_pix_entries")
      .select("amount,sale_date")
      .eq("user_id", userId)
      .gte("sale_date", startISO)
      .lte("sale_date", endISO),
  ]);

  if (salesRes.error) throw salesRes.error;

  // Vendas (unidades) por dia
  const vendidasByDate = new Map<string, number>();
  for (const b of ((blocksRes.data as { sales_count: number | null; created_at: string }[]) || [])) {
    const dt = formatBrazilDate(new Date(b.created_at));
    vendidasByDate.set(dt, (vendidasByDate.get(dt) || 0) + n(b.sales_count));
  }

  // Pix recebido depois por dia (tolerante: se a tabela não existir, fica vazio)
  const pixDepoisByDate = new Map<string, number>();
  for (const p of ((lateRes.data as { amount: number | null; sale_date: string }[]) || [])) {
    pixDepoisByDate.set(p.sale_date, (pixDepoisByDate.get(p.sale_date) || 0) + n(p.amount));
  }

  return ((salesRes.data as DailySaleRow[]) || []).map((r) => {
    const vendido = n(r.total_profit);
    const mercadoria = n(r.cost);
    const transporte = n(r.transport_cost);
    const alimentacao = n(r.food_cost);
    const unidVendidas = vendidasByDate.get(r.date) || 0;
    const unidNaoPagas = n(r.unpaid_units);
    return {
      date: r.date,
      unidVendidas,
      unidNaoPagas,
      unidPagas: Math.max(0, unidVendidas - unidNaoPagas),
      gorjeta: n(r.tip_sales),
      dinheiro: n(r.cash_sales),
      pix: n(r.pix_sales),
      pixDepois: pixDepoisByDate.get(r.date) || 0,
      cartao: n(r.card_sales),
      vendido,
      // "Não recebido" = unidades não pagas × ticket médio do dia (não o resíduo total_debt).
      fiado: Math.round(unidNaoPagas * (unidVendidas > 0 ? vendido / unidVendidas : 0) * 100) / 100,
      mercadoria,
      transporte,
      alimentacao,
      liquido: vendido - mercadoria - transporte - alimentacao,
      obs: safeText(String(r.notes || "")),
    };
  });
}

function computeTotals(days: ReportDay[]): ReportTotals {
  const t: ReportTotals = {
    unidVendidas: 0,
    unidPagas: 0,
    unidNaoPagas: 0,
    gorjeta: 0,
    dinheiro: 0,
    pix: 0,
    pixDepois: 0,
    cartao: 0,
    vendido: 0,
    fiado: 0,
    mercadoria: 0,
    transporte: 0,
    alimentacao: 0,
    liquido: 0,
    custos: 0,
    dias: days.length,
    mediaLiquido: 0,
  };
  for (const d of days) {
    t.unidVendidas += d.unidVendidas;
    t.unidPagas += d.unidPagas;
    t.unidNaoPagas += d.unidNaoPagas;
    t.gorjeta += d.gorjeta;
    t.dinheiro += d.dinheiro;
    t.pix += d.pix;
    t.pixDepois += d.pixDepois;
    t.cartao += d.cartao;
    t.vendido += d.vendido;
    t.fiado += d.fiado;
    t.mercadoria += d.mercadoria;
    t.transporte += d.transporte;
    t.alimentacao += d.alimentacao;
    t.liquido += d.liquido;
  }
  t.custos = t.mercadoria + t.transporte + t.alimentacao;
  t.mediaLiquido = t.dias > 0 ? t.liquido / t.dias : 0;
  return t;
}

function fileBaseName(startISO: string, endISO: string): string {
  return `orbis-relatorio-${startISO}_a_${endISO}`;
}

/** Dispara o download de um Blob via <a> temporário. */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libera a URL no próximo tick (Safari precisa do atraso).
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Célula de uma linha (dia) na ordem das COLUMNS. */
function rowCells(d: ReportDay): string[] {
  return [
    brDate(d.date),
    brInt(d.unidVendidas),
    brInt(d.unidPagas),
    brInt(d.unidNaoPagas),
    brNumber(d.gorjeta),
    brNumber(d.dinheiro),
    brNumber(d.pix),
    brNumber(d.pixDepois),
    brNumber(d.cartao),
    brNumber(d.vendido),
    brNumber(d.fiado),
    brNumber(d.mercadoria),
    brNumber(d.transporte),
    brNumber(d.alimentacao),
    brNumber(d.liquido),
    d.obs,
  ];
}

/** Linha de TOTAIS na ordem das COLUMNS. */
function totalCells(t: ReportTotals): string[] {
  return [
    "TOTAIS",
    brInt(t.unidVendidas),
    brInt(t.unidPagas),
    brInt(t.unidNaoPagas),
    brNumber(t.gorjeta),
    brNumber(t.dinheiro),
    brNumber(t.pix),
    brNumber(t.pixDepois),
    brNumber(t.cartao),
    brNumber(t.vendido),
    brNumber(t.fiado),
    brNumber(t.mercadoria),
    brNumber(t.transporte),
    brNumber(t.alimentacao),
    brNumber(t.liquido),
    "",
  ];
}

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function buildCSV(days: ReportDay[], totals: ReportTotals): string {
  const SEP = ";";
  const lines: string[] = [];
  lines.push(COLUMNS.join(SEP));
  for (const d of days) lines.push(rowCells(d).join(SEP));
  lines.push(totalCells(totals).join(SEP));
  // \r\n para máxima compatibilidade com Excel no Windows.
  return lines.join("\r\n");
}

function exportCSV(days: ReportDay[], totals: ReportTotals, base: string) {
  const BOM = "﻿"; // UTF-8 BOM para o Excel reconhecer acentos.
  const blob = new Blob([BOM + buildCSV(days, totals)], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, `${base}.csv`);
}

/* ------------------------------------------------------------------ */
/* Excel (.xls via HTML table)                                         */
/* ------------------------------------------------------------------ */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildXLS(
  days: ReportDay[],
  totals: ReportTotals,
  periodLabel: string,
): string {
  const headCells = COLUMNS.map(
    (c) =>
      `<th style="background:#E6A817;color:#fff;font-weight:bold;border:1px solid #d0d0d0;padding:6px 8px;text-align:${
        c === "Data" || c === "OBS" ? "left" : "right"
      };">${escapeHtml(c)}</th>`,
  ).join("");

  const align = (col: string) => (col === "Data" || col === "OBS" ? "left" : "right");

  const bodyRows = days
    .map((d, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#fbf4e3";
      const cells = rowCells(d);
      return (
        "<tr>" +
        COLUMNS.map(
          (c, ci) =>
            `<td style="border:1px solid #e5e5e5;padding:5px 8px;text-align:${align(c)};background:${bg};">${escapeHtml(
              cells[ci] ?? "",
            )}</td>`,
        ).join("") +
        "</tr>"
      );
    })
    .join("");

  const tCells = totalCells(totals);
  const totalRow =
    "<tr>" +
    COLUMNS.map(
      (c, ci) =>
        `<td style="border:1px solid #d0d0d0;padding:6px 8px;text-align:${align(
          c,
        )};font-weight:bold;background:#f5e6c2;">${escapeHtml(tCells[ci] ?? "")}</td>`,
    ).join("") +
    "</tr>";

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Relatorio</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
<body>
<h2 style="font-family:Arial,sans-serif;color:#b9860f;margin:0 0 4px;">ORBIS — Relatório financeiro</h2>
<p style="font-family:Arial,sans-serif;font-size:12px;color:#555;margin:0 0 12px;">Período: ${escapeHtml(
    periodLabel,
  )}</p>
<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;">
<thead><tr>${headCells}</tr></thead>
<tbody>${bodyRows}${totalRow}</tbody>
</table>
</body></html>`;
}

function exportXLS(
  days: ReportDay[],
  totals: ReportTotals,
  base: string,
  periodLabel: string,
) {
  const blob = new Blob(["﻿" + buildXLS(days, totals, periodLabel)], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  triggerDownload(blob, `${base}.xls`);
}

/* ------------------------------------------------------------------ */
/* PDF (jsPDF — desenhado à mão, sem autotable)                        */
/* ------------------------------------------------------------------ */

function exportPDF(
  days: ReportDay[],
  totals: ReportTotals,
  base: string,
  startISO: string,
  endISO: string,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 40;
  const tableW = W - margin * 2;

  // Tabela compacta no PDF (a estrutura completa fica no Excel/CSV).
  const cols = [
    { key: "data", label: "Data", w: 0.16, align: "left" as const },
    { key: "vendido", label: "Bruto", w: 0.15, align: "right" as const },
    { key: "mercadoria", label: "Custo", w: 0.15, align: "right" as const },
    { key: "transporte", label: "Transp.", w: 0.13, align: "right" as const },
    { key: "alimentacao", label: "Aliment.", w: 0.13, align: "right" as const },
    { key: "fiado", label: "N/ pago", w: 0.12, align: "right" as const },
    { key: "liquido", label: "Líquido", w: 0.16, align: "right" as const },
  ];
  const colX: number[] = [];
  {
    let acc = margin;
    for (const c of cols) {
      colX.push(acc);
      acc += c.w * tableW;
    }
  }
  const cellPadR = 8;
  const cellPadL = 8;
  const rowH = 20;

  const gen = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());

  function drawPageHeader() {
    doc.setFillColor(DARK[0], DARK[1], DARK[2]);
    doc.rect(0, 0, W, 92, "F");
    doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("ORBIS — Relatório financeiro", margin, 40);
    doc.setTextColor(225, 225, 225);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Período: ${brDate(startISO)} a ${brDate(endISO)}`, margin, 62);
    doc.text(`Gerado em ${gen}`, margin, 78);
  }

  function drawTableHeader(yTop: number): number {
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.rect(margin, yTop, tableW, rowH + 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const ty = yTop + rowH - 6;
    cols.forEach((c, i) => {
      if (c.align === "right") {
        doc.text(c.label, colX[i]! + c.w * tableW - cellPadR, ty, { align: "right" });
      } else {
        doc.text(c.label, colX[i]! + cellPadL, ty);
      }
    });
    return yTop + rowH + 2;
  }

  drawPageHeader();
  let y = 120;

  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumo por dia", margin, y);
  y += 14;

  y = drawTableHeader(y);

  doc.setFontSize(9.5);
  const bottomLimit = H - 70;

  days.forEach((d, idx) => {
    if (y + rowH > bottomLimit) {
      doc.addPage();
      drawPageHeader();
      y = 120;
      y = drawTableHeader(y);
      doc.setFontSize(9.5);
    }

    if (idx % 2 === 1) {
      doc.setFillColor(251, 244, 227); // #FBF4E3
      doc.rect(margin, y, tableW, rowH, "F");
    }

    doc.setTextColor(35, 35, 35);
    doc.setFont("helvetica", "normal");
    const ty = y + rowH - 6;
    const values: Record<string, string> = {
      data: brDate(d.date),
      vendido: brCurrency(d.vendido),
      mercadoria: brCurrency(d.mercadoria),
      transporte: brCurrency(d.transporte),
      alimentacao: brCurrency(d.alimentacao),
      fiado: brCurrency(d.fiado),
      liquido: brCurrency(d.liquido),
    };
    cols.forEach((c, i) => {
      if (c.key === "liquido") {
        doc.setFont("helvetica", "bold");
        doc.setTextColor(
          d.liquido >= 0 ? 20 : 180,
          d.liquido >= 0 ? 120 : 40,
          d.liquido >= 0 ? 40 : 40,
        );
      } else {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(35, 35, 35);
      }
      const txt = values[c.key]!;
      if (c.align === "right") {
        doc.text(txt, colX[i]! + c.w * tableW - cellPadR, ty, { align: "right" });
      } else {
        doc.text(txt, colX[i]! + cellPadL, ty);
      }
    });
    y += rowH;
  });

  doc.setDrawColor(210, 210, 210);
  doc.line(margin, y, margin + tableW, y);

  if (days.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text("Nenhum registro no período selecionado.", margin, y + 24);
    y += 24;
  }

  // Nota compacta — formas de recebimento + gorjeta + Pix recebido depois
  y += 18;
  if (y + 30 > bottomLimit) {
    doc.addPage();
    drawPageHeader();
    y = 120;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 110, 110);
  doc.text(
    `Recebimentos — Dinheiro: ${brCurrency(totals.dinheiro)}  ·  Pix: ${brCurrency(
      totals.pix,
    )}  ·  Cartão: ${brCurrency(totals.cartao)}  ·  Gorjetas: ${brCurrency(totals.gorjeta)}`,
    margin,
    y,
  );
  y += 13;
  doc.text(
    `Unidades vendidas: ${totals.unidVendidas}  ·  pagas: ${totals.unidPagas}  ·  não pagas: ${totals.unidNaoPagas}  ·  Pix recebido depois: ${brCurrency(
      totals.pixDepois,
    )}`,
    margin,
    y,
  );

  // ---- Bloco de totais ----
  y += 22;
  const blockH = 132;
  if (y + blockH > bottomLimit) {
    doc.addPage();
    drawPageHeader();
    y = 120;
  }

  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(margin, y, tableW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Totais do período", margin + cellPadL, y + 18);
  y += 26;

  doc.setFillColor(251, 247, 236); // #FBF7EC
  doc.rect(margin, y, tableW, blockH - 26, "F");
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(margin, y, tableW, blockH - 26, "S");

  const totalLine = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 12 : 10.5);
    doc.setTextColor(bold ? 0 : 60, bold ? 0 : 60, bold ? 0 : 60);
    doc.text(label, margin + cellPadL + 4, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(bold ? 20 : 40, bold ? 120 : 40, 40);
    doc.text(value, margin + tableW - cellPadR - 4, y, { align: "right" });
  };

  y += 22;
  totalLine("Valor bruto", brCurrency(totals.vendido));
  y += 18;
  totalLine(
    "Custos (mercadoria + transporte + alimentação)",
    brCurrency(totals.custos),
  );
  y += 18;
  totalLine("Não recebido (prejuízo)", brCurrency(totals.fiado));
  y += 20;
  totalLine("Líquido", brCurrency(totals.liquido), true);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(110, 110, 110);
  doc.text(
    `Média de líquido por dia: ${brCurrency(totals.mediaLiquido)}  ·  ${
      totals.dias
    } ${totals.dias === 1 ? "dia" : "dias"} com registro`,
    margin + cellPadL + 4,
    y,
  );

  doc.setFontSize(8.5);
  doc.setTextColor(160, 160, 160);
  doc.text("Gerado pelo Orbis", margin, H - 28);

  doc.save(`${base}.pdf`);
}

/* ------------------------------------------------------------------ */
/* Orquestrador                                                        */
/* ------------------------------------------------------------------ */

/**
 * Busca os dados do período e gera + baixa o relatório no formato escolhido.
 * Retorna o nº de dias com registro (para feedback ao usuário).
 */
export async function generateAndDownloadReport(params: {
  userId: string;
  startISO: string;
  endISO: string;
  format: ReportFormat;
}): Promise<number> {
  const { userId, startISO, endISO, format } = params;
  const days = await fetchReportData(userId, startISO, endISO);
  const totals = computeTotals(days);
  const base = fileBaseName(startISO, endISO);
  const periodLabel = `${brDate(startISO)} a ${brDate(endISO)}`;

  if (format === "csv") {
    exportCSV(days, totals, base);
  } else if (format === "xls") {
    exportXLS(days, totals, base, periodLabel);
  } else {
    exportPDF(days, totals, base, startISO, endISO);
  }

  return days.length;
}
