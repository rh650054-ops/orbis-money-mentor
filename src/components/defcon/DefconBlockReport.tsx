import { useRef, useState } from "react";
import { Instagram, Loader2 } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { toast } from "@/shared/hooks/use-toast";
import orbisLogo from "@/assets/orbis-logo-share.png";
import { readThemeColor, BRAND_COLORS } from "@/shared/lib/theme-colors";

interface DefconBlockReportProps {
  blockIndex: number;
  approaches: number;
  sales: number;
  soldAmount: number;
  onContinue: () => void;
}

export function DefconBlockReport({
  blockIndex,
  approaches,
  sales,
  soldAmount,
  onContinue,
}: DefconBlockReportProps) {
  const [sharing, setSharing] = useState(false);
  const conversionRate = approaches > 0 ? (sales / approaches) * 100 : 0;

  const getMessage = () => {
    if (approaches === 0) return "Nenhuma abordagem registrada neste bloco.";
    if (conversionRate < 15) return "Taxa baixa. Tente abordar com mais confiança e sorria mais.";
    if (conversionRate <= 30) return `Bom ritmo! A cada 10 abordagens você fecha ~${Math.round(conversionRate / 10)} vendas.`;
    return "Excelente conversão! Você está no modo elite hoje.";
  };

  const getEmoji = () => {
    if (approaches === 0) return "📋";
    if (conversionRate < 15) return "💪";
    if (conversionRate <= 30) return "🔥";
    return "🏆";
  };

  // Load logo as HTMLImageElement (for canvas drawing)
  const loadLogo = (): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = orbisLogo;
    });

  // Generate a transparent PNG (1080x1920 - Instagram Story size) with stats
  const generateStoryImage = async (): Promise<Blob | null> => {
    const W = 1080;
    const H = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // Fully transparent background
    ctx.clearRect(0, 0, W, H);

    // Helper for centered text with optional letter-spacing
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

    // Rótulos COLORIDOS (visíveis em qualquer fundo) + valores claros — igual ao card do dia
    const FOREGROUND = readThemeColor("--foreground");
    const PRIMARY = readThemeColor("--primary");
    const SUCCESS = readThemeColor("--success");
    const WARNING = readThemeColor("--warning");
    const DESTRUCTIVE = readThemeColor("--destructive");

    const TITLE_SIZE = 72;
    const VALUE_SIZE = 160;
    const SPACING = 12;

    // Faturamento
    centerText("FATURAMENTO", 200, TITLE_SIZE, "800", PRIMARY, SPACING);
    centerText(formatCurrency(soldAmount), 360, VALUE_SIZE, "900", FOREGROUND);

    // Vendas
    centerText("VENDAS", 700, TITLE_SIZE, "800", SUCCESS, SPACING);
    centerText(String(sales), 860, VALUE_SIZE, "900", FOREGROUND);

    // Conversão
    const convColor =
      conversionRate >= 30 ? SUCCESS : conversionRate >= 15 ? WARNING : DESTRUCTIVE;
    centerText("CONVERSÃO", 1220, TITLE_SIZE, "800", convColor, SPACING);
    centerText(`${conversionRate.toFixed(0)}%`, 1380, VALUE_SIZE, "900", FOREGROUND);

    // Logo sutil no rodapé (não sobrepõe os valores)
    try {
      const logo = await loadLogo();
      const logoW = 380;
      const ratio = logo.height / logo.width;
      const logoH = logoW * ratio;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.drawImage(logo, W / 2 - logoW / 2, H - logoH - 80, logoW, logoH);
      ctx.restore();
    } catch {
      // Fallback: text logo
      centerText("ORBIS", H - 180, 80, "900", FOREGROUND, 16);
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

      const file = new File([blob], `orbis-bloco-${blockIndex + 1}.png`, {
        type: "image/png",
      });

      // Try native share (works on mobile, opens Instagram as option)
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
      };

      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Meu bloco no Orbis",
          text: `Bloco #${blockIndex + 1} • ${formatCurrency(soldAmount)} • ${conversionRate.toFixed(0)}% conversão`,
        });
      } else {
        // Fallback: download the image
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `orbis-bloco-${blockIndex + 1}.png`;
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

  return (
    <div className="min-h-[100dvh] bg-background pt-safe pb-safe flex flex-col items-center justify-center px-6 select-none">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">{getEmoji()}</div>
        <div className="text-xs font-mono text-muted-foreground tracking-[0.3em] uppercase mb-2">
          Relatório do Bloco #{blockIndex + 1}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3 mb-8">
        <div className="bg-card rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-muted-foreground">👤 Abordagens</span>
          <span className="text-2xl font-black text-foreground">{approaches}</span>
        </div>

        <div className="bg-card rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-muted-foreground">🛒 Vendas</span>
          <span className="text-2xl font-black text-success">{sales}</span>
        </div>

        <div className="bg-card rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-muted-foreground">💰 Valor vendido</span>
          <span className="text-xl font-black text-foreground">{formatCurrency(soldAmount)}</span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-muted-foreground">📊 Conversão</span>
          <span className={`text-2xl font-black ${
            conversionRate >= 30 ? "text-success" : conversionRate >= 15 ? "text-warning" : "text-destructive"
          }`}>
            {conversionRate.toFixed(0)}%
          </span>
        </div>

        <div className="bg-card rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-muted-foreground">⏱️ Tempo trabalhado</span>
          <span className="text-2xl font-black text-foreground">{blockIndex + 1}h</span>
        </div>
      </div>

      <p className="text-sm text-muted-foreground font-mono text-center mb-6 max-w-sm italic">
        "{getMessage()}"
      </p>

      {/* Instagram share button */}
      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full max-w-sm h-12 mb-3 text-white font-bold text-sm rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
        style={{
          backgroundImage: `linear-gradient(to right, ${BRAND_COLORS.INSTAGRAM_GRADIENT.from}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.via}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.to})`,
        }}
      >
        {sharing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            GERANDO IMAGEM...
          </>
        ) : (
          <>
            <Instagram className="w-4 h-4" />
            COMPARTILHAR NO INSTAGRAM
          </>
        )}
      </button>

      <button
        onClick={onContinue}
        className="w-full max-w-sm h-14 bg-card border border-border text-foreground font-bold text-lg rounded-xl active:scale-95 transition-transform"
      >
        PRÓXIMO BLOCO →
      </button>
    </div>
  );
}
