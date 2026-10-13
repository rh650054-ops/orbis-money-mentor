/* Efeito "a IA está digitando": a resposta chega inteira do servidor, mas aparece
   palavra por palavra. Marcadores de imagem ([[adesivo:URL]] / [[foto:URL]]) contam
   como UMA unidade, então nunca aparecem pela metade na tela. */

const MARCADOR = /(\[\[(?:adesivo|foto):https?:\/\/[^\]\s]+\]\])/g;

/** Quebra o texto em unidades reveláveis: palavras (com o espaço que vem depois) e marcadores inteiros. */
export function unidadesDigitacao(texto: string): string[] {
  const out: string[] = [];
  for (const parte of texto.split(MARCADOR)) {
    if (!parte) continue;
    if (/^\[\[(?:adesivo|foto):/.test(parte)) out.push(parte);
    else out.push(...(parte.match(/\s*\S+\s*/g) ?? [parte]));
  }
  return out;
}

/** Quantas unidades mostrar por passo: resposta longa acelera, pra nunca passar de ~`tetoMs`. */
export function passoDigitacao(total: number, intervaloMs = 40, tetoMs = 2600): number {
  return Math.max(1, Math.ceil(total / Math.max(1, Math.floor(tetoMs / intervaloMs))));
}
