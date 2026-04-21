import { useRef, useState } from "react";
import { Instagram, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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

    // Helper for centered text
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
        // Manual letter spacing
        const chars = text.split("");
        const widths = chars.map((c) => ctx.measureText(c).width);
        const total = widths.reduce((a, b) => a + b, 0) + letterSpacing * (chars.length - 1);
        let x = W / 2 - total / 2;
        chars.forEach((c, i) => {
          ctx.textAlign = "left";
          ctx.fillText(c, x, y);
          x += widths[i] + letterSpacing;
        });
        ctx.textAlign = "center";
      } else {
        ctx.fillText(text, W / 2, y);
      }
    };

    // Top badge: "BLOCO #N"
    centerText(`BLOCO #${blockIndex + 1}`, 380, 44, "600", "rgba(255,255,255,0.7)", 8);

    // Emoji (large)
    ctx.font = "180px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(getEmoji(), W / 2, 560);

    // Stats stack (Strava-like): label small, value huge
    let y = 780;
    const drawStat = (label: string, value: string, valueColor = "#FFFFFF") => {
      centerText(label, y, 38, "500", "rgba(255,255,255,0.65)", 4);
      y += 80;
      centerText(value, y, 130, "800", valueColor);
      y += 160;
    };

    drawStat("Faturamento", formatCurrency(soldAmount), "#FFFFFF");
    drawStat("Vendas", String(sales), "#22C55E");
    drawStat("Abordagens", String(approaches), "#FFFFFF");

    const convColor =
      conversionRate >= 30 ? "#22C55E" : conversionRate >= 15 ? "#F59E0B" : "#EF4444";
    drawStat("Conversão", `${conversionRate.toFixed(0)}%`, convColor);

    // Bottom brand
    centerText("ORBIS", H - 160, 56, "900", "#F4A100", 14);
    centerText("modo defcon 4", H - 100, 28, "500", "rgba(255,255,255,0.5)", 6);

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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 select-none">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">{getEmoji()}</div>
        <div className="text-xs font-mono text-neutral-600 tracking-[0.3em] uppercase mb-2">
          Relatório do Bloco #{blockIndex + 1}
        </div>
      </div>

      <div className="w-full max-w-sm space-y-3 mb-8">
        <div className="bg-neutral-900 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">👤 Abordagens</span>
          <span className="text-2xl font-black text-white">{approaches}</span>
        </div>

        <div className="bg-neutral-900 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">🛒 Vendas</span>
          <span className="text-2xl font-black text-green-500">{sales}</span>
        </div>

        <div className="bg-neutral-900 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">💰 Valor vendido</span>
          <span className="text-xl font-black text-white">{formatCurrency(soldAmount)}</span>
        </div>

        <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-4 flex justify-between items-center">
          <span className="text-sm font-mono text-neutral-500">📊 Conversão</span>
          <span className={`text-2xl font-black ${
            conversionRate >= 30 ? "text-green-500" : conversionRate >= 15 ? "text-amber-500" : "text-red-500"
          }`}>
            {conversionRate.toFixed(0)}%
          </span>
        </div>
      </div>

      <p className="text-sm text-neutral-500 font-mono text-center mb-6 max-w-sm italic">
        "{getMessage()}"
      </p>

      {/* Instagram share button */}
      <button
        onClick={handleShare}
        disabled={sharing}
        className="w-full max-w-sm h-12 mb-3 bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white font-bold text-sm rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-60"
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
        className="w-full max-w-sm h-14 bg-neutral-900 border border-neutral-700 text-white font-bold text-lg rounded-xl active:scale-95 transition-transform"
      >
        PRÓXIMO BLOCO →
      </button>
    </div>
  );
}
