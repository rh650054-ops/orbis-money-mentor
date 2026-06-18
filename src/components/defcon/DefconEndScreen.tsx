import { useEffect, useMemo, useState } from "react";
import { Share2, AlertTriangle, Sparkles, FileDown, Coins } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { toast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TrialNudge } from "@/components/TrialNudge";
import jsPDF from "jspdf";
import orbisLogo from "@/assets/orbis-logo-share.png";
import pixLogo from "@/assets/pix-logo.png";
import { readThemeColor, RANKING_TIER_COLORS } from "@/shared/lib/theme-colors";

interface DefconEndScreenProps {
  phase: "finished" | "abandoned";
  totalSold: number;
  dailyGoal: number;
  totalBlocks: number;
  totalApproaches?: number;
  totalSalesCount?: number;
  userId?: string;
  onSaveBreakdown: (dinheiro: number, cartao: number, pix: number) => Promise<void>;
  onExit: () => void;
}

export function DefconEndScreen({
  phase,
  totalSold,
  dailyGoal,
  totalBlocks,
  totalApproaches = 0,
  totalSalesCount = 0,
  userId,
  onSaveBreakdown,
  onExit,
}: DefconEndScreenProps) {
  const [pix, setPix] = useState("");
  const [cartao, setCartao] = useState("");
  const [dinheiro, setDinheiro] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [caloteAcknowledged, setCaloteAcknowledged] = useState(false);
  const [clientsCount, setClientsCount] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [totalTips, setTotalTips] = useState(0);

  // Carrega quantidade de clientes salvos hoje pra mostrar/esconder o botão de PDF + gorjetas
  useEffect(() => {
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);
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

  const exportClientsPdf = async () => {
    if (!userId) return;
    setExportingPdf(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
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

  const pixNum = parseFloat(pix) || 0;
  const cartaoNum = parseFloat(cartao) || 0;
  const dinheiroNum = parseFloat(dinheiro) || 0;
  const totalRecebido = pixNum + cartaoNum + dinheiroNum;
  const calote = Math.max(0, totalSold - totalRecebido);
  const hasCalote = calote > 0 && totalRecebido > 0;
  const fullyReceived = totalRecebido >= totalSold && totalSold > 0;

  const percentage = dailyGoal > 0 ? (totalSold / dailyGoal) * 100 : 0;
  const goalReached = totalSold >= dailyGoal && totalSold > 0;
  const conversionRate = totalApproaches > 0 ? (totalSalesCount / totalApproaches) * 100 : 0;

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

  // Generate Instagram Story image (1080x1920, transparent)
  const generateStoryImage = async (): Promise<Blob | null> => {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.clearRect(0, 0, W, H);

    const centerText = (
      text: string,
      y: number,
      size: number,
      weight: string,
      color: string,
      letterSpacing = 0
    ) => {
      ctx.fillStyle = color;
      ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (letterSpacing > 0) {
        const chars = text.split("");
        const widths = chars.map((c) => ctx.measureText(c).width);
        const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * (chars.length - 1);
        let x = W / 2 - total / 2;
        chars.forEach((c, i) => {
          ctx.textAlign = "left";
          ctx.fillText(c, x, y);
          x += widths[i]! + letterSpacing;
        });
        ctx.textAlign = "center";
      } else {
        ctx.fillText(text, W / 2, y);
      }
    };

    // Golden divider with glowing center diamond
    const drawDivider = (y: number) => {
      const lineW = 720;
      const xStart = W / 2 - lineW / 2;
      const xEnd = W / 2 + lineW / 2;

      const grad = ctx.createLinearGradient(xStart, y, xEnd, y);
      grad.addColorStop(0, "rgba(244,161,0,0)");
      grad.addColorStop(0.5, "rgba(244,161,0,1)");
      grad.addColorStop(1, "rgba(244,161,0,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.lineTo(xEnd, y);
      ctx.stroke();

      ctx.save();
      ctx.shadowColor = "rgba(244,161,0,0.9)";
      ctx.shadowBlur = 40;
      ctx.fillStyle = RANKING_TIER_COLORS.goldSoft;
      ctx.beginPath();
      ctx.moveTo(W / 2, y - 14);
      ctx.lineTo(W / 2 + 14, y);
      ctx.lineTo(W / 2, y + 14);
      ctx.lineTo(W / 2 - 14, y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const TITLE_SIZE = 72;
    const VALUE_SIZE = 160;
    const SPACING = 12;
    const VALUE_COLOR = readThemeColor("--foreground");

    const PRIMARY_COLOR = readThemeColor("--primary");
    const SUCCESS_COLOR = readThemeColor("--success");
    const DESTRUCTIVE_COLOR = readThemeColor("--destructive");

    // Faturamento
    centerText("FATURAMENTO", 200, TITLE_SIZE, "800", PRIMARY_COLOR, SPACING);
    centerText(formatCurrency(totalSold), 360, VALUE_SIZE, "900", VALUE_COLOR);
    drawDivider(560);

    // Vendas
    centerText("VENDAS", 700, TITLE_SIZE, "800", SUCCESS_COLOR, SPACING);
    centerText(String(totalSalesCount || 0), 860, VALUE_SIZE, "900", VALUE_COLOR);
    drawDivider(1080);

    // Conversão
    const convColor =
      conversionRate >= 30 ? SUCCESS_COLOR : conversionRate >= 15 ? PRIMARY_COLOR : DESTRUCTIVE_COLOR;
    centerText("CONVERSÃO", 1220, TITLE_SIZE, "800", convColor, SPACING);
    centerText(`${conversionRate.toFixed(0)}%`, 1380, VALUE_SIZE, "900", VALUE_COLOR);

    // Orbis watermark sutil no rodapé
    try {
      const logo = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = orbisLogo;
      });
      const logoW = 380;
      const ratio = logo.height / logo.width;
      const logoH = logoW * ratio;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(logo, W / 2 - logoW / 2, H - logoH - 60, logoW, logoH);
      ctx.restore();
    } catch {
      ctx.save();
      ctx.globalAlpha = 0.55;
      centerText("ORBIS", H - 220, 90, "900", readThemeColor("--background"), 16);
      ctx.restore();
    }

    return new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/png")
    );
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const blob = await generateStoryImage();
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

        {/* 2. SHARE — Dourado, prioridade alta */}
        {totalSold > 0 && (
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-full py-3.5 rounded-2xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60 shadow-[0_8px_24px_-10px_hsl(var(--primary)/0.6)]"
          >
            <Share2 className="w-4 h-4" />
            {sharing ? "Gerando..." : "Compartilhar resultado"}
          </button>
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

            {/* Gorjetas — destaque dourado */}
            {totalTips > 0 && (
              <div className="rounded-xl bg-gradient-to-r from-primary/15 via-primary/8 to-transparent border border-primary/35 px-3.5 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs uppercase tracking-wider text-primary font-bold">Gorjetas</p>
                  <p className="text-xs text-muted-foreground">Já incluídas no dinheiro</p>
                </div>
                <p className="text-base font-bold text-primary tabular-nums">+{formatCurrency(totalTips)}</p>
              </div>
            )}

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
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setCaloteAcknowledged(true)}
                        className="text-xs px-3 py-1.5 rounded-md bg-destructive/20 text-destructive font-medium active:scale-95 transition-transform"
                      >
                        Registrar depois
                      </button>
                      <button
                        onClick={() => setCaloteAcknowledged(true)}
                        className="text-xs px-3 py-1.5 rounded-md bg-muted text-foreground font-medium active:scale-95 transition-transform"
                      >
                        Ignorar
                      </button>
                    </div>
                  )}
                  {caloteAcknowledged && (
                    <div className="text-xs text-muted-foreground mt-1">Anotado.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. RELATÓRIO — cards de performance */}
        {(totalApproaches > 0 || totalSalesCount > 0) && (
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-card border border-border px-2 py-3 text-center">
              <div className="text-lg font-black text-foreground tabular-nums">{totalApproaches}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">Abordagens</div>
            </div>
            <div className="rounded-xl bg-card border border-border px-2 py-3 text-center">
              <div className="text-lg font-black text-foreground tabular-nums">{totalSalesCount}</div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mt-0.5">Vendas</div>
            </div>
            <div className="rounded-xl bg-card border border-primary/30 px-2 py-3 text-center">
              <div className="text-lg font-black text-primary tabular-nums">{conversionRate.toFixed(0)}%</div>
              <div className="text-xs uppercase tracking-wider text-primary/70 font-semibold mt-0.5">Conversão</div>
            </div>
          </div>
        )}

        {/* 6. INSIGHT IA */}
        {insight && (
          <div className="rounded-xl bg-card border border-border px-3.5 py-3 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-foreground leading-relaxed">{insight}</p>
          </div>
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

        {/* 7. CTA FINAL */}
        <button
          onClick={handleFinalize}
          disabled={saving}
          className="w-full h-14 rounded-2xl bg-foreground text-background font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-50 mt-1"
        >
          {saving ? "Finalizando..." : "Finalizar dia"}
        </button>
      </div>
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
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full h-full bg-transparent text-right text-base font-bold text-foreground pr-3 pl-28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded placeholder:text-muted-foreground"
      />
    </div>
  );
}
