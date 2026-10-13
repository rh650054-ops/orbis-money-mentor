/**
 * Converte um data URL (base64) em Blob SEM usar fetch().
 * A política de segurança do site (connect-src no vercel.json) não libera `data:`,
 * então `fetch(dataUrl)` é bloqueado no navegador — foi isso que quebrou o
 * "Baixar PNG" do Estúdio e o compartilhar do Ranking desde 14/09/2026.
 */
export function blobDeDataUrl(dataUrl: string): Blob {
  const virgula = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || virgula < 0) throw new Error("data_url_invalido");
  const cabecalho = dataUrl.slice(5, virgula);
  const tipo = cabecalho.split(";")[0] || "application/octet-stream";
  const corpo = dataUrl.slice(virgula + 1);
  if (!cabecalho.includes(";base64")) return new Blob([decodeURIComponent(corpo)], { type: tipo });
  const bin = atob(corpo);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}
