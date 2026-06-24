import { useEffect, useRef, useState } from "react";
import { Instagram, Loader2, X } from "lucide-react";
import { formatCurrency } from "@/shared/lib/utils";
import { toast } from "@/shared/hooks/use-toast";
import { BRAND_COLORS } from "@/shared/lib/theme-colors";
import { ORBIS_LOGO, ORBIS_WORDMARK } from "@/assets/orbisLogoData";

// Dados que entram nas artes compartilháveis
export interface ShareStats {
  faturamento: number;
  vendas: number;
  conversao: number; // em %
  horas: string;     // ex. "8h12"
}

// Ordem do carrossel — a EMPILHADA (vertical) é a principal/padrão
type TemplateId = "empilhada" | "empilhadaSemHoras" | "destaque" | "faixa";
const ORDER: TemplateId[] = ["empilhada", "empilhadaSemHoras", "destaque", "faixa"];

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
const GOLD = "#F4A100";
const WHITE = "#FFFFFF";
const MUTED = "#8A8F98";

// Tamanhos iguais aos das referências enviadas
const DIMS: Record<TemplateId, [number, number]> = {
  empilhada: [1080, 1920], // vertical (story) — padrão
  empilhadaSemHoras: [1080, 1920], // igual, mas sem o bloco HORAS
  destaque: [1080, 864],   // paisagem: faturamento + logo + linha de números
  faixa: [1080, 568],      // faixa larga: linha de números + ORBIS
};

