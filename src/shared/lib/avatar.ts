// Miniaturas de avatar via transformacao de imagem do Supabase (recurso do plano Pro).
//
// O banco SEMPRE guarda a URL original do Storage — a miniatura e montada aqui,
// na hora de exibir. Se um dia voltar ao plano Free (sem transformacao de imagem),
// basta mudar TRANSFORMS_ENABLED para false: tudo volta a usar a URL original
// e NADA quebra.
const TRANSFORMS_ENABLED = true;

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
