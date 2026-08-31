import { useEffect, useRef, useState } from "react";
import { Instagram, Loader2, X, Download, Copy, Check } from "lucide-react";
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
  // Rótulo do período na arte (ex.: "DIA 30/08", "ÚLTIMOS 7 DIAS"). Sem ele, a arte
  // sai como sempre saiu no fim do DEFCON ("DEFCON 4").
  periodo?: string;
}

// Ordem do carrossel. "post" = COM FUNDO (design escuro, ideal WhatsApp/feed/status).
// As demais são TRANSPARENTES (adesivo pro Story).
type TemplateId = "post" | "empilhada" | "empilhadaSemHoras" | "destaque" | "faixa";
const ORDER: TemplateId[] = ["post", "empilhada", "empilhadaSemHoras", "destaque", "faixa"];

// Legenda por arte — pra que serve (aparece embaixo do preview, estilo Strava)
const CAPTIONS: Record<TemplateId, string> = {
  post: "Com fundo · WhatsApp, feed e status",
  empilhada: "Transparente · adesivo no Story",
  empilhadaSemHoras: "Transparente · adesivo no Story",
  destaque: "Transparente · adesivo no Story",
  faixa: "Transparente · faixa pro Story",
};
// Artes COM fundo (não transparentes)
const WITH_BG: Set<TemplateId> = new Set(["post"]);

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
const GOLD = "#FFB627";       // dourado brilhante (FATURAMENTO)
const WHITE = "#FFFFFF";
const MUTED = "#E6A93C";      // dourado suave p/ letreiros (VENDAS/CONVERSÃO/HORAS)

