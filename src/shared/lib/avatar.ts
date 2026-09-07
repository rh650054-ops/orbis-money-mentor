// Avatares do ranking / perfil.
//
// O banco SEMPRE guarda a URL original do Storage. A transformacao de imagem do
// Supabase (/render/image/) ficou DESLIGADA: em 07/09/2026 o endpoint passou a
// responder 403 pra todo mundo e o ranking inteiro ficou com foto quebrada.
// Com TRANSFORMS_ENABLED = false tudo usa a URL original (bucket publico) e
// nada depende do plano. Pra compensar, a foto e comprimida NO CELULAR antes de
// subir (comprimirImagem) — assim a URL original ja e pequena.
const TRANSFORMS_ENABLED = false;

const PUBLIC_MARKER = "/storage/v1/object/public/avatars/";
const RENDER_MARKER = "/storage/v1/render/image/public/avatars/";

/**
 * Retorna a URL do avatar redimensionado pelo CDN (quadrado de `size`px).
 * - URLs fora do bucket `avatars` do Supabase passam direto, sem mexer.
 * - Com TRANSFORMS_ENABLED = false, devolve a URL original (fallback seguro).
 */
export function avatarThumb(url: string | null | undefined, size = 96): string | undefined {
  if (!url) return undefined;
  if (!TRANSFORMS_ENABLED) return url;
  if (!url.includes(PUBLIC_MARKER)) return url;
  const base = url.replace(PUBLIC_MARKER, RENDER_MARKER);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}width=${size}&height=${size}&resize=cover&quality=80`;
}

/**
 * So aceita foto de verdade (http/https). Perfis antigos guardavam emoji
 * ("🦅") em avatar_url — isso virava <img src="🦅"> quebrado no ranking.
 */
export function fotoValida(url: string | null | undefined): string | null {
  if (!url) return null;
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : null;
}

/**
 * Comprime a imagem no proprio aparelho: quadrado central, no maximo `max`px,
 * JPEG 85%. Uma foto de 4 MB vira ~60 KB — o ranking abre rapido pra todo mundo.
 * Se o navegador nao conseguir (formato estranho), devolve o arquivo original.
 */
export async function comprimirImagem(file: File, max = 512): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const lado = Math.min(bitmap.width, bitmap.height);
    const out = Math.min(max, lado);
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    const sx = (bitmap.width - lado) / 2;
    const sy = (bitmap.height - lado) / 2;
    ctx.drawImage(bitmap, sx, sy, lado, lado, 0, 0, out, out);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    return blob && blob.size > 0 ? blob : file;
  } catch {
    return file;
  }
}
