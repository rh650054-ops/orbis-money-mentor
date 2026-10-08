/*
 * Reduz uma foto NO CELULAR antes de subir pro Storage (08/10/2026).
 * Fotos de câmera chegam com 4–22 MB; o bucket community-media tinha 31 fotos
 * de ~22 MB cada (694 MB, 60% de todo o armazenamento) e cada abertura baixava
 * o arquivo inteiro. Aqui: lado maior até `maxLado` px, JPEG 82%, mantendo a
 * proporção (diferente de comprimirImagem do avatar, que corta quadrado).
 * Uma foto de 12 MP vira ~200–350 KB. Se não for imagem, ou se o navegador não
 * conseguir ler, devolve o arquivo original — o envio nunca quebra por causa disso.
 */
export async function reduzirImagem(file: File, maxLado = 1600, qualidade = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", qualidade));
    if (!blob || blob.size === 0 || blob.size >= file.size) return file;
    const nome = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nome, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
