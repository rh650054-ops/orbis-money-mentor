// Gera uma imagem "instagramável" (1080x1350) de um post da comunidade Orbis.
import type { FeedPost } from "@/hooks/useCommunityFeed";

const loadLogo = (): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/orbis-logo.png";
  });

export async function generatePostShareImage(post: FeedPost): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const BG = "#0B0B0C";
  const GOLD = "#F4A100";
  const FG = "#FFFFFF";
  const MUTED = "rgba(255,255,255,0.6)";
  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  // Fundo + borda dourada sutil
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(244,161,0,0.5)";
  ctx.lineWidth = 4;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const drawSpaced = (text: string, y: number, size: number, color: string, weight: string, spacing: number) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    const chars = text.split("");
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
    let x = W / 2 - total / 2;
    ctx.textAlign = "left";
    chars.forEach((c, i) => { ctx.fillText(c, x, y); x += widths[i]! + spacing; });
    ctx.textAlign = "center";
  };

  // Topo
  drawSpaced("COMUNIDADE ORBIS", 130, 34, GOLD, "800", 8);

  // Autor
  ctx.fillStyle = FG;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(`@${post.nickname ?? "vendedor"}`, W / 2, 232);
  const loc = [post.city, post.state].filter(Boolean).join(" · ");
  if (loc) {
    ctx.fillStyle = MUTED;
    ctx.font = `500 30px ${FONT}`;
    ctx.fillText(loc, W / 2, 286);
  }

  // Conteúdo (word-wrap)
  const content = (post.content || "").trim() || "(imagem)";
  const fontSize = content.length > 220 ? 40 : content.length > 120 ? 48 : 58;
  ctx.fillStyle = FG;
  ctx.font = `600 ${fontSize}px ${FONT}`;
  const maxWidth = W - 200;
  const words = content.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const maxLines = 12;
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines && shown.length) {
    shown[maxLines - 1] = `${shown[maxLines - 1].slice(0, -1)}…`;
  }
  const lineH = fontSize * 1.35;
  const blockH = shown.length * lineH;
  let y = Math.max(440, H / 2 - blockH / 2);

  // Aspas decorativas
  ctx.fillStyle = "rgba(244,161,0,0.35)";
  ctx.font = `900 140px Georgia, serif`;
  ctx.fillText("“", W / 2, y - 100);

  ctx.fillStyle = FG;
  ctx.font = `600 ${fontSize}px ${FONT}`;
  for (const ln of shown) {
    ctx.fillText(ln, W / 2, y);
    y += lineH;
  }

  // Rodapé: logo + assinatura
  const logo = await loadLogo();
  if (logo) {
    const lw = 64;
    const ratio = logo.height / logo.width;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(logo, W / 2 - lw / 2, H - 210, lw, lw * ratio);
    ctx.restore();
  }
  ctx.fillStyle = MUTED;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillText("Feito no Orbis", W / 2, H - 110);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