// Tamanhos iguais aos das referências enviadas
const DIMS: Record<TemplateId, [number, number]> = {
  post: [1080, 1350],      // COM FUNDO — retrato 4:5 (WhatsApp/feed/status)
  empilhada: [1080, 1920], // vertical (story) — transparente
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
  ctx.clearRect(0, 0, W, H); // por padrão: FUNDO 100% TRANSPARENTE (adesivo p/ Story)

  // Artes COM fundo (WhatsApp/feed): pinta um fundo escuro texturizado dourado.
  if (WITH_BG.has(template)) {
    // base: gradiente escuro
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#151311");
    base.addColorStop(1, "#0A0A0B");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    // brilho dourado no topo
    const glow = ctx.createRadialGradient(W / 2, H * 0.16, 0, W / 2, H * 0.16, W * 0.85);
    glow.addColorStop(0, "rgba(244,161,0,0.20)");
    glow.addColorStop(1, "rgba(244,161,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // faixas diagonais douradas sutis (acabamento tipo Strava)
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 60;
    ctx.beginPath();
    ctx.moveTo(-100, 260); ctx.lineTo(360, -140);
    ctx.moveTo(W - 260, H + 140); ctx.lineTo(W + 160, H - 240);
    ctx.stroke();
    ctx.restore();
    // grão/textura fina
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = WHITE;
    for (let i = 0; i < 1400; i++) {
      const gx = Math.random() * W;
      const gy = Math.random() * H;
      ctx.fillRect(gx, gy, 2, 2);
    }
    ctx.restore();
  }

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

  // Número grande, BRANCO puro (sem aberração cromática — só branco limpo)
  const value = (text: string, x: number, y: number, size: number, align: "center" | "left" = "center") => {
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
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
  // Rodapé da arte: período escolhido no Relatório, ou "DEFCON 4" (fim do modo foco)
  const rodape = (s.periodo || "DEFCON 4").toUpperCase();

  if (template === "post") {
    // ===== COM FUNDO (retrato 4:5) — logo topo, faturamento, linha de números, ORBIS =====
    drawLogo(W / 2, 175, 150);

    label("FATURAMENTO", W / 2, 415, 42, GOLD);
    value(fat, W / 2, 540, 150);

    hline(80, W - 80, 700);
    const cols: [string, string][] = [["VENDAS", vendas], ["CONVERSÃO", conv], ["HORAS", horas]];
    const colW = (W - 160) / 3;
    cols.forEach((c, i) => {
      const cx = 80 + colW * i + colW / 2;
      label(c[0], cx, 800, 32, MUTED);
      value(c[1], cx, 910, 106);
      if (i > 0) vline(80 + colW * i, 745, 985);
    });
    hline(80, W - 80, 1040);

    drawWordmark(W / 2, 1180, 230);
    label(rodape, W / 2, 1270, 26, MUTED);
  } else if (template === "empilhada" || template === "empilhadaSemHoras") {
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
      if (s.periodo) label(rodape, W / 2, 1530, 30, MUTED);
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
      if (s.periodo) label(rodape, W / 2, 1650, 30, MUTED);
    }
  } else if (template === "destaque") {
    // ===== Paisagem: faturamento (cima/esq) + logo (cima/dir) + linha (igual à 1ª) =====
    label("FATURAMENTO", 90, 165, 40, GOLD, "left");
    value(fat, 92, 285, 138, "left");
    if (s.periodo) label(rodape, 92, 385, 26, MUTED, "left");
    drawLogo(905, 265, 170);

    hline(70, W - 70, 460);
    const cols: [string, string][] = [["VENDAS", vendas], ["CONVERSÃO", conv], ["HORAS", horas]];
    const colW = W / 3;
    cols.forEach((c, i) => {
      const cx = colW * i + colW / 2;
      label(c[0], cx, 560, 34, MUTED);
      value(c[1], cx, 675, 108);
      if (i > 0) vline(colW * i, 505, 735);
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
  // Se os números/período mudarem (ex.: trocou o filtro no Relatório), joga os previews
  // antigos fora pra gerar de novo com os dados certos.
  useEffect(() => {
    setPreviews({});
  }, [stats.faturamento, stats.vendas, stats.conversao, stats.horas, stats.periodo]);

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
  }, [open, previews, stats.faturamento, stats.vendas, stats.conversao, stats.horas, stats.periodo]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
  };

  const handleShare = async (templateOverride?: TemplateId) => {
    try {
      setSharing(true);
      const template = templateOverride ?? ORDER[index] ?? "empilhada";
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
          text: `${stats.periodo ? `${stats.periodo} • ` : ""}${formatCurrency(stats.faturamento)} • ${stats.conversao.toFixed(0)}% de conversão`,
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

  // Salvar a arte atual na galeria/downloads
  const handleSave = async () => {
    try {
      setSharing(true);
      const template = ORDER[index] ?? "post";
      const canvas = await buildCanvas(template, stats);
      const blob = canvas ? await canvasToBlob(canvas) : null;
      if (!blob) throw new Error("Falha ao gerar imagem");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "orbis-resultado.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Imagem salva", description: "Confira nas suas fotos / downloads." });
    } catch {
      toast({ title: "Erro ao salvar", description: "Tente de novo.", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  // Copiar a arte atual pra área de transferência
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      setSharing(true);
      const template = ORDER[index] ?? "post";
      const canvas = await buildCanvas(template, stats);
      const blob = canvas ? await canvasToBlob(canvas) : null;
      if (!blob) throw new Error("Falha ao gerar imagem");
      const clip = navigator as Navigator & {
        clipboard?: { write?: (items: ClipboardItem[]) => Promise<void> };
      };
      if (clip.clipboard?.write && typeof ClipboardItem !== "undefined") {
        await clip.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
        toast({ title: "Imagem copiada", description: "Cole no WhatsApp, Instagram, onde quiser." });
      } else {
        await handleSave();
      }
    } catch {
      toast({ title: "Não deu pra copiar", description: "Use Salvar e anexe manualmente.", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  };

  const igGradient = {
    backgroundImage: `linear-gradient(to right, ${BRAND_COLORS.INSTAGRAM_GRADIENT.from}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.via}, ${BRAND_COLORS.INSTAGRAM_GRADIENT.to})`,
  };

  // Xadrez de transparência (igual editores de imagem) — mostra que o PNG não tem fundo
  const checkerboard = {
    backgroundColor: "#3a3a3a",
    backgroundImage:
      "linear-gradient(45deg, #555 25%, transparent 25%), linear-gradient(-45deg, #555 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #555 75%), linear-gradient(-45deg, transparent 75%, #555 75%)",
    backgroundSize: "20px 20px",
    backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
  };

  // Fechado: botão que abre a tela de compartilhamento (estilo Strava).
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        style={igGradient}
      >
        <Instagram className="w-4 h-4" />
        Compartilhar resultado
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
                  <div
                    className="relative max-h-full max-w-[94%] rounded-lg border border-border overflow-hidden"
                    style={WITH_BG.has(t) ? undefined : checkerboard}
                  >
                    {!WITH_BG.has(t) && (
                      <span className="absolute top-2 left-2 z-10 text-[9px] font-bold tracking-wider text-white/90 bg-black/50 px-1.5 py-0.5 rounded">
                        TRANSPARENTE
                      </span>
                    )}
                    <img
                      src={previews[t]}
                      alt={`Arte ${t}`}
                      className="max-h-72 max-w-full object-contain block"
                    />
                  </div>
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
          <p className="text-center text-[11px] font-medium text-foreground -mt-1">
            {CAPTIONS[ORDER[index] ?? "post"]}
          </p>
          <p className="text-center text-[10px] text-muted-foreground -mt-2">← arraste pra escolher →</p>
        </>
      )}

      {/* Ação principal: compartilhar (abre a bandeja do celular → Story, WhatsApp, etc.) */}
      <button
        onClick={() => handleShare()}
        disabled={sharing || loading}
        className="w-full h-12 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60"
        style={igGradient}
      >
        {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
        {sharing ? "Gerando..." : "Compartilhar"}
      </button>

      {/* Ações rápidas estilo Strava: Salvar / Copiar */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={handleSave}
          disabled={sharing || loading}
          className="h-11 rounded-xl bg-muted/60 border border-border text-foreground font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
        >
          <Download className="w-4 h-4" /> Salvar
        </button>
        <button
          onClick={handleCopy}
          disabled={sharing || loading}
          className="h-11 rounded-xl bg-muted/60 border border-border text-foreground font-semibold text-xs flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-60"
        >
          {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}
