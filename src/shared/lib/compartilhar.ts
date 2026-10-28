/* Share / download that works in the store app too (28/10/2026).
   Inside the Android/iOS binary there is no Web Share API and no download manager in the
   WebView: `navigator.share` is undefined and `<a download>` does nothing. There, a file is
   written to the app cache and handed to the native share sheet (WhatsApp, Instagram,
   "Salvar na galeria"…). On the web the behaviour is unchanged: Web Share with files when
   the browser offers it, otherwise a plain download. */
import { Capacitor } from "@capacitor/core";
import { avisar } from "./avisar";

export type ResultadoCompartilhar = "compartilhado" | "baixado" | "cancelado";

const nativo = () => Capacitor.isNativePlatform();

function ehCancelamento(e: unknown): boolean {
  const m = String((e as { message?: string })?.message ?? e ?? "").toLowerCase();
  return (e as { name?: string })?.name === "AbortError" || m.includes("cancel") || m.includes("abort");
}

async function blobParaBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

async function compartilharNativo(blob: Blob, nome: string, titulo?: string, texto?: string): Promise<ResultadoCompartilhar> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const { uri } = await Filesystem.writeFile({ path: nome, data: await blobParaBase64(blob), directory: Directory.Cache });
  try {
    await Share.share({ title: titulo, text: texto, files: [uri], dialogTitle: titulo });
    return "compartilhado";
  } catch (e) {
    if (ehCancelamento(e)) return "cancelado";
    throw e;
  }
}

function baixarNoNavegador(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.rel = "noopener";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Share a file (image, PDF). Web: Web Share with files when available, else download. */
export async function compartilharArquivo(blob: Blob, nome: string, opts: { titulo?: string; texto?: string } = {}): Promise<ResultadoCompartilhar> {
  if (nativo()) return compartilharNativo(blob, nome, opts.titulo, opts.texto);
  const file = new File([blob], nome, { type: blob.type || "application/octet-stream" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try { await nav.share({ files: [file], title: opts.titulo, text: opts.texto }); return "compartilhado"; }
    catch (e) { if (ehCancelamento(e)) return "cancelado"; avisar.silencioso("compartilhar: web share", e); }
  }
  baixarNoNavegador(blob, nome);
  return "baixado";
}

/** "Download": on the web a real download; in the store app the share sheet (the only way to save). */
export async function baixarArquivo(blob: Blob, nome: string, titulo?: string): Promise<ResultadoCompartilhar> {
  if (nativo()) return compartilharNativo(blob, nome, titulo);
  baixarNoNavegador(blob, nome);
  return "baixado";
}

/** Share plain text; falls back to the clipboard where there is no share sheet. */
export async function compartilharTexto(texto: string, titulo?: string): Promise<"compartilhado" | "copiado" | "cancelado"> {
  if (nativo()) {
    const { Share } = await import("@capacitor/share");
    try { await Share.share({ text: texto, title: titulo, dialogTitle: titulo }); return "compartilhado"; }
    catch (e) { if (ehCancelamento(e)) return "cancelado"; avisar.silencioso("compartilhar: nativo", e); }
  } else if (navigator.share) {
    try { await navigator.share({ text: texto, title: titulo }); return "compartilhado"; }
    catch (e) { if (ehCancelamento(e)) return "cancelado"; avisar.silencioso("compartilhar: web share", e); }
  }
  await navigator.clipboard.writeText(texto);
  return "copiado";
}
