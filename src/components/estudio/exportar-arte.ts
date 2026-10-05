/* ============================================================
   Exportar a arte do Estúdio com o QR Pix (05/10/2026).
   Antes: html-to-image fotografava o editor (toPng) e baixava por um link
   data: — no celular isso quebrava: Safari às vezes sai em branco na 1ª
   foto, o app instalado (PWA) ignora "download" de data:, e a foto saía no
   tamanho da TELA, não da arte.
   Agora: desenha direto num canvas no tamanho REAL da arte (1024×1536),
   põe o QR na mesma posição do editor e entrega como arquivo — pela folha
   de compartilhar do celular (salvar na galeria) ou download normal.
   ============================================================ */

export interface QrNaArte {
  /** posição/tamanho em % da LARGURA da arte (igual ao editor) */
  x: number; y: number; tam: number;
  /** o elemento do QR na tela (SVG gerado da chave ou <img> do QR enviado) */
  fonte: SVGSVGElement | HTMLImageElement;
  /** padding branco em % da largura da arte (o editor usa 3%) */
  padding: number;
  /** raio da borda em px de TELA, convertido pra escala da arte */
  raioTela: number;
  /** largura da arte na TELA, pra converter o raio */
  larguraTela: number;
}

function carregar(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("imagem_nao_carregou"));
    i.src = src;
  });
}

async function fonteDoQr(el: SVGSVGElement | HTMLImageElement): Promise<HTMLImageElement> {
  if (el instanceof HTMLImageElement) return carregar(el.src);
  const clone = el.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  // o editor dimensiona o SVG por CSS; aqui ele precisa de tamanho próprio
  clone.setAttribute("width", "1000");
  clone.setAttribute("height", "1000");
  const xml = new XMLSerializer().serializeToString(clone);
  return carregar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
}

/** Desenha arte + QR no tamanho real e devolve PNG em data URL. */
export async function comporArte(arteSrc: string, qr: QrNaArte): Promise<string> {
  const arte = await carregar(arteSrc);
  const W = arte.naturalWidth, H = arte.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("sem_canvas");
  ctx.drawImage(arte, 0, 0, W, H);

  // Caixa branca: largura = tam% da arte (box-sizing border-box, como no editor),
  // padding = padding% da largura da ARTE (porcentagem de padding no CSS é sempre
  // relativa à largura do pai).
  const caixa = (qr.tam / 100) * W;
  const pad = (qr.padding / 100) * W;
  const lado = Math.max(1, caixa - 2 * pad);
  const x = (qr.x / 100) * W;
  const y = (qr.y / 100) * H;
  const raio = qr.raioTela * (W / Math.max(1, qr.larguraTela));

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.35)";
  ctx.shadowBlur = 10 * (W / Math.max(1, qr.larguraTela));
  ctx.shadowOffsetY = 2 * (W / Math.max(1, qr.larguraTela));
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  // roundRect só existe do Safari 16 / Chrome 99 pra cá; aparelho antigo leva canto reto
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, caixa, lado + 2 * pad, raio);
  else ctx.rect(x, y, caixa, lado + 2 * pad);
  ctx.fill();
  ctx.restore();

  const img = await fonteDoQr(qr.fonte);
  // QR precisa de pixel nítido pra escanear na gráfica
  ctx.imageSmoothingEnabled = false;
  const altura = qr.fonte instanceof HTMLImageElement && img.naturalWidth
    ? lado * (img.naturalHeight / img.naturalWidth)
    : lado;
  ctx.drawImage(img, x + pad, y + pad, lado, altura);
  ctx.imageSmoothingEnabled = true;

  return c.toDataURL("image/png");
}

/** Entrega o PNG: folha de compartilhar no celular (salvar na galeria) ou download. */
export async function entregarPng(dataUrl: string, nome: string): Promise<"compartilhado" | "baixado" | "cancelado"> {
  const blob = await (await fetch(dataUrl)).blob();
  const arquivo = new File([blob], nome, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const celular = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (celular && nav.share && nav.canShare?.({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo], title: nome });
      return "compartilhado";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "cancelado";
      // outro erro: cai pro download normal
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "baixado";
}
