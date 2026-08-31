// Arte "RECAP" do Relatório (semana / mês / período) — estilo Strava premium.
// Desenho puro em canvas, sem React, pra dar pra testar fora do app.
import { formatCurrency } from "@/shared/lib/utils";
import { ORBIS_LOGO, ORBIS_WORDMARK } from "@/assets/orbisLogoData";

export interface RecapDia {
  label: string;   // rótulo curto embaixo da barra ("S", "T"… ou "24")
  valor: number;   // faturamento do dia
  iso?: string;
}

export interface RecapStats {
  titulo: string;            // "AGOSTO 2026" | "SEMANA 24 – 30 AGO" | "24/08 → 30/08"
  subtitulo?: string;        // "últimos 30 dias"
  faturamento: number;
  lucro: number;
  dias: RecapDia[];          // um item por dia do período, em ordem
  diasTrabalhados: number;   // dias com lançamento
  melhorDia?: { label: string; valor: number } | null; // "sáb 29/08"
  vendas: number;            // unidades vendidas (0 = esconde)
  ticketMedio: number;       // 0 = esconde
  horasMin: number;          // minutos trabalhados (0 = esconde)
  caiuPct?: number | null;   // % do vendido que caiu (null = esconde)
}

export type RecapTemplate = "post" | "story";
export const RECAP_DIMS: Record<RecapTemplate, [number, number]> = {
  post: [1080, 1350],   // feed / WhatsApp (4:5)
  story: [1080, 1920],  // story (9:16)
};