// Constrói uma arte (FUNDO TRANSPARENTE — pra colar como adesivo no story)
async function buildCanvas(template: TemplateId, s: ShareStats): Promise<HTMLCanvasElement | null> {
  const [W, H] = DIMS[template];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, W, H); // transparente

  // Rótulo cinza/dourado, MAIÚSCULO e espaçado
  const label = (text: string, x: number, y: number, size: number, color: string, align: "center" | "left" = "center") => {
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    const ls = size * 0.26;
    const chars = text.split("");
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
    let sx = align === "center" ? x - total / 2 : x;
    ctx.textAlign = "left";
    chars.forEach((c, i) => { ctx.fillText(c, sx, y); sx += widths[i]! + ls; });
  };

  // Número grande branco com leve aberração cromática (visual "chique")
  const value = (text: string, x: number, y: number, size: number, align: "center" | "left" = "center") => {
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = "#FF003C";
    ctx.fillText(text, x - 5, y);
    ctx.fillStyle = "#00C8FF";
    ctx.fillText(text, x + 5, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = WHITE;
    ctx.fillText(text, x, y);
  };

  // Logo Orbis OFICIAL (imagem real) — com fallback desenhado se não carregar
  const logoImg = await new Promise<HTMLImageElement | null>((resolve) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = ORBIS_LOGO;
  });
  const drawLogo = (cx: number, cy: number, w: number) => {
    if (logoImg) {
      const ratio = logoImg.height / logoImg.width;
      ctx.drawImage(logoImg, cx - w / 2, cy - (w * ratio) / 2, w, w * ratio);
    } else {
      ctx.strokeStyle = WHITE;
      ctx.lineWidth = w * 0.05;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.46, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // Wordmark "ORBIS" oficial (imagem com a fonte certa da marca)
  const wordmarkImg = await new Promise<HTMLImageElement | null>((resolve) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = ORBIS_WORDMARK;
  });
  const drawWordmark = (cx: number, cy: number, w: number) => {
    if (wordmarkImg) {
      const ratio = wordmarkImg.height / wordmarkImg.width;
      ctx.drawImage(wordmarkImg, cx - w / 2, cy - (w * ratio) / 2, w, w * ratio);
    } else {
      ctx.font = `900 56px ${FONT}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = WHITE;
      ctx.fillText("ORBIS", cx, cy);
    }
  };

  const vline = (x: number, y0: number, y1: number) => {
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
  };

  const hline = (x0: number, x1: number, y: number) => {
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
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

  if (template === "empilhada" || template === "empilhadaSemHoras") {
    // ===== Vertical empilhado (PADRÃO). "SemHoras" = mesma arte sem o bloco HORAS =====
    const semHoras = template === "empilhadaSemHoras";
    if (semHoras) {
      // 3 dados, grupo centralizado (sem HORAS)
      label("FATURAMENTO", W / 2, 460, 46, GOLD);
      value(fat, W / 2, 592, 165);

      label("VENDAS", W / 2, 760, 36, MUTED);
      value(vendas, W / 2, 880, 142);

      label("CONVERSÃO", W / 2, 1048, 36, MUTED);
      value(conv, W / 2, 1168, 142);

      drawLogo(W / 2, 1385, 195);
    } else {
      // 4 dados (com HORAS) — logo um pouco mais pra cima
      label("FATURAMENTO", W / 2, 340, 46, GOLD);
      value(fat, W / 2, 472, 165);

      label("VENDAS", W / 2, 620, 36, MUTED);
      value(vendas, W / 2, 740, 142);

      label("CONVERSÃO", W / 2, 885, 36, MUTED);
      value(conv, W / 2, 1005, 142);

      label("HORAS", W / 2, 1150, 36, MUTED);
      value(horas, W / 2, 1270, 142);

      drawLogo(W / 2, 1505, 195);
    }
  } else if (template === "destaque") {
    // ===== Paisagem: faturamento (cima/esq) + logo (cima/dir) + linha (igual à 1ª) =====
    label("FATURAMENTO", 90, 165, 40, GOLD, "left");
    value(fat, 92, 285, 138, "left");
    drawLogo(905, 220, 170);

    hline(70, W - 70, 500);
    const cols: [string, string][] = [["VENDAS", vendas], ["CONVERSÃO", conv], ["HORAS", horas]];
    const colW = W / 3;
    cols.forEach((c, i) => {
      const cx = colW * i + colW / 2;
      label(c[0], cx, 600, 34, MUTED);
      value(c[1], cx, 715, 108);
      if (i > 0) vline(colW * i, 545, 775);
    });
  } else {
    // ===== Faixa larga: linha de números + logo/ORBIS embaixo (igual à 3ª) =====
    hline(70, W - 70, 65);
    const cols: [string, string][] = [["VENDAS", vendas], ["CONVERSÃO", conv], ["HORAS", horas]];
    const colW = W / 3;
    cols.forEach((c, i) => {
      const cx = colW * i + colW / 2;
      label(c[0], cx, 160, 32, MUTED);
      value(c[1], cx, 275, 112);
      if (i > 0) vline(colW * i, 115, 335);
    });
    drawLogo(180, 460, 128);
    drawWordmark(865, 460, 235);
  }

  return canvas;
}

const canvasToBlob = (c: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));

// Botão "Compartilhar no Instagram" → abre o carrossel deslizável (estilo Strava)
export function DefconShareCarousel({ stats }: { stats: ShareStats }) {
  const [open, setOpen] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState(0); // 0 = empilhada (padrão)
  const [sharing, setSharing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Gera as 3 artes só quando o usuário abre o compartilhamento
  useEffect(() => {
    if (!open || Object.keys(previews).length === ORDER.length) return;
    let alive = true;
    setLoading(true);
    (async () => {
      const out: Record<string, string> = {};
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
  }, [open, stats.faturamento, stats.vendas, stats.conversao, stats.horas]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const template = ORDER[index] ?? "empilhada";
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

  const igGradient = {
    backgroundImage: `linear-gradient(to right, ${BRAND_COLORS.INSTAGRAM_GRADIENT.from}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.via}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.to})`,
  };

  // Fechado: só o botão
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        style={igGradient}
      >
        <Instagram className="w-4 h-4" />
        Compartilhar no Instagram
      </button>
    );
  }

  // Aberto: carrossel deslizável + postar
  return (
    <div className="w-full rounded-2xl bg-card border border-border p-3 space-y-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Escolha a arte</span>
        <button onClick={() => setOpen(false)} className="text-muted-foreground active:scale-90" aria-label="Fechar">
          <X className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="h-72 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Gerando as artes...
        </div>
      ) : (
        <>
          <div
            ref={scrollRef}
            onScroll={onScroll}
            className="flex overflow-x-auto snap-x snap-mandatory rounded-xl"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {ORDER.map((t) => (
              <div key={t} className="snap-center shrink-0 w-full h-72 flex items-center justify-center">
                {previews[t] && (
                  <img
                    src={previews[t]}
                    alt={`Arte ${t}`}
                    className="max-h-full max-w-[94%] object-contain rounded-lg border border-border"
                    style={{ background: "#0a0a0a" }}
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
          <p className="text-center text-[11px] text-muted-foreground -mt-1">← arraste pra escolher →</p>
        </>
      )}

      <button
        onClick={handleShare}
        disabled={sharing || loading}
        className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
        style={igGradient}
      >
        {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
        {sharing ? "Gerando..." : "Compartilhar no Instagram"}
      </button>
    </div>
  );
}
