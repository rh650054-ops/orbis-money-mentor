import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { formatCurrency } from "@/lib/utils";

function sanitizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length <= 11 ? `55${digits}` : digits;
}

export async function generateDefconDayPDF(userId: string, date?: string) {
  const day = date ?? getBrazilDate();

  const [{ data: sales }, { data: plan }, { data: clients }, { data: expenses }, { data: loadout }] =
    await Promise.all([
      supabase
        .from("daily_sales")
        .select("cash_sales, card_sales, pix_sales, total_debt, total_profit, cost")
        .eq("user_id", userId)
        .eq("date", day)
        .maybeSingle(),
      supabase
        .from("daily_goal_plans")
        .select("id, daily_goal")
        .eq("user_id", userId)
        .eq("date", day)
        .maybeSingle(),
      supabase
        .from("defcon_clients")
        .select("amount, method, customer_name, customer_phone, created_at")
        .eq("user_id", userId)
        .eq("date", day)
        .order("created_at"),
      supabase
        .from("personal_expenses")
        .select("name, amount, category")
        .eq("user_id", userId)
        .eq("date", day),
      supabase
        .from("defcon_daily_loadout")
        .select("product_name, qty_initial, qty_sold")
        .eq("user_id", userId)
        .eq("date", day),
    ]);

  let blocks: any[] = [];
  if (plan?.id) {
    const { data } = await supabase
      .from("hourly_goal_blocks")
      .select("hour_label, achieved_amount, valor_dinheiro, valor_cartao, valor_pix, valor_calote")
      .eq("plan_id", plan.id)
      .order("hour_index");
    blocks = data ?? [];
  }

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 40;
  let y = 56;

  // Header
  doc.setFillColor(13, 13, 13);
  doc.rect(0, 0, W, 96, "F");
  doc.setTextColor(244, 161, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("DEFCON 4 — Relatório do Dia", margin, 42);
  doc.setTextColor(230, 230, 230);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const label = new Date(day + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  doc.text(`Data: ${label}`, margin, 68);

  y = 130;
  doc.setTextColor(20);
  const section = (title: string) => {
    if (y > 760) { doc.addPage(); y = 60; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(244, 161, 0);
    doc.text(title, margin, y);
    doc.setDrawColor(220);
    doc.line(margin, y + 6, W - margin, y + 6);
    y += 24;
    doc.setTextColor(20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
  };
  const row = (k: string, v: string) => {
    if (y > 780) { doc.addPage(); y = 60; }
    doc.text(k, margin, y);
    doc.setFont("helvetica", "bold");
    doc.text(v, W - margin, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 18;
  };

  // Resumo financeiro
  section("Resumo do dia");
  const totalDin = Number(sales?.cash_sales || 0);
  const totalCar = Number(sales?.card_sales || 0);
  const totalPix = Number(sales?.pix_sales || 0);
  const totalCalote = Number(sales?.total_debt || 0);
  const total = totalDin + totalCar + totalPix;
  const lucro = Number(sales?.total_profit || 0);
  const custo = Number(sales?.cost || 0);
  row("Meta do dia", formatCurrency(Number(plan?.daily_goal || 0)));
  row("Total vendido", formatCurrency(total));
  row("Dinheiro", formatCurrency(totalDin));
  row("Cartão", formatCurrency(totalCar));
  row("Pix", formatCurrency(totalPix));
  if (totalCalote > 0) row("Calotes", formatCurrency(totalCalote));
  if (custo > 0) row("Custos", formatCurrency(custo));
  row("Lucro estimado", formatCurrency(lucro));

  // Vendas por hora
  if (blocks.length > 0) {
    y += 8;
    section("Vendas por hora");
    for (const b of blocks) {
      const amt = Number(b.achieved_amount || 0);
      if (amt === 0) continue;
      row(b.hour_label, formatCurrency(amt));
    }
  }

  // Produtos levados
  if (loadout && loadout.length > 0) {
    y += 8;
    section("Produtos levados hoje");
    for (const p of loadout) {
      const restante = Math.max(0, Number(p.qty_initial) - Number(p.qty_sold));
      row(p.product_name, `${p.qty_sold}/${p.qty_initial} vendidos · ${restante} restantes`);
    }
  }

  // Custos
  if (expenses && expenses.length > 0) {
    y += 8;
    section("Custos do dia");
    for (const e of expenses) {
      row(`${e.name} (${e.category})`, formatCurrency(Number(e.amount)));
    }
  }

  // Clientes com WhatsApp
  if (clients && clients.length > 0) {
    y += 8;
    section(`Clientes (${clients.length})`);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text("Hora", margin, y);
    doc.text("Cliente", margin + 55, y);
    doc.text("WhatsApp", margin + 215, y);
    doc.text("Valor", W - margin, y, { align: "right" });
    y += 6;
    doc.setDrawColor(220);
    doc.line(margin, y, W - margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);

    for (const c of clients) {
      if (y > 780) { doc.addPage(); y = 60; }
      const time = new Date(c.created_at as string).toLocaleTimeString("pt-BR", {
        hour: "2-digit", minute: "2-digit",
      });
      const phoneClean = sanitizePhone(c.customer_phone as string | null);
      doc.setTextColor(80);
      doc.text(time, margin, y);
      doc.setTextColor(20);
      doc.text((c.customer_name || "—").slice(0, 28), margin + 55, y);

      if (phoneClean) {
        const link = `https://wa.me/${phoneClean}`;
        doc.setTextColor(37, 211, 102);
        doc.textWithLink(c.customer_phone || phoneClean, margin + 215, y, { url: link });
        doc.setTextColor(20);
      } else {
        doc.setTextColor(150);
        doc.text("—", margin + 215, y);
        doc.setTextColor(20);
      }
      doc.setFont("helvetica", "bold");
      doc.text(formatCurrency(Number(c.amount || 0)), W - margin, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      y += 16;
    }
  }

  // Rodapé
  if (y > 770) { doc.addPage(); y = 60; }
  y += 20;
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text("Gerado pelo Orbis · DEFCON 4", margin, y);

  doc.save(`orbis-defcon4-${day}.pdf`);
}
