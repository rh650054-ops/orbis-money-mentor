import { useMemo, useState } from "react";
import { Share2, AlertTriangle, Sparkles } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import orbisLogo from "@/assets/orbis-logo-share.png";

interface DefconEndScreenProps {
  phase: "finished" | "abandoned";
  totalSold: number;
  dailyGoal: number;
  totalBlocks: number;
  totalApproaches?: number;
  totalSalesCount?: number;
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
  onSaveBreakdown,
  onExit,
}: DefconEndScreenProps) {
  const [pix, setPix] = useState("");
  const [cartao, setCartao] = useState("");
  const [dinheiro, setDinheiro] = useState("");
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [caloteAcknowledged, setCaloteAcknowledged] = useState(false);

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
          x += widths[i] + letterSpacing;
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
      ctx.fillStyle = "#FFD24A";
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
    const VALUE_COLOR = "#FFFFFF"; // branco

    // Faturamento
    centerText("FATURAMENTO", 200, TITLE_SIZE, "800", "#F4A100", SPACING);
    centerText(formatCurrency(totalSold), 360, VALUE_SIZE, "900", VALUE_COLOR);
    drawDivider(560);

    // Vendas
    centerText("VENDAS", 700, TITLE_SIZE, "800", "#22C55E", SPACING);
    centerText(String(totalSalesCount || 0), 860, VALUE_SIZE, "900", VALUE_COLOR);
    drawDivider(1080);

    // Conversão
    const convColor =
      conversionRate >= 30 ? "#22C55E" : conversionRate >= 15 ? "#F4A100" : "#EF4444";
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
      centerText("ORBIS", H - 220, 90, "900", "#0D0D0D", 16);
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

  const valueColor = goalReached ? "text-green-500" : totalSold > 0 ? "text-white" : "text-neutral-500";
  const subTextColor = goalReached ? "text-green-500" : "text-neutral-400";

  return (
    <div className="min-h-screen bg-black text-white px-6 pt-12 pb-10 select-none">
      <div className="max-w-sm mx-auto space-y-8">
        {/* 1. HEADER — RESULTADO */}
        <div className="text-center space-y-3">
          <div className="text-xs font-mono text-neutral-500 tracking-[0.25em] uppercase">
            🔥 Desafio encerrado
          </div>
          <div className={`text-6xl font-black tracking-tight ${valueColor}`}>
            {formatCurrency(totalSold)}
          </div>
          <div className={`text-sm font-medium ${subTextColor}`}>
            {subText}
          </div>
        </div>

        {/* 2. SHARE — Dourado, prioridade alta */}
        {totalSold > 0 && (
          <button
            onClick={handleShare}
            disabled={sharing}
            className="w-full h-14 rounded-2xl bg-[#F4A100] text-black font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <Share2 className="w-5 h-5" />
            {sharing ? "Gerando imagem..." : "Compartilhar resultado"}
          </button>
        )}

        {/* 3. RECEBIMENTOS */}
        {totalSold > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-300 px-1">
              Confira seus recebimentos
            </h2>

            <PaymentInput
              label="Pix"
              value={pix}
              onChange={setPix}
              accent="text-neutral-400"
            />
            <PaymentInput
              label="Cartão"
              value={cartao}
              onChange={setCartao}
              accent="text-neutral-400"
            />
            <PaymentInput
              label="Dinheiro"
              value={dinheiro}
              onChange={setDinheiro}
              accent="text-neutral-400"
            />

            {/* 4. CALOTE — condicional */}
            {fullyReceived && (
              <div className="text-xs text-green-500 font-medium text-center pt-1">
                ✔ 100% recebido
              </div>
            )}

            {hasCalote && (
              <div className="mt-2 rounded-xl bg-red-950/30 border border-red-900/40 px-4 py-3 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-red-300">
                    <span className="font-semibold">{formatCurrency(calote)}</span> não foram recebidos
                  </div>
                  {!caloteAcknowledged && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setCaloteAcknowledged(true)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-900/40 text-red-200 font-medium active:scale-95 transition-transform"
                      >
                        Registrar depois
                      </button>
                      <button
                        onClick={() => setCaloteAcknowledged(true)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 font-medium active:scale-95 transition-transform"
                      >
                        Ignorar
                      </button>
                    </div>
                  )}
                  {caloteAcknowledged && (
                    <div className="text-xs text-neutral-500 mt-1">Anotado.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. RELATÓRIO — compacto horizontal */}
        {(totalApproaches > 0 || totalSalesCount > 0) && (
          <div className="text-center text-sm text-neutral-300 font-mono">
            <span className="text-white font-semibold">{totalApproaches}</span> abordagens
            <span className="text-neutral-600 mx-2">•</span>
            <span className="text-white font-semibold">{totalSalesCount}</span> vendas
            <span className="text-neutral-600 mx-2">•</span>
            <span className="text-[#F4A100] font-semibold">{conversionRate.toFixed(0)}%</span> conversão
          </div>
        )}

        {/* 6. INSIGHT IA */}
        {insight && (
          <div className="rounded-xl bg-neutral-950 border border-neutral-900 px-4 py-3 flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-[#F4A100] mt-0.5 shrink-0" />
            <p className="text-sm text-neutral-300 leading-snug">{insight}</p>
          </div>
        )}

        {/* 7. CTA FINAL */}
        <button
          onClick={handleFinalize}
          disabled={saving}
          className="w-full h-14 rounded-2xl bg-white text-black font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {saving ? "Finalizando..." : "Finalizar dia"}
        </button>
      </div>
    </div>
  );
}

interface PaymentInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}

function PaymentInput({ label, value, onChange, accent }: PaymentInputProps) {
  return (
    <div className="relative h-14 rounded-xl bg-neutral-950 border border-neutral-900 focus-within:border-neutral-700 transition-colors">
      <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium ${accent}`}>
        {label}
      </span>
      <span className="absolute right-[88px] top-1/2 -translate-y-1/2 text-xs text-neutral-600">
        R$
      </span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full h-full bg-transparent text-right text-lg font-bold text-white pr-4 pl-24 focus:outline-none placeholder:text-neutral-700"
      />
    </div>
  );
}