const FONT = `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
const GOLD = "#FFB627";
const GOLD_DEEP = "#D98E00";
const WHITE = "#FFFFFF";
const MUTED = "rgba(255,255,255,0.55)";
const LINE = "rgba(255,255,255,0.12)";

export const fmtHorasCurto = (min: number) => {
  const m0 = Math.max(0, Math.round(min || 0));
  if (m0 <= 0) return "0h";
  const h = Math.floor(m0 / 60);
  const m = m0 % 60;
  if (h <= 0) return `${m}min`;
  return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
};

const fmtCurto = (v: number) => {
  if (v >= 100000) return `R$ ${(v / 1000).toFixed(0)}k`;
  if (v >= 10000) return `R$ ${(v / 1000).toFixed(1).replace(".", ",")}k`;
  return formatCurrency(v).replace(",00", "");
};

const loadImg = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export async function buildRecapCanvas(template: RecapTemplate, s: RecapStats): Promise<HTMLCanvasElement | null> {
  const [W, H] = RECAP_DIMS[template];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const story = template === "story";
  const M = 90; // margem lateral
  const CW = W - M * 2;

  // ===== FUNDO: grafite profundo + brilho dourado + faixas diagonais + grão =====
  const base = ctx.createLinearGradient(0, 0, 0, H);
  base.addColorStop(0, "#141210");
  base.addColorStop(1, "#080809");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.2, H * 0.12, 0, W * 0.2, H * 0.12, W * 0.9);
  glow.addColorStop(0, "rgba(255,182,39,0.22)");
  glow.addColorStop(1, "rgba(255,182,39,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 70;
  ctx.beginPath();
  ctx.moveTo(W - 380, H + 120); ctx.lineTo(W + 200, H - 460);
  ctx.moveTo(W - 560, H + 120); ctx.lineTo(W + 20, H - 460);
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = 0.035;
  ctx.fillStyle = WHITE;
  for (let i = 0; i < 1600; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  ctx.restore();
  // filete dourado no topo
  const top = ctx.createLinearGradient(0, 0, W, 0);
  top.addColorStop(0, "rgba(255,182,39,0)");
  top.addColorStop(0.5, GOLD);
  top.addColorStop(1, "rgba(255,182,39,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 4);

  // ===== helpers de texto =====
  const spaced = (text: string, x: number, y: number, size: number, color: string, align: "left" | "center" | "right" = "left", weight = 800) => {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    const ls = size * 0.22;
    const chars = text.split("");
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + ls * (chars.length - 1);
    let sx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    ctx.textAlign = "left";
    chars.forEach((c, i) => { ctx.fillText(c, sx, y); sx += widths[i]! + ls; });
    return total;
  };
  const text = (t: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left", weight = 900, maxW?: number) => {
    let sz = size;
    ctx.font = `${weight} ${sz}px ${FONT}`;
    if (maxW) while (ctx.measureText(t).width > maxW && sz > 40) { sz -= 4; ctx.font = `${weight} ${sz}px ${FONT}`; }
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
    return sz;
  };
  const hline = (y: number, x0 = M, x1 = W - M) => {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
  };

  const [logoImg, wordImg] = await Promise.all([loadImg(ORBIS_LOGO), loadImg(ORBIS_WORDMARK)]);
  const drawLogo = (cx: number, cy: number, w: number) => {
    if (logoImg) {
      const r = logoImg.height / logoImg.width;
      ctx.drawImage(logoImg, cx - w / 2, cy - (w * r) / 2, w, w * r);
    } else {
      ctx.strokeStyle = WHITE; ctx.lineWidth = w * 0.06;
      ctx.beginPath(); ctx.arc(cx, cy, w * 0.45, 0, Math.PI * 2); ctx.stroke();
    }
  };
  const drawWordmark = (cx: number, cy: number, w: number) => {
    if (wordImg) {
      const r = wordImg.height / wordImg.width;
      ctx.drawImage(wordImg, cx - w / 2, cy - (w * r) / 2, w, w * r);
    } else {
      text("ORBIS", cx, cy, w * 0.28, WHITE, "center");
    }
  };

  // ===== LAYOUT (y's) =====
  const Y = story
    ? { header: 170, label: 470, value: 590, sub: 690, chartTop: 800, chartBot: 1180, grid: 1290, footer: 1800 }
    : { header: 120, label: 295, value: 400, sub: 485, chartTop: 570, chartBot: 825, grid: 900, footer: 1262 };

  // ===== HEADER: logo + wordmark à esquerda, período em pílula dourada à direita =====
  drawLogo(M + 34, Y.header, 68);
  drawWordmark(M + 34 + 34 + 24 + 75, Y.header, 150);
  {
    ctx.font = `800 26px ${FONT}`;
    const t = s.titulo.toUpperCase();
    const chars = t.split("");
    const tw = chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + 26 * 0.22 * (chars.length - 1);
    const pw = tw + 64, ph = 62;
    const px = W - M - pw, py = Y.header - ph / 2;
    roundRect(ctx, px, py, pw, ph, 31);
    ctx.fillStyle = "rgba(255,182,39,0.12)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,182,39,0.7)";
    ctx.lineWidth = 2;
    ctx.stroke();
    spaced(t, px + pw / 2, Y.header + 1, 26, GOLD, "center");
  }

  // ===== FATURAMENTO =====
  spaced("FATURAMENTO", M, Y.label, 34, GOLD);
  if (s.subtitulo) spaced(s.subtitulo.toUpperCase(), W - M, Y.label, 22, MUTED, "right", 700);
  text(formatCurrency(s.faturamento), M - 4, Y.value, story ? 170 : 150, WHITE, "left", 900, CW);
  // sublinha: lucro + média/dia
  {
    const n = Math.max(1, s.dias.length);
    const media = s.faturamento / n;
    const parts = [`LUCRO ${formatCurrency(s.lucro)}`, `MÉDIA/DIA ${fmtCurto(media)}`];
    spaced(parts.join("   ·   "), M, Y.sub, 26, MUTED, "left", 700);
  }

  // ===== GRÁFICO DE BARRAS (um dia por barra) =====
  {
    const n = Math.max(1, s.dias.length);
    const gap = n <= 7 ? 14 : n <= 14 ? 8 : 5;
    const bw = (CW - gap * (n - 1)) / n;
    const max = Math.max(1, ...s.dias.map((d) => d.valor));
    const bestIdx = s.dias.reduce((bi, d, i, arr) => (d.valor > (arr[bi]?.valor ?? -1) ? i : bi), 0);
    const chartH = Y.chartBot - Y.chartTop;
    const labelY = Y.chartBot + 34;
    // linha de base
    hline(Y.chartBot);
    s.dias.forEach((d, i) => {
      const x = M + i * (bw + gap);
      const h = d.valor > 0 ? Math.max(10, (d.valor / max) * chartH) : 6;
      const y = Y.chartBot - h;
      const isBest = i === bestIdx && d.valor > 0;
      if (isBest) {
        const g = ctx.createLinearGradient(0, y, 0, Y.chartBot);
        g.addColorStop(0, GOLD);
        g.addColorStop(1, GOLD_DEEP);
        ctx.fillStyle = g;
        ctx.shadowColor = "rgba(255,182,39,0.55)";
        ctx.shadowBlur = 24;
      } else {
        ctx.fillStyle = d.valor > 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.10)";
        ctx.shadowBlur = 0;
      }
      roundRect(ctx, x, y, bw, h, Math.min(8, bw / 2));
      ctx.fill();
      ctx.shadowBlur = 0;
      // valor em cima da melhor barra
      if (isBest) {
        ctx.font = `900 ${n <= 7 ? 30 : 26}px ${FONT}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = GOLD;
        const lx = Math.min(W - M - 80, Math.max(M + 80, x + bw / 2));
        ctx.fillText(fmtCurto(d.valor), lx, y - 30);
      }
      // rótulos: todos até 14 dias; acima disso, a cada ~5 + o último
      const show = n <= 14 || i === 0 || i === n - 1 || i % 5 === 0;
      if (show) {
        ctx.font = `${isBest ? 800 : 600} ${n <= 7 ? 26 : 20}px ${FONT}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillStyle = isBest ? GOLD : MUTED;
        ctx.fillText(d.label, x + bw / 2, labelY);
      }
    });
  }

  // ===== GRADE DE NÚMEROS (só o que tem valor) =====
  {
    type Cell = { k: string; v: string; sub?: string };
    const cells: Cell[] = [];
    cells.push({ k: "DIAS NA RUA", v: String(s.diasTrabalhados), sub: `de ${s.dias.length}` });
    if (s.melhorDia && s.melhorDia.valor > 0) cells.push({ k: "MELHOR DIA", v: fmtCurto(s.melhorDia.valor), sub: s.melhorDia.label });
    if (s.horasMin > 0) cells.push({ k: "HORAS", v: fmtHorasCurto(s.horasMin) });
    if (s.vendas > 0) cells.push({ k: "VENDAS", v: String(s.vendas) });
    if (s.ticketMedio > 0) cells.push({ k: "TICKET MÉDIO", v: fmtCurto(s.ticketMedio) });
    if (typeof s.caiuPct === "number" && s.caiuPct > 0) cells.push({ k: "CAIU NO BOLSO", v: `${Math.round(s.caiuPct)}%` });
    const use = cells.slice(0, 6);
    const cols = use.length >= 3 ? 3 : Math.max(1, use.length);
    const rows = Math.ceil(use.length / cols);
    const colW = CW / cols;
    const rowH = story ? 190 : 142;
    // Com uma linha só, desce a grade um pouco pra equilibrar o espaço até o rodapé
    const gridY = rows === 1 ? Y.grid + (story ? 90 : 70) : Y.grid;
    hline(gridY);
    use.forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = M + colW * col + colW / 2;
      const cy = gridY + rowH * row;
      spaced(c.k, cx, cy + 40, 22, MUTED, "center", 700);
      text(c.v, cx, cy + (c.sub ? 92 : 100), story ? 72 : 62, WHITE, "center", 900, colW - 24);
      if (c.sub) {
        ctx.font = `600 22px ${FONT}`; ctx.textAlign = "center"; ctx.fillStyle = MUTED;
        ctx.fillText(c.sub, cx, cy + 136);
      }
      if (col > 0) {
        ctx.strokeStyle = LINE; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(M + colW * col, cy + 18); ctx.lineTo(M + colW * col, cy + rowH - 10); ctx.stroke();
      }
      if (row > 0 && col === 0) hline(cy);
    });
    hline(gridY + rowH * rows);
  }

  // ===== RODAPÉ =====
  drawWordmark(W / 2, Y.footer, 170);
  spaced("MEU CORRE NO ORBIS", W / 2, Y.footer + 52, 20, MUTED, "center", 700);

  return canvas;
}
