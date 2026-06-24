import { useEffect, useRef, useState } from "react";
import { Instagram, Loader2 } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { toast } from "@/shared/hooks/use-toast";
import { BRAND_COLORS } from "@/shared/lib/theme-colors";

// Dados que entram nas artes compartilháveis
export interface ShareStats {
  faturamento: number;
  vendas: number;
  conversao: number; // em %
  horas: string;     // ex. "8h"
}

// Ordem do carrossel: 1 = EMPILHADA (padrão), 2 = DESTAQUE, 3 = GRADE
const ORDER: (1 | 2 | 3)[] = [1, 2, 3];

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
const GOLD = "#F4A100";
const WHITE = "#FFFFFF";
const MUTED = "#8A8F98";

// Constrói uma das 3 artes (1080x1920, fundo preto — pronta pro Instagram)
async function buildCanvas(template: 1 | 2 | 3, s: ShareStats): Promise<HTMLCanvasElement | null> {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Fundo TRANSPARENTE — pra postar como adesivo no story do Instagram
  ctx.clearRect(0, 0, W, H);

  // Rótulo (cinza, espaçado, maiúsculo)
  const label = (text: string, cx: number, y: number, size: number, color = MUTED) => {
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const ls = size * 0.28;
    const chars = text.split("");
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
    let x = cx - total / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = color;
    chars.forEach((c, i) => { ctx.fillText(c, x, y); x += widths[i]! + ls; });
    ctx.textAlign = "center";
  };

  // Valor grande em branco com leve aberração cromática (visual "chique/glitch")
  const value = (text: string, cx: number, y: number, size: number) => {
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#FF003C";
    ctx.fillText(text, cx - 5, y);
    ctx.fillStyle = "#00C8FF";
    ctx.fillText(text, cx + 5, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = WHITE;
    ctx.fillText(text, cx, y);
  };

  // Logo Orbis (alvo: anel + ponto central), desenhado pra bater 100%
  const bullseye = (cx: number, cy: number, r: number, color = WHITE) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = r * 0.22;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.34, 0, Math.PI * 2);
    ctx.fill();
  };

  const vline = (x: number, y0: number, y1: number) => {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
  };

  const hline = (x0: number, x1: number, y: number) => {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  };

  const fat = formatCurrency(s.faturamento);
  const vendas = String(s.vendas);
  const conv = `${s.conversao.toFixed(0)}%`;
  const horas = s.horas;

  if (template === 1) {
    // ===== EMPILHADA (padrão) — tudo um embaixo do outro =====
    label("FATURAMENTO", W / 2, 170, 46, GOLD);
    value(fat, W / 2, 320, 168);

    label("VENDAS", W / 2, 640, 40);
    value(vendas, W / 2, 770, 150);

    label("CONVERSÃO", W / 2, 1060, 40);
    value(conv, W / 2, 1190, 150);

    label("HORAS TRABALHADAS", W / 2, 1480, 40);
    value(horas, W / 2, 1610, 150);

    bullseye(W / 2, 1810, 58);
  } else if (template === 2) {
    // ===== DESTAQUE — faturamento herói + linha de números =====
    bullseye(W / 2, 230, 50);
    label("FATURAMENTO", W / 2, 470, 46, GOLD);
    value(fat, W / 2, 640, 180);
    hline(W / 2 - 380, W / 2 + 380, 880);

    const cols: [string, string][] = [["VENDAS", vendas], ["CONVERSÃO", conv], ["HORAS", horas]];
    const colW = W / 3;
    cols.forEach((c, i) => {
      const cx = colW * i + colW / 2;
      label(c[0], cx, 1080, 34);
      value(c[1], cx, 1210, 110);
      if (i > 0) vline(colW * i, 1010, 1290);
    });

    hline(W / 2 - 380, W / 2 + 380, 1480);
    label("ORBIS · DEFCON 4", W / 2, 1700, 34, MUTED);
  } else {
    // ===== GRADE — os 4 números em 2x2 =====
    label("ORBIS · DEFCON 4", W / 2, 230, 34, GOLD);
    const cells: [string, string][] = [
      ["FATURAMENTO", fat],
      ["VENDAS", vendas],
      ["CONVERSÃO", conv],
      ["HORAS", horas],
    ];
    const cxs = [W / 2 - 250, W / 2 + 250];
    const cys = [620, 1140];
    cells.forEach((cell, i) => {
      const cx = cxs[i % 2]!;
      const cy = cys[Math.floor(i / 2)]!;
      label(cell[0], cx, cy - 90, 32);
      value(cell[1], cx, cy + 30, i === 0 ? 96 : 120);
    });
    hline(W / 2 - 380, W / 2 + 380, 1560);
    bullseye(W / 2, 1740, 54);
  }

  return canvas;
}

const canvasToBlob = (c: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));

// Carrossel deslizável (estilo Strava): arrasta pra escolher e posta no Instagram
export function DefconShareCarousel({ stats }: { stats: ShareStats }) {
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0); // 0 = empilhada (padrão)
  const [sharing, setSharing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      const out: Record<number, string> = {};
      for (const t of ORDER) {
        const c = await buildCanvas(t, stats);
        if (c) out[t] = c.toDataURL("image/png");
      }
      if (alive) {
        setPreviews(out);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.faturamento, stats.vendas, stats.conversao, stats.horas]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const template = ORDER[index] ?? 1;
      const canvas = await buildCanvas(template, stats);
      if (!canvas) throw new Error("Falha ao gerar imagem");
      const blob = await canvasToBlob(canvas);
      if (!blob) throw new Error("Falha ao gerar imagem");
      const file = new File([blob], "orbis-resultado.png", { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>;
      };
      if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Meu resultado no Orbis",
          text: `${formatCurrency(stats.faturamento)} • ${stats.conversao.toFixed(0)}% de conversão`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "orbis-resultado.png";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Imagem baixada", description: "Abra o Instagram e poste no story ou no feed." });
      }
    } catch (err) {
      const e = err as Error;
      if (e.name !== "AbortError") {
        toast({ title: "Erro ao compartilhar", description: e.message || "Tente de novo.", variant: "destructive" });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      {loading ? (
        <div className="h-80 rounded-2xl bg-card border border-border flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Gerando as artes...
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {ORDER.map((t) => (
              <div key={t} className="snap-center shrink-0 w-full flex items-center justify-center px-1">
                {previews[t] && (
                  <img
                    src={previews[t]}
                    alt={`Arte ${t}`}
                    className="h-80 w-auto rounded-xl border border-border"
                    style={{ background: "#000" }}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5">
            {ORDER.map((t, i) => (
              <span
                key={t}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40"}`}
              />
            ))}
          </div>
          <p className="text-center text-[11px] text-muted-foreground -mt-1">← arraste pra escolher a arte →</p>
        </>
      )}

      <button
        onClick={handleShare}
        disabled={sharing || loading}
        className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
        style={{
          backgroundImage: `linear-gradient(to right, ${BRAND_COLORS.INSTAGRAM_GRADIENT.from}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.via}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.to})`,
        }}
      >
        {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
        {sharing ? "Gerando..." : "Compartilhar no Instagram"}
      </button>
    </div>
  );
}
