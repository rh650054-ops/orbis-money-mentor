import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

/**
 * Geração e download do "Relatório financeiro" do Orbis nos formatos
 * PDF (jsPDF, desenhado à mão), CSV (pt-BR, separado por ;) e Excel (.xls via HTML).
 *
 * Tudo é client-side. Nenhuma dependência nova é adicionada: apenas `jspdf`
 * (já instalado) é importado; CSV e Excel são construídos manualmente.
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
}

/** Linha já normalizada (sem nulls) usada por todos os formatos. */
interface ReportDay {
  date: string; // YYYY-MM-DD
  vendido: number; // total_profit
  mercadoria: number; // cost
  transporte: number; // transport_cost
  alimentacao: number; // food_cost
  fiado: number; // total_debt
  dinheiro: number; // cash_sales
  pix: number; // pix_sales
  cartao: number; // card_sales
  liquido: number; // vendido - mercadoria - transporte - alimentacao
}

interface ReportTotals {
  vendido: number;
  mercadoria: number;
  transporte: number;
  alimentacao: number;
  fiado: number;
  dinheiro: number;
  pix: number;
  cartao: number;
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

/** "1234,56" — número puro com vírgula decimal (pt-BR) para CSV. */
function brNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

const COLUMNS = [
  "Data",
  "Vendido",
  "Mercadoria",
  "Transporte",
  "Alimentação",
  "Fiado",
  "Dinheiro",
  "Pix",
  "Cartão",
  "Líquido",
] as const;

/** Busca os dados do período e do usuário e normaliza em ReportDay[]. */
export async function fetchReportData(
  userId: string,
  startISO: string,
  endISO: string,
): Promise<ReportDay[]> {
  const { data, error } = await supabase
    .from("daily_sales")
    .select(
      "date,total_profit,cost,transport_cost,food_cost,total_debt,cash_sales,pix_sales,card_sales,tip_sales",
    )
    .eq("user_id", userId)
    .gte("date", startISO)
    .lte("date", endISO)
    .order("date", { ascending: true });

  if (error) throw error;

  return ((data as DailySaleRow[]) || []).map((r) => {
    const vendido = n(r.total_profit);
    const mercadoria = n(r.cost);
    const transporte = n(r.transport_cost);
    const alimentacao = n(r.food_cost);
    return {
      date: r.date,
      vendido,
      mercadoria,
      transporte,
      alimentacao,
      fiado: n(r.total_debt),
      dinheiro: n(r.cash_sales),
      pix: n(r.pix_sales),
      cartao: n(r.card_sales),
      liquido: vendido - mercadoria - transporte - alimentacao,
    };
  });
}

function computeTotals(days: ReportDay[]): ReportTotals {
  const t: ReportTotals = {
    vendido: 0,
    mercadoria: 0,
    transporte: 0,
    alimentacao: 0,
    fiado: 0,
    dinheiro: 0,
    pix: 0,
    cartao: 0,
    liquido: 0,
    custos: 0,
    dias: days.length,
    mediaLiquido: 0,
  };
  for (const d of days) {
    t.vendido += d.vendido;
    t.mercadoria += d.mercadoria;
    t.transporte += d.transporte;
    t.alimentacao += d.alimentacao;
    t.fiado += d.fiado;
    t.dinheiro += d.dinheiro;
    t.pix += d.pix;
    t.cartao += d.cartao;
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

/* ------------------------------------------------------------------ */
/* CSV                                                                 */
/* ------------------------------------------------------------------ */

function buildCSV(days: ReportDay[], totals: ReportTotals): string {
  const SEP = ";";
  const cell = (v: number) => brNumber(v);
  const lines: string[] = [];

  lines.push(COLUMNS.join(SEP));

  for (const d of days) {
    lines.push(
      [
        brDate(d.date),
        cell(d.vendido),
        cell(d.mercadoria),
        cell(d.transporte),
        cell(d.alimentacao),
        cell(d.fiado),
        cell(d.dinheiro),
        cell(d.pix),
        cell(d.cartao),
        cell(d.liquido),
      ].join(SEP),
    );
  }

  lines.push(
    [
      "TOTAIS",
      cell(totals.vendido),
      cell(totals.mercadoria),
      cell(totals.transporte),
      cell(totals.alimentacao),
      cell(totals.fiado),
      cell(totals.dinheiro),
      cell(totals.pix),
      cell(totals.cartao),
      cell(totals.liquido),
    ].join(SEP),
  );

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
  // Formata como moeda no .xls; o Excel interpreta "R$ 1.234,56" como texto,
  // então usamos número puro (vírgula) alinhado à direita para somar/filtrar.
  const cur = (v: number) => brNumber(v);

  const headCells = COLUMNS.map(
    (c) =>
      `<th style="background:#E6A817;color:#fff;font-weight:bold;border:1px solid #d0d0d0;padding:6px 8px;text-align:${
        c === "Data" ? "left" : "right"
      };">${escapeHtml(c)}</th>`,
  ).join("");

  const bodyRows = days
    .map((d, i) => {
      const bg = i % 2 === 0 ? "#ffffff" : "#fbf4e3";
      const td = (v: string, align: string) =>
        `<td style="border:1px solid #e5e5e5;padding:5px 8px;text-align:${align};background:${bg};">${v}</td>`;
      return (
        "<tr>" +
        td(brDate(d.date), "left") +
        td(cur(d.vendido), "right") +
        td(cur(d.mercadoria), "right") +
        td(cur(d.transporte), "right") +
        td(cur(d.alimentacao), "right") +
        td(cur(d.fiado), "right") +
        td(cur(d.dinheiro), "right") +
        td(cur(d.pix), "right") +
        td(cur(d.cartao), "right") +
        td(cur(d.liquido), "right") +
        "</tr>"
      );
    })
    .join("");

  const totalTd = (v: string, align: string) =>
    `<td style="border:1px solid #d0d0d0;padding:6px 8px;text-align:${align};font-weight:bold;background:#f5e6c2;">${v}</td>`;
  const totalRow =
    "<tr>" +
    totalTd("TOTAIS", "left") +
    totalTd(cur(totals.vendido), "right") +
    totalTd(cur(totals.mercadoria), "right") +
    totalTd(cur(totals.transporte), "right") +
    totalTd(cur(totals.alimentacao), "right") +
    totalTd(cur(totals.fiado), "right") +
    totalTd(cur(totals.dinheiro), "right") +
    totalTd(cur(totals.pix), "right") +
    totalTd(cur(totals.cartao), "right") +
    totalTd(cur(totals.liquido), "right") +
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

  // Colunas da tabela do PDF (omitimos Dinheiro/Pix/Cartão p/ não poluir;
  // exibimos uma nota compacta logo abaixo da tabela).
  // Larguras proporcionais somando tableW.
  const cols = [
    { key: "data", label: "Data", w: 0.16, align: "left" as const },
    { key: "vendido", label: "Vendido", w: 0.15, align: "right" as const },
    { key: "mercadoria", label: "Mercad.", w: 0.15, align: "right" as const },
    { key: "transporte", label: "Transp.", w: 0.13, align: "right" as const },
    { key: "alimentacao", label: "Aliment.", w: 0.13, align: "right" as const },
    { key: "fiado", label: "Fiado", w: 0.12, align: "right" as const },
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

  // ---- Cabeçalho da página ----
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

  // ---- Cabeçalho da tabela (repetido por página) ----
  function drawTableHeader(yTop: number): number {
    doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
    doc.rect(margin, yTop, tableW, rowH + 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    const ty = yTop + rowH - 6;
    cols.forEach((c, i) => {
      if (c.align === "right") {
        doc.text(c.label, colX[i]! + c.w * tableW - cellPadR, ty, {
          align: "right",
        });
      } else {
        doc.text(c.label, colX[i]! + cellPadL, ty);
      }
    });
    return yTop + rowH + 2;
  }

  drawPageHeader();
  let y = 120;

  // Título da seção da tabela
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Resumo por dia", margin, y);
  y += 14;

  y = drawTableHeader(y);

  // ---- Linhas ----
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

    // Faixa zebra
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
        doc.text(txt, colX[i]! + c.w * tableW - cellPadR, ty, {
          align: "right",
        });
      } else {
        doc.text(txt, colX[i]! + cellPadL, ty);
      }
    });
    y += rowH;
  });

  // Linha inferior da tabela
  doc.setDrawColor(210, 210, 210);
  doc.line(margin, y, margin + tableW, y);

  if (days.length === 0) {
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.text("Nenhum registro no período selecionado.", margin, y + 24);
    y += 24;
  }

  // Nota compacta Dinheiro/Pix/Cartão (formas de recebimento no período)
  y += 18;
  if (y + 16 > bottomLimit) {
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
    )}  ·  Cartão: ${brCurrency(totals.cartao)}`,
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

  // Faixa de título dourada
  doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.rect(margin, y, tableW, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Totais do período", margin + cellPadL, y + 18);
  y += 26;

  // Corpo do bloco
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
  totalLine("Vendido", brCurrency(totals.vendido));
  y += 18;
  totalLine(
    "Custos (mercadoria + transporte + alimentação)",
    brCurrency(totals.custos),
  );
  y += 18;
  totalLine("Fiado", brCurrency(totals.fiado));
  y += 20;
  totalLine("Líquido", brCurrency(totals.liquido), true);
  y += 18;

  // Métricas auxiliares
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

  // ---- Rodapé ----
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
