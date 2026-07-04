import { useEffect, useMemo, useState } from "react";
import { Share2, AlertTriangle, Sparkles, FileDown, Coins, RotateCcw, ArrowLeft, Instagram, Check, Loader2, Pencil, X } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { toast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { TrialNudge } from "@/components/TrialNudge";
import jsPDF from "jspdf";
import orbisLogo from "@/assets/orbis-logo-share.png";
import pixLogo from "@/assets/pix-logo.png";
import { readThemeColor, BRAND_COLORS } from "@/shared/lib/theme-colors";
import { DefconShareCarousel } from "./DefconShareCarousel";
import { CompetitionStatementUpload } from "./CompetitionStatementUpload";
import { WeeklyChallengeExtratoNudge } from "@/components/competitions/WeeklyChallenge";

interface DefconEndScreenProps {
  phase: "finished" | "abandoned";
  totalSold: number;
  dailyGoal: number;
  totalBlocks: number;
  totalApproaches?: number;
  totalSalesCount?: number;
  workedMinutes?: number;
  userId?: string;
  onSaveBreakdown: (dinheiro: number, cartao: number, pix: number) => Promise<void>;
  onExit: () => void;
  onExtend?: () => Promise<void>;
  onRestart?: () => Promise<void>;
}

export function DefconEndScreen({
  phase,
  totalSold,
  dailyGoal,
  totalBlocks,
  totalApproaches = 0,
  totalSalesCount = 0,
  workedMinutes,
  userId,
  onSaveBreakdown,
  onExit,
  onExtend,
  onRestart,
}: DefconEndScreenProps) {
  const [pix, setPix] = useState("");
  const [cartao, setCartao] = useState("");
  const [dinheiro, setDinheiro] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [caloteAcknowledged, setCaloteAcknowledged] = useState(false);
  const [caloteUnits, setCaloteUnits] = useState(0);
  const [savingUnits, setSavingUnits] = useState(false);
  const [extending, setExtending] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [clientsCount, setClientsCount] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingTx, setExportingTx] = useState(false);
  const [daySales, setDaySales] = useState<{ amount: number; method: string; late: boolean; created_at: string }[]>([]);
  const [totalTips, setTotalTips] = useState(0);
  const [editingTip, setEditingTip] = useState(false);
  const [tipInput, setTipInput] = useState("");
  const [savingTip, setSavingTip] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<1 | 2 | 3>(2);
  const [generatingPreviews, setGeneratingPreviews] = useState(false);
  const [aiTip, setAiTip] = useState<string | null>(null);
  const [aiTipLoading, setAiTipLoading] = useState(false);
  const [aiTipError, setAiTipError] = useState(false);

  // Carrega quantidade de clientes salvos hoje pra mostrar/esconder o botão de PDF + gorjetas
  useEffect(() => {
    if (!userId) return;
    const today = getBrazilDate();
    supabase
      .from("defcon_clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("date", today)
      .then(({ count }) => setClientsCount(count ?? 0));
    supabase
      .from("daily_sales")
      .select("tip_sales, cash_sales, card_sales, pix_sales")
      .eq("user_id", userId)
      .eq("date", today)
      .maybeSingle()
      .then(({ data }) => {
        setTotalTips(Number((data as any)?.tip_sales || 0));
        // Pré-preenche com o que JÁ foi registrado por forma de pagamento durante as vendas.
        // Assim o usuário só confirma (ou ajusta um Pix que caiu depois) em vez de digitar
        // do zero — o que antes sobrescrevia o split real com valores errados.
        const c = Number((data as any)?.cash_sales || 0);
        const cd = Number((data as any)?.card_sales || 0);
        const px = Number((data as any)?.pix_sales || 0);
        if (c) setDinheiro(String(c));
        if (cd) setCartao(String(cd));
        if (px) setPix(String(px));
      });
  }, [userId]);

  // Carrega as vendas-linha de hoje (defcon_sales) — pro ritmo de vendas e o PDF de transações.
  useEffect(() => {
    if (!userId) return;
    const today = getBrazilDate();
    const startISO = new Date(`${today}T00:00:00-03:00`).toISOString();
    supabase
      .from("defcon_sales")
      .select("amount, method, late, created_at")
      .eq("user_id", userId)
      .gte("created_at", startISO)
      .order("created_at", { ascending: true })
      .then(({ data }) => setDaySales((data as any) || []));
  }, [userId]);

  // Ritmo médio: minutos entre uma venda e a próxima.
  const salesRhythmMin = useMemo(() => {
    if (daySales.length < 2) return null;
    const t = daySales.map((s) => new Date(s.created_at).getTime()).sort((a, b) => a - b);
    let sum = 0;
    for (let i = 1; i < t.length; i++) sum += t[i] - t[i - 1];
    return sum / (t.length - 1) / 60000;
  }, [daySales]);

  const exportClientsPdf = async () => {
    if (!userId) return;
    setExportingPdf(true);
    try {
      const today = getBrazilDate();
      const { data, error } = await supabase
        .from("defcon_clients")
        .select("amount, method, customer_name, customer_phone, created_at")
        .eq("user_id", userId)
        .eq("date", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: "Nenhum cliente registrado hoje" });
        return;
      }

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      let y = 56;

      // Cabeçalho
      doc.setFillColor(13, 13, 13);
      doc.rect(0, 0, pageWidth, 88, "F");
      doc.setTextColor(244, 161, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("Relatório de Clientes — Orbis", margin, 40);
      doc.setTextColor(220, 220, 220);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const dateLabel = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      doc.text(`Data: ${dateLabel}  •  ${data.length} registro(s)`, margin, 64);

      y = 120;
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Hora", margin, y);
      doc.text("Cliente", margin + 60, y);
      doc.text("WhatsApp", margin + 230, y);
      doc.text("Pagamento", margin + 360, y);
      doc.text("Valor", pageWidth - margin, y, { align: "right" });
      doc.setDrawColor(200);
      doc.line(margin, y + 6, pageWidth - margin, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      y += 22;

      const total = data.reduce((s, r) => s + Number(r.amount || 0), 0);
      for (const r of data) {
        if (y > 780) {
          doc.addPage();
          y = 60;
        }
        const time = new Date(r.created_at as string).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        doc.setTextColor(80, 80, 80);
        doc.text(time, margin, y);
        doc.setTextColor(20, 20, 20);
        doc.text((r.customer_name || "—").slice(0, 30), margin + 60, y);
        doc.setTextColor(80, 80, 80);
        doc.text(r.customer_phone || "—", margin + 230, y);
        doc.text(String(r.method || "—"), margin + 360, y);
        doc.setTextColor(20, 20, 20);
        doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(Number(r.amount || 0)), pageWidth - margin, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 18;
      }

      // Total
      y += 10;
      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 22;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(244, 161, 0);
      doc.text("Total", margin, y);
      doc.setTextColor(20, 20, 20);
      doc.text(formatCurrency(total), pageWidth - margin, y, { align: "right" });

      doc.save(`orbis-clientes-${today}.pdf`);
      toast({ title: "PDF gerado", description: `${data.length} cliente(s) exportado(s).` });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setExportingPdf(false);
    }
  };

  const exportTransactionsPdf = async () => {
    if (!userId) return;
    setExportingTx(true);
    try {
      const today = getBrazilDate();
      if (!daySales || daySales.length === 0) {
        toast({ title: "Nenhuma transação hoje" });
        return;
      }
      const metodoLabel = (m: string) => (m === "pix" ? "Pix" : m === "cartao" ? "Cartão" : "Dinheiro");

      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      let y = 56;

      doc.setFillColor(13, 13, 13);
      doc.rect(0, 0, pageWidth, 88, "F");
      doc.setTextColor(244, 161, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("Relatório de Transações — Orbis", margin, 40);
      doc.setTextColor(220, 220, 220);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const dateLabel = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
      doc.text(`Data: ${dateLabel}  •  ${daySales.length} transação(ões)`, margin, 64);

      y = 120;
      doc.setTextColor(40, 40, 40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Hora", margin, y);
      doc.text("Forma", margin + 80, y);
      doc.text("Obs", margin + 220, y);
      doc.text("Valor", pageWidth - margin, y, { align: "right" });
      doc.setDrawColor(200);
      doc.line(margin, y + 6, pageWidth - margin, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      y += 22;

      let totalDin = 0, totalPix = 0, totalCard = 0;
      for (const r of daySales) {
        if (y > 780) { doc.addPage(); y = 60; }
        const amt = Number(r.amount || 0);
        const m = String(r.method || "dinheiro");
        if (m === "pix") totalPix += amt; else if (m === "cartao") totalCard += amt; else totalDin += amt;
        const time = new Date(r.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        doc.setTextColor(80, 80, 80);
        doc.text(time, margin, y);
        doc.setTextColor(20, 20, 20);
        doc.text(metodoLabel(m), margin + 80, y);
        doc.setTextColor(120, 120, 120);
        doc.text(r.late ? "Pix caiu depois" : "—", margin + 220, y);
        doc.setTextColor(20, 20, 20);
        doc.setFont("helvetica", "bold");
        doc.text(formatCurrency(amt), pageWidth - margin, y, { align: "right" });
        doc.setFont("helvetica", "normal");
        y += 18;
      }

      // Resumo: split por forma + ritmo + total
      y += 10;
      doc.setDrawColor(180);
      doc.line(margin, y, pageWidth - margin, y);
      y += 22;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      doc.text(`Dinheiro: ${formatCurrency(totalDin)}    Pix: ${formatCurrency(totalPix)}    Cartão: ${formatCurrency(totalCard)}`, margin, y);
      y += 20;
      if (salesRhythmMin != null) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(80, 80, 80);
        doc.text(`Ritmo: 1 venda a cada ${salesRhythmMin < 10 ? salesRhythmMin.toFixed(1) : Math.round(salesRhythmMin)} min`, margin, y);
        y += 20;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(244, 161, 0);
      doc.text("Total", margin, y);
      doc.setTextColor(20, 20, 20);
      doc.text(formatCurrency(totalDin + totalPix + totalCard), pageWidth - margin, y, { align: "right" });

      doc.save(`orbis-transacoes-${today}.pdf`);
      toast({ title: "PDF gerado", description: `${daySales.length} transação(ões).` });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setExportingTx(false);
    }
  };

  const pixNum = parseFloat(pix) || 0;
  const cartaoNum = parseFloat(cartao) || 0;
  const dinheiroNum = parseFloat(dinheiro) || 0;
  const totalRecebido = pixNum + cartaoNum + dinheiroNum;
  const calote = Math.max(0, totalSold - totalRecebido);
  const hasCalote = calote > 0 && totalRecebido > 0;
  const fullyReceived = totalRecebido >= totalSold && totalSold > 0;

  // Salva a CONTAGEM de kits não pagos na linha do dia (mesma data do sync do DEFCON).
  // O valor do calote já está em total_debt; aqui guardamos só a quantidade pro relatório.
  const saveCaloteUnits = async () => {
    if (!userId) { setCaloteAcknowledged(true); return; }
    setSavingUnits(true);
    try {
      const today = getBrazilDate();
      const { data: row } = await supabase
        .from("daily_sales")
        .select("id")
        .eq("user_id", userId)
        .eq("date", today)
        .order("created_at", { ascending: true })
        .limit(1);
      if (row && row.length > 0) {
        await supabase.from("daily_sales").update({ unpaid_units: caloteUnits } as any).eq("id", row[0].id);
      } else {
        await supabase.from("daily_sales").insert({ user_id: userId, date: today, unpaid_units: caloteUnits } as any);
      }
      setCaloteAcknowledged(true);
      toast({ title: "Anotado", description: `${caloteUnits} ${caloteUnits === 1 ? "kit não pago" : "kits não pagos"} no relatório.` });
    } catch {
      setCaloteAcknowledged(true);
    } finally {
      setSavingUnits(false);
    }
  };

  // Editar a gorjeta do dia no fim do DEFCON. A gorjeta entra como dinheiro, então
  // ao corrigir o valor ajustamos tip_sales + cash_sales + total_profit pelo delta,
  // mantendo o dia consistente no relatório.
  const startEditTip = () => {
    setTipInput(totalTips ? String(totalTips) : "");
    setEditingTip(true);
  };

  const saveTip = async () => {
    if (!userId) { setEditingTip(false); return; }
    const newTip = Math.max(0, parseFloat(tipInput.replace(",", ".")) || 0);
    const delta = newTip - totalTips;
    setSavingTip(true);
    try {
      const today = getBrazilDate();
      const { data: row } = await supabase
        .from("daily_sales")
        .select("id, cash_sales, total_profit")
        .eq("user_id", userId)
        .eq("date", today)
        .order("created_at", { ascending: true })
        .limit(1);
      if (row && row.length > 0) {
        const r = row[0] as any;
        await supabase
          .from("daily_sales")
          .update({
            tip_sales: newTip,
            cash_sales: Math.max(0, (Number(r.cash_sales) || 0) + delta),
            total_profit: Math.max(0, (Number(r.total_profit) || 0) + delta),
          } as any)
          .eq("id", r.id);
      } else {
        await supabase.from("daily_sales").insert({ user_id: userId, date: today, tip_sales: newTip } as any);
      }
      setTotalTips(newTip);
      setEditingTip(false);
      toast({ title: "Gorjeta atualizada", description: formatCurrency(newTip) });
    } catch {
      toast({ title: "Erro ao salvar gorjeta", variant: "destructive" });
    } finally {
      setSavingTip(false);
    }
  };

  const percentage = dailyGoal > 0 ? (totalSold / dailyGoal) * 100 : 0;
  const goalReached = totalSold >= dailyGoal && totalSold > 0;
  const conversionRate = totalApproaches > 0 ? (totalSalesCount / totalApproaches) * 100 : 0;
  // Tempo REAL trabalhado — não arredonda hora incompleta. Ex.: encerrou faltando
  // 30min => "1h30" (e não "2h"). Cai pro nº de blocos só se não vier o tempo.
  const horasLabel = typeof workedMinutes === "number"
    ? `${Math.floor(workedMinutes / 60)}h${workedMinutes % 60 > 0 ? String(Math.round(workedMinutes % 60)).padStart(2, "0") : ""}`
    : `${totalBlocks}h`;

  const subText = useMemo(() => {
    if (phase === "abandoned") return "Desafio encerrado antes do tempo";
    if (totalSold === 0) return "Nada vendido hoje. Amanhã tem mais.";
    if (goalReached) return `Você bateu ${percentage.toFixed(0)}% da meta`;
    return `Você atingiu ${percentage.toFixed(0)}% da meta`;
  }, [phase, totalSold, goalReached, percentage]);

  const insight = useMemo(() => {
    if (totalApproaches === 0) return null;
    if (conversionRate >= 30) return "Conversão alta. Aumente o número de abordagens para escalar.";
    if (conversionRate >= 15) return "Bom ritmo. Mantenha a frequência de abordagens.";
    return "Conversão baixa. Aborde com mais confiança e firmeza.";
  }, [conversionRate, totalApproaches]);

  // Dica do dia com IA (Gemini) — só roda quando o vendedor toca no botão.
  const generateDayTip = async () => {
    setAiTipLoading(true);
    setAiTipError(false);
    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: {
          type: "defcon_day_report",
          approaches: totalApproaches,
          sales: totalSalesCount,
          conversionRate: conversionRate.toFixed(1),
          sold: totalSold,
          goal: dailyGoal,
        },
      });
      if (error) throw error;
      const tip = (data as { tip?: string } | null)?.tip;
      if (!tip) throw new Error("sem dica");
      setAiTip(tip);
    } catch {
      setAiTipError(true);
    } finally {
      setAiTipLoading(false);
    }
  };

  // ===== Imagens compartilháveis (3 modelos, estilo Strava) =====
  const loadLogo = (): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = orbisLogo;
    });

  const buildCanvas = async (template: 1 | 2 | 3): Promise<HTMLCanvasElement | null> => {
    const W = 1080, H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, W, H); // FUNDO 100% TRANSPARENTE (PNG sem fundo, tipo Strava)

    const GOLD = "#FFB627", GREEN = "#22C55E", WHITE = "#FFFFFF", MUTED = "#E6A93C";
    const fontStack = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

    const centerTextAt = (text: string, cx: number, y: number, size: number, weight: string, color: string, ls = 0) => {
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px ${fontStack}`;
      ctx.textBaseline = "middle";
      if (ls > 0) {
        const chars = text.split("");
        const widths = chars.map((c) => ctx.measureText(c).width);
        const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
        let x = cx - total / 2;
        ctx.textAlign = "left";
        chars.forEach((c, i) => { ctx.fillText(c, x, y); x += widths[i]! + ls; });
        ctx.textAlign = "center";
      } else {
        ctx.textAlign = "center";
        ctx.fillText(text, cx, y);
      }
    };
    const centerText = (text: string, y: number, size: number, weight: string, color: string, ls = 0) =>
      centerTextAt(text, W / 2, y, size, weight, color, ls);

    const divider = (y: number, color = GOLD) => {
      const g = ctx.createLinearGradient(W / 2 - 360, y, W / 2 + 360, y);
      g.addColorStop(0, "rgba(244,161,0,0)");
      g.addColorStop(0.5, color);
      g.addColorStop(1, "rgba(244,161,0,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 360, y);
      ctx.lineTo(W / 2 + 360, y);
      ctx.stroke();
    };

    const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };

    const pill = (text: string, y: number, color: string) => {
      ctx.font = `800 34px ${fontStack}`;
      const w = ctx.measureText(text).width + 80;
      const h = 70;
      const x = W / 2 - w / 2;
      ctx.fillStyle = color === GREEN ? "rgba(34,197,94,0.15)" : "rgba(244,161,0,0.15)";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      roundRect(x, y, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      centerTextAt(text, W / 2, y + h / 2, 34, "800", color);
    };

    const statCard = (label: string, value: string, cx: number, y: number, cw: number, ch: number) => {
      const x = cx - cw / 2;
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1.5;
      roundRect(x, y, cw, ch, 24);
      ctx.fill();
      ctx.stroke();
      centerTextAt(value, cx, y + ch / 2 - 6, 76, "900", WHITE);
      centerTextAt(label, cx, y + ch / 2 + 58, 28, "700", MUTED, 4);
    };

    const drawLogo = async (y: number, w = 360, alpha = 0.65) => {
      const logo = await loadLogo();
      if (logo) {
        const ratio = logo.height / logo.width;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(logo, W / 2 - w / 2, y, w, w * ratio);
        ctx.restore();
      } else {
        centerText("ORBIS", y + 40, 80, "900", WHITE, 16);
      }
    };

    const dateLabel = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

    if (template === 1) {
      // Limpo / transparente — adesivo pro story (acompanha o tema)
      const FG = readThemeColor("--foreground");
      const PRIMARY = readThemeColor("--primary");
      const SUCCESS = readThemeColor("--success");
      const DEST = readThemeColor("--destructive");
      centerText("FATURAMENTO", 220, 70, "800", PRIMARY, 12);
      centerText(formatCurrency(totalSold), 380, 150, "900", FG);
      divider(580, PRIMARY);
      centerText("VENDAS", 720, 70, "800", SUCCESS, 12);
      centerText(String(totalSalesCount || 0), 880, 150, "900", FG);
      divider(1090, PRIMARY);
      const cc = conversionRate >= 30 ? SUCCESS : conversionRate >= 15 ? PRIMARY : DEST;
      centerText("CONVERSÃO", 1230, 70, "800", cc, 12);
      centerText(`${conversionRate.toFixed(0)}%`, 1390, 150, "900", FG);
      await drawLogo(H - 320, 380, 0.55);
    } else if (template === 2) {
      // Card escuro com grade de números
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#141414");
      g.addColorStop(1, "#080808");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const rg = ctx.createRadialGradient(W / 2, 420, 60, W / 2, 420, 720);
      rg.addColorStop(0, "rgba(244,161,0,0.16)");
      rg.addColorStop(1, "rgba(244,161,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, 1000);
      centerText("ORBIS · DEFCON 4", 170, 36, "800", GOLD, 8);
      centerText(dateLabel.toUpperCase(), 226, 28, "600", MUTED, 4);
      centerText("FATURAMENTO DO DIA", 400, 38, "700", MUTED, 6);
      centerText(formatCurrency(totalSold), 520, 150, "900", WHITE);
      pill(goalReached ? `META BATIDA · ${percentage.toFixed(0)}%` : `${percentage.toFixed(0)}% DA META`, 630, goalReached ? GREEN : GOLD);
      const gw = 420, gh = 230, gap = 40;
      const leftX = W / 2 - gap / 2 - gw / 2, rightX = W / 2 + gap / 2 + gw / 2;
      const topY = 840, botY = 840 + gh + gap;
      statCard("VENDAS", String(totalSalesCount || 0), leftX, topY, gw, gh);
      statCard("ABORDAGENS", String(totalApproaches || 0), rightX, topY, gw, gh);
      statCard("CONVERSÃO", `${conversionRate.toFixed(0)}%`, leftX, botY, gw, gh);
      statCard("HORAS", horasLabel, rightX, botY, gw, gh);
      await drawLogo(H - 340, 340, 0.7);
    } else {
      // Conquista — fundo dourado quando bate a meta
      const reached = goalReached;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      if (reached) {
        g.addColorStop(0, "#2a1d00");
        g.addColorStop(0.55, "#3a2800");
        g.addColorStop(1, "#0d0900");
      } else {
        g.addColorStop(0, "#161616");
        g.addColorStop(1, "#080808");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const rg = ctx.createRadialGradient(W / 2, 720, 80, W / 2, 720, 820);
      rg.addColorStop(0, reached ? "rgba(244,161,0,0.28)" : "rgba(244,161,0,0.1)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
      centerText(reached ? "META BATIDA" : "RESULTADO DO DIA", 470, 60, "900", reached ? GOLD : WHITE, 6);
      centerText(formatCurrency(totalSold), 680, 170, "900", WHITE);
      centerText(`${percentage.toFixed(0)}% DA META`, 850, 44, "800", reached ? GREEN : MUTED, 6);
      divider(990, GOLD);
      const cols: [string, string][] = [["VENDAS", String(totalSalesCount || 0)], ["CONVERSÃO", `${conversionRate.toFixed(0)}%`], ["HORAS", horasLabel]];
      const colW = W / 3;
      cols.forEach((c, i) => {
        const cx = colW * i + colW / 2;
        centerTextAt(c[1], cx, 1140, 84, "900", WHITE);
        centerTextAt(c[0], cx, 1212, 28, "700", MUTED, 3);
      });
      await drawLogo(H - 340, 340, 0.7);
    }
    return canvas;
  };

  const canvasToBlob = (c: HTMLCanvasElement): Promise<Blob | null> =>
    new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));

  const openShare = async () => {
    setShowShare(true);
    if (Object.keys(previews).length === 3) return;
    setGeneratingPreviews(true);
    try {
      const out: Record<number, string> = {};
      for (const t of [1, 2, 3] as const) {
        const c = await buildCanvas(t);
        if (c) out[t] = c.toDataURL("image/png");
      }
      setPreviews(out);
    } finally {
      setGeneratingPreviews(false);
    }
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const canvas = await buildCanvas(selectedTemplate);
      if (!canvas) throw new Error("Falha ao gerar imagem");
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error("Falha ao gerar imagem");
      const file = new File([blob], `orbis-resultado.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Meu resultado no Orbis",
          text: `${formatCurrency(totalSold)} • ${percentage.toFixed(0)}% da meta`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `orbis-resultado.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({
          title: "Imagem baixada",
          description: "Abra o Instagram Stories e poste como adesivo transparente.",
        });
      }
    } catch (err) {
      const error = err as Error;
      if (error.name !== "AbortError") {
        toast({
          title: "Erro ao compartilhar",
          description: error.message || "Tente novamente.",
          variant: "destructive",
        });
      }
    } finally {
      setSharing(false);
    }
  };

  const handleFinalize = async () => {
    if (totalRecebido > totalSold) {
      toast({
        title: "Valor inválido",
        description: "O total recebido excede o vendido.",
        variant: "destructive",
      });
      return;
    }
    if (hasCalote && !caloteAcknowledged) {
      toast({
        title: "Você tem calote pendente",
        description: "Toque em 'Registrar depois' ou 'Ignorar' antes de finalizar.",
      });
      return;
    }
    setSaving(true);
    try {
      if (totalRecebido > 0) {
        await onSaveBreakdown(dinheiroNum, cartaoNum, pixNum);
      }
      onExit();
    } finally {
      setSaving(false);
    }
  };

  const valueColor = goalReached ? "text-success" : totalSold > 0 ? "text-foreground" : "text-muted-foreground";
  const subTextColor = goalReached ? "text-success" : "text-muted-foreground";

  return (
    <div
      className="min-h-[100dvh] bg-background text-foreground select-none"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 20px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
      }}
    >
      <div className="max-w-sm mx-auto px-5 flex flex-col gap-5">
        {/* 1. HEADER — RESULTADO */}
        <div className="text-center space-y-2">
          <div className="text-xs font-mono text-muted-foreground tracking-[0.3em] uppercase">
            🔥 Desafio encerrado
          </div>
          <div className={`text-5xl font-black tracking-tight ${valueColor}`}>
            {formatCurrency(totalSold)}
          </div>
          <div className={`text-sm font-medium ${subTextColor}`}>
            {subText}
          </div>
        </div>

        {/* DESAFIO DA SEMANA — lembrete: manda o extrato pra contar no ranking */}
        <WeeklyChallengeExtratoNudge />

        {/* Celebração — bateu/ultrapassou a meta */}
        {goalReached && (
          <div className="rounded-2xl bg-gradient-to-br from-success/25 via-success/15 to-success/10 border border-success/40 p-4 text-center space-y-1 shadow-[0_8px_30px_-8px_hsl(var(--success)/0.4)]">
            <div className="text-3xl">🎉</div>
            <div className="text-base font-black text-success tracking-tight">
              {percentage >= 150 ? "VOCÊ EXPLODIU A META!" : percentage >= 110 ? "ULTRAPASSOU A META!" : "META BATIDA!"}
            </div>
            <div className="text-xs text-success/80 font-mono">
              {percentage.toFixed(0)}% · {formatCurrency(Math.max(0, totalSold - dailyGoal))} acima
            </div>
          </div>
        )}

        {/* 2. SHARE — 3 artes transparentes (arraste pra escolher) e posta no Instagram */}
        {totalSold > 0 && (
          <DefconShareCarousel
            stats={{
              faturamento: totalSold,
              vendas: totalSalesCount,
              conversao: conversionRate,
              horas: horasLabel,
            }}
          />
        )}

        {/* Empurrão de teste — aparece SEMPRE que finaliza o DEFCON (durante o trial) */}
        {userId && (
          <TrialNudge
            userId={userId}
            momentKey="defcon_end"
            oncePerDay={false}
            title="Tá curtindo o foco do DEFCON 4?"
            benefit="É aqui que você vende com meta, cronômetro e conversão ao vivo — quem usa todo dia rende mais. Quando o teste acabar, isso trava."
          />
        )}

        {/* 3. RECEBIMENTOS */}
        {totalSold > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wider">
              Confira seus recebimentos
            </h2>

            {/* Gorjetas — destaque dourado, editável no fim do dia */}
            <div className="rounded-xl bg-gradient-to-r from-primary/15 via-primary/8 to-transparent border border-primary/35 px-3.5 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                <Coins className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-primary font-bold">Gorjetas</p>
                <p className="text-xs text-muted-foreground">Já incluídas no dinheiro</p>
              </div>
              {editingTip ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={tipInput}
                    onChange={(e) => setTipInput(e.target.value)}
                    autoFocus
                    placeholder="0"
                    className="w-20 h-9 rounded-lg bg-background border border-primary/40 px-2 text-right text-base font-bold text-primary tabular-nums outline-none focus:border-primary"
                  />
                  <button
                    onClick={saveTip}
                    disabled={savingTip}
                    aria-label="Salvar gorjeta"
                    className="w-9 h-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center active:scale-90 transition"
                  >
                    {savingTip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setEditingTip(false)}
                    aria-label="Cancelar"
                    className="w-9 h-9 rounded-lg text-muted-foreground flex items-center justify-center active:scale-90 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={startEditTip}
                  aria-label="Editar gorjeta"
                  className="flex items-center gap-2 active:scale-95 transition"
                >
                  <span className="text-base font-bold text-primary tabular-nums">+{formatCurrency(totalTips)}</span>
                  <Pencil className="w-3.5 h-3.5 text-primary/70" />
                </button>
              )}
            </div>

            <PaymentInput iconSrc={pixLogo} label="Pix" value={pix} onChange={setPix} accent="text-muted-foreground" />
            <PaymentInput emoji="💳" label="Cartão" value={cartao} onChange={setCartao} accent="text-muted-foreground" />
            <PaymentInput emoji="💵" label="Dinheiro" value={dinheiro} onChange={setDinheiro} accent="text-muted-foreground" />

            {/* Resumo total recebido vs vendido */}
            {totalRecebido > 0 && (
              <div className="rounded-xl bg-card border border-border px-3.5 py-2.5 flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Total recebido</span>
                <span className={`text-sm font-bold tabular-nums ${fullyReceived ? 'text-success' : hasCalote ? 'text-destructive/80' : 'text-foreground'}`}>
                  {formatCurrency(totalRecebido)} <span className="text-muted-foreground font-normal">/ {formatCurrency(totalSold)}</span>
                </span>
              </div>
            )}

            {fullyReceived && (
              <div className="text-xs text-success font-semibold text-center pt-0.5">
                ✔ 100% recebido
              </div>
            )}

            {hasCalote && (
              <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-3.5 py-3 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-destructive/80">
                    <span className="font-semibold">{formatCurrency(calote)}</span> não recebidos
                  </div>
                  {!caloteAcknowledged && (
                    <div className="mt-2">
                      <div className="text-xs text-muted-foreground mb-1.5">Quantos kits ficaram sem pagar?</div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setCaloteUnits((n) => Math.max(0, n - 1))}
                            className="w-8 h-8 rounded-md bg-destructive/20 text-destructive font-bold text-lg leading-none active:scale-95 transition-transform"
                          >
                            −
                          </button>
                          <span className="w-7 text-center text-base font-bold tabular-nums text-foreground">{caloteUnits}</span>
                          <button
                            type="button"
                            onClick={() => setCaloteUnits((n) => Math.min(9999, n + 1))}
                            className="w-8 h-8 rounded-md bg-destructive/20 text-destructive font-bold text-lg leading-none active:scale-95 transition-transform"
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={savingUnits}
                          onClick={saveCaloteUnits}
                          className="text-xs px-3 py-1.5 rounded-md bg-destructive/20 text-destructive font-medium active:scale-95 transition-transform disabled:opacity-60"
                        >
                          {savingUnits ? "Salvando…" : "Salvar"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCaloteAcknowledged(true)}
                          className="text-xs px-3 py-1.5 rounded-md bg-muted text-foreground font-medium active:scale-95 transition-transform"
                        >
                          Ignorar
                        </button>
                      </div>
                    </div>
                  )}
                  {caloteAcknowledged && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {caloteUnits > 0 ? `Anotado: ${caloteUnits} ${caloteUnits === 1 ? "unidade não paga" : "unidades não pagas"}.` : "Anotado."}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. RELATÓRIO DO DIA — no estilo do relatório de bloco de hora */}
        {(totalApproaches > 0 || totalSalesCount > 0 || totalSold > 0) && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground px-1 uppercase tracking-wider">
              Relatório do dia
            </h2>
            <div className="rounded-2xl bg-card border border-border divide-y divide-border/60 overflow-hidden">
              <ReportRow label="⏱️ Horas trabalhadas" value={horasLabel} />
              <ReportRow label="💰 Vendido" value={formatCurrency(totalSold)} />
              <ReportRow label="👤 Abordagens" value={String(totalApproaches)} />
              <ReportRow label="🛒 Vendas" value={String(totalSalesCount)} valueClass="text-success" />
              <ReportRow
                label="📊 Conversão"
                value={`${conversionRate.toFixed(0)}%`}
                valueClass={conversionRate >= 30 ? "text-success" : conversionRate >= 15 ? "text-warning" : "text-destructive"}
              />
              {salesRhythmMin != null && (
                <ReportRow
                  label="⚡ Ritmo de vendas"
                  value={`1 a cada ${salesRhythmMin < 10 ? salesRhythmMin.toFixed(1) : Math.round(salesRhythmMin)} min`}
                />
              )}
            </div>
            {salesRhythmMin != null && (
              <p className="text-[11px] text-muted-foreground px-1">
                No seu ritmo, você fecha uma venda a cada ~{salesRhythmMin < 10 ? salesRhythmMin.toFixed(1) : Math.round(salesRhythmMin)} minutos.
              </p>
            )}
          </div>
        )}

        {/* 6. INSIGHT rápido (instantâneo) — some quando a dica da IA chega */}
        {insight && !aiTip && (
          <div className="rounded-xl bg-card border border-border px-3.5 py-3 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground leading-relaxed">{insight}</p>
          </div>
        )}

        {/* 6.1 DICA DO DIA COM IA — botão (gera só quando o vendedor toca) */}
        {(totalApproaches > 0 || totalSalesCount > 0) && (
          aiTip ? (
            <div className="rounded-xl bg-card border border-primary/40 px-3.5 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">Dica do dia · IA</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{aiTip}</p>
            </div>
          ) : (
            <button
              onClick={generateDayTip}
              disabled={aiTipLoading}
              className="w-full h-11 rounded-xl bg-card border border-primary/40 text-primary font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {aiTipLoading ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando dica do dia...</>
              ) : (
                <><Sparkles className="w-3.5 h-3.5" /> Gerar dica do dia com IA</>
              )}
            </button>
          )
        )}
        {aiTipError && (
          <p className="text-[11px] text-destructive text-center">Não consegui gerar agora. Tenta de novo daqui a pouco.</p>
        )}

        {/* 6.5 PDF de clientes */}
        {clientsCount > 0 && (
          <button
            onClick={exportClientsPdf}
            disabled={exportingPdf}
            className="w-full h-11 rounded-xl bg-card border border-primary/40 text-primary font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <FileDown className="w-3.5 h-3.5" />
            {exportingPdf ? "Gerando..." : `PDF de ${clientsCount} cliente(s)`}
          </button>
        )}
        {daySales.length > 0 && (
          <button
            onClick={exportTransactionsPdf}
            disabled={exportingTx}
            className="w-full h-11 rounded-xl bg-card border border-primary/40 text-primary font-semibold text-xs flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <FileDown className="w-3.5 h-3.5" />
            {exportingTx ? "Gerando..." : `PDF de transações — ${daySales.length} c/ horários`}
          </button>
        )}

        {/* 6.6 Extrato do dia (competições) — só pra participantes de competição ativa */}
        {userId && <CompetitionStatementUpload userId={userId} />}

        {/* 7. CTA FINAL */}
        <button
          onClick={handleFinalize}
          disabled={saving}
          className="w-full h-14 rounded-2xl bg-foreground text-background font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-50 mt-1"
        >
          {saving ? "Finalizando..." : "Finalizar dia"}
        </button>

        {/* 8. VOLTAR / REINICIAR — sempre visíveis ao finalizar */}
        <div className="grid grid-cols-2 gap-3 pb-2">
          {onExtend && (
            <button
              onClick={async () => {
                setExtending(true);
                await onExtend();
                setExtending(false);
              }}
              disabled={extending || restarting}
              className="flex flex-col items-center justify-center gap-1 h-16 rounded-2xl bg-card border border-primary/40 text-primary font-semibold text-xs active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" />
              {extending ? "Voltando..." : "Voltar (+1h)"}
            </button>
          )}

          {onRestart && !confirmRestart && (
            <button
              onClick={() => setConfirmRestart(true)}
              disabled={extending || restarting}
              className="flex flex-col items-center justify-center gap-1 h-16 rounded-2xl bg-card border border-border text-muted-foreground font-semibold text-xs active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Reiniciar do zero
            </button>
          )}

          {onRestart && confirmRestart && (
            <button
              onClick={async () => {
                setRestarting(true);
                setConfirmRestart(false);
                await onRestart();
                setRestarting(false);
              }}
              disabled={extending || restarting}
              className="flex flex-col items-center justify-center gap-1 h-16 rounded-2xl bg-destructive/15 border border-destructive/50 text-destructive font-bold text-xs active:scale-[0.97] transition-transform disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              {restarting ? "Reiniciando..." : "Confirmar reset"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportRow({ label, value, valueClass = "text-foreground" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-lg font-black tabular-nums ${valueClass}`}>{value}</span>
    </div>
  );
}

interface PaymentInputProps {
  emoji?: string;
  iconSrc?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}

function PaymentInput({ emoji, iconSrc, label, value, onChange, accent }: PaymentInputProps) {
  const hasIcon = !!emoji || !!iconSrc;
  // Máscara BR ao vivo (estilo banco): digita só números, 2 últimos são centavos.
  const num = parseFloat(value) || 0;
  const display = num ? num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  return (
    <div className="relative h-11 rounded-lg bg-card border border-border focus-within:border-muted-foreground transition-colors">
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 object-contain"
        />
      ) : emoji ? (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">
          {emoji}
        </span>
      ) : null}
      <span className={`absolute ${hasIcon ? 'left-10' : 'left-3'} top-1/2 -translate-y-1/2 text-xs font-medium ${accent}`}>
        {label}
      </span>
      <span className="absolute right-[72px] top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
        R$
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={display}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, "");
          onChange(d ? String(parseInt(d, 10) / 100) : "");
        }}
        placeholder="0,00"
        className="w-full h-full bg-transparent text-right text-base font-bold text-foreground pr-3 pl-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded placeholder:text-muted-foreground"
      />
    </div>
  );
}
