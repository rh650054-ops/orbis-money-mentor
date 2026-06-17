// Gera uma imagem estilo "tweet compartilhado nos Stories" (1080x1920) de um post da comunidade.
import type { FeedPost } from "@/hooks/useCommunityFeed";

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

const loadLogo = (): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/orbis-logo.png";
  });

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function generatePostShareImage(post: FeedPost): Promise<Blob | null> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const GOLD = "#F4A100";
  const FG = "#F3F3F4";
  const MUTED = "#8C8C92";

  // Fundo: gradiente escuro + brilho dourado suave (cara de "story")
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0E0E12");
  bg.addColorStop(1, "#18141F");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 300, 0, W / 2, 300, 760);
  glow.addColorStop(0, "rgba(244,161,0,0.16)");
  glow.addColorStop(1, "rgba(244,161,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 1000);

  // --- quebra de linha do conteúdo ---
  const content = (post.content || "").trim() || "(imagem)";
  const P = 72;
  const cardX = 70;
  const cardW = W - cardX * 2;
  const textMaxW = cardW - P * 2;
  const fontSize = content.length > 260 ? 42 : content.length > 140 ? 50 : 60;
  ctx.font = `500 ${fontSize}px ${FONT}`;
  const words = content.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > textMaxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const maxLines = 14;
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines && shown.length) shown[maxLines - 1] = `${shown[maxLines - 1].slice(0, -1)}…`;
  const lineH = Math.round(fontSize * 1.42);
  const textH = shown.length * lineH;

  // --- alturas do card ---
  const headerH = 120;
  const gap1 = 50;
  const gap2 = 44;
  const footerH = 80;
  const cardH = P + headerH + gap1 + textH + gap2 + footerH + P;
  const cardY = Math.round((H - cardH) / 2);

  // --- card ---
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 70;
  ctx.shadowOffsetY = 24;
  roundRect(ctx, cardX, cardY, cardW, cardH, 52);
  ctx.fillStyle = "#1B1B21";
  ctx.fill();
  ctx.restore();
  roundRect(ctx, cardX, cardY, cardW, cardH, 52);
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const innerX = cardX + P;
  let cy = cardY + P;

  // --- avatar (iniciais) ---
  const av = 100;
  const avCx = innerX + av / 2;
  const avCy = cy + av / 2;
  const ag = ctx.createLinearGradient(innerX, cy, innerX + av, cy + av);
  ag.addColorStop(0, GOLD);
  ag.addColorStop(1, "#C97E00");
  ctx.fillStyle = ag;
  ctx.beginPath();
  ctx.arc(avCx, avCy, av / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#15151A";
  ctx.font = `800 46px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((post.nickname || "V").trim().slice(0, 2).toUpperCase(), avCx, avCy + 3);

  // --- nome + handle ---
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const nameX = innerX + av + 30;
  ctx.fillStyle = FG;
  ctx.font = `700 44px ${FONT}`;
  ctx.fillText(post.nickname || "Vendedor", nameX, cy + 8);
  ctx.fillStyle = MUTED;
  ctx.font = `500 30px ${FONT}`;
  const handle = `@${(post.nickname || "vendedor").toLowerCase().replace(/\s+/g, "")}`;
  const loc = [post.city, post.state].filter(Boolean).join(", ");
  ctx.fillText(loc ? `${handle} · ${loc}` : handle, nameX, cy + 64);

  cy += headerH + gap1;

  // --- texto do post ---
  ctx.fillStyle = FG;
  ctx.font = `500 ${fontSize}px ${FONT}`;
  let ty = cy;
  for (const ln of shown) {
    ctx.fillText(ln, innerX, ty);
    ty += lineH;
  }
  cy = ty + gap2;

  // --- rodapé: logo + marca + data ---
  const logo = await loadLogo();
  let lx = innerX;
  if (logo) {
    const lh = 46;
    const ratio = logo.width / logo.height;
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, lx, cy + 6, lh * ratio, lh);
    ctx.restore();
    lx += lh * ratio + 18;
  }
  ctx.fillStyle = GOLD;
  ctx.font = `700 32px ${FONT}`;
  ctx.textBaseline = "top";
  ctx.fillText("Comunidade Orbis", lx, cy + 14);

  const dateStr = new Date(post.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  ctx.fillStyle = MUTED;
  ctx.font = `500 30px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(dateStr, cardX + cardW - P, cy + 16);
  ctx.textAlign = "left";

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
