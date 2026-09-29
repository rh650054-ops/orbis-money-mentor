/* ============================================================
   PDF SPLIT — quebra um PDF grande em pedaços menores (no aparelho).

   Por que existe: o leitor de extrato (edge function extrato-analisar) manda o
   arquivo inteiro pra IA numa chamada só. Um extrato de UM mês cabe folgado;
   um extrato de um ANO (dezenas de páginas, milhares de linhas) estoura o limite
   de resposta da IA e a leitura vem truncada ou falha. Então a gente corta o PDF
   em blocos de poucas páginas AQUI, no navegador, e manda um bloco por vez.
   O arquivo original nunca sai do aparelho inteiro — só pedaços, e cada pedaço
   é descartado no servidor depois de lido (fica só o hash).
   ============================================================ */
import { PDFDocument } from "pdf-lib";

export const PAGINAS_POR_PARTE = 4;

export interface PartePdf { file: File; parte: number; total: number }

/** Quantas páginas tem o PDF (0 se não der pra abrir). */
export async function contarPaginasPdf(file: File): Promise<number> {
  try {
    const doc = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
    return doc.getPageCount();
  } catch {
    return 0;
  }
}

/**
 * Divide o PDF em partes de `porParte` páginas. Um PDF de 1 a `porParte` páginas
 * volta como uma parte só (o próprio arquivo, sem reprocessar).
 * Se o PDF não abrir (protegido/corrompido), devolve o arquivo original como
 * parte única — a IA ainda tenta ler.
 */
export async function dividirPdf(file: File, porParte = PAGINAS_POR_PARTE): Promise<PartePdf[]> {
  let origem: PDFDocument;
  try {
    origem = await PDFDocument.load(await file.arrayBuffer(), { ignoreEncryption: true });
  } catch {
    return [{ file, parte: 1, total: 1 }];
  }
  const n = origem.getPageCount();
  if (n <= porParte) return [{ file, parte: 1, total: 1 }];

  const total = Math.ceil(n / porParte);
  const base = file.name.replace(/\.pdf$/i, "");
  const partes: PartePdf[] = [];
  for (let i = 0; i < total; i++) {
    const inicio = i * porParte;
    const idx = Array.from({ length: Math.min(porParte, n - inicio) }, (_, k) => inicio + k);
    const doc = await PDFDocument.create();
    const paginas = await doc.copyPages(origem, idx);
    for (const p of paginas) doc.addPage(p);
    const bytes = await doc.save({ useObjectStreams: true });
    const nome = `${base} (parte ${i + 1} de ${total}).pdf`;
    partes.push({ file: new File([bytes as BlobPart], nome, { type: "application/pdf" }), parte: i + 1, total });
  }
  return partes;
}
