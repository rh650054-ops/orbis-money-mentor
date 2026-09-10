/* ============================================================
   DINHEIRO — um jeito só de ler e mostrar valor em real.

   HISTÓRICO (importante, são três acidentes seguidos no mesmo campo):

   1) (09/09) O campo era <input type="number">. No teclado brasileiro a tecla
      do decimal é a VÍRGULA, e o type=number recusa vírgula: o vendedor via
      "12," na tela, o React recebia "" e os botões DINHEIRO / PIX / CARTÃO
      ficavam apagados. Ele não conseguia registrar a venda.

   2) (09/09) O campo de cobrança fazia replace(/\./g, "") achando que todo
      ponto é separador de milhar. Quem digitasse 12.50 gerava um Pix de
      R$ 1.250,00 — cobrança real, mandada no WhatsApp de um cliente real.

   3) (10/09) A saída que escolhi pros dois foi "só dígito, os dois últimos são
      os centavos", igual app de banco. Consertou 1 e 2 e criou o 3: pra
      registrar R$ 20 o vendedor tinha que digitar 2-0-0-0, e enquanto digitava
      via 0,02 → 0,20 → 2,00. O Lucas reclamou no grupo dos fundadores no mesmo
      dia: "esse negócio de colocar as vírgulas ficou ruim, antes era diferente,
      antes você colocava primeiro o valor e se quisesse colocar a vírgula
      mudava depois". Ele está certo. Vendedor de rua vende a R$ 20, R$ 35,
      R$ 15 — o valor redondo é a regra, o centavo é a exceção. Cobrar 4 toques
      pelo caso comum pra facilitar o caso raro é a conta invertida.

   A REGRA DE AGORA — o vendedor digita, o Orbis não atrapalha:

      digitou "20"      → R$ 20,00     (o que ele quis dizer)
      digitou "20,50"   → R$ 20,50     (a vírgula é dele, quando ele quiser)
      digitou "20,"     → R$ 20,00     (meio da digitação já vale — botão aceso)
      digitou "12.50"   → R$ 12,50     (ponto é decimal também: acidente 2 morto)

   Três travas que sustentam isso:

     • O campo é type="text" + inputMode="decimal". NUNCA type="number"
       (acidente 1) e NUNCA inputMode="numeric" — esse mostra teclado de
       telefone, SEM tecla de vírgula: mandar "digite a vírgula" num teclado
       que não tem vírgula é piada de mau gosto.
     • Separador é SEMPRE decimal, nunca milhar. Não existe ambiguidade, então
       o acidente 2 não tem por onde voltar. Quem vende a R$ 1.250 digita 1250.
     • Enquanto ele digita, a tela mostra EXATAMENTE o que ele digitou. Nada de
       reescrever a cada tecla (é isso que faz o cursor pular e o número dançar).
       A arrumada é no blur, quando ele já terminou.
   ============================================================ */

/** teto de segurança: 9 dígitos de real (999.999.999,99) */
const MAX_INTEIRO = 9;

/**
 * Limpa o que ele digitou SEM reescrever: só dígito e UM separador decimal,
 * com no máximo 2 casas depois. É isto que volta pro `value` do input.
 *
 * "20"      → "20"        · "abc20" → "20"
 * "20,"     → "20,"       (mantém a vírgula: ele está no meio da digitação)
 * "20,555"  → "20,55"     (corta a terceira casa em vez de aceitar lixo)
 * "1,2,3"   → "1,23"      (o segundo separador vira dígito colado, não erro)
 */
export function limparDinheiro(bruto: string | null | undefined): string {
  const t = String(bruto ?? "").replace(/[^\d.,]/g, "");
  if (!t) return "";

  // o PRIMEIRO separador que ele digitou é o decimal; os outros são só ruído
  const corte = t.search(/[.,]/);
  if (corte < 0) return t.slice(0, MAX_INTEIRO);

  const inteiro = t.slice(0, corte).replace(/\D/g, "").slice(0, MAX_INTEIRO);
  const sep = t[corte] as string;
  const centavos = t.slice(corte + 1).replace(/\D/g, "").slice(0, 2);
  return `${inteiro}${sep}${centavos}`;
}

/**
 * O número que vale, a partir do que ele digitou.
 * "20" → 20   ·   "20,5" → 20.5   ·   "12.50" → 12.5   ·   "20," → 20   ·   "" → 0
 */
export function reaisDeTexto(texto: string | null | undefined): number {
  const t = limparDinheiro(texto);
  if (!t) return 0;
  const corte = t.search(/[.,]/);
  if (corte < 0) return parseInt(t, 10) || 0;

  const inteiro = parseInt(t.slice(0, corte) || "0", 10) || 0;
  // "20,5" é 20,50 e não 20,05 — a casa que falta é a da direita
  const centavos = parseInt((t.slice(corte + 1) || "0").padEnd(2, "0"), 10) || 0;
  return Math.round(inteiro * 100 + centavos) / 100;
}

/**
 * Um número salvo virando texto pro campo — pra PRÉ-PREENCHER.
 * 20 → "20"   ·   20.5 → "20,50"   ·   0 → "" (deixa o placeholder aparecer)
 *
 * Isto conserta um bug de dinheiro que estava vivo no Cobrador: a tela mandava
 * String(20.5).replace(".", ",") = "20,5" pro campo, que lia só os dígitos
 * ("205") e mostrava R$ 2,05. Cliente devia 20,50 e o Pix saía 2,05.
 */
export function textoDeReais(n: number | null | undefined): string {
  const v = Number(n) || 0;
  if (v <= 0) return "";
  const cent = Math.round(v * 100);
  const inteiro = Math.floor(cent / 100);
  const resto = cent % 100;
  return resto === 0 ? String(inteiro) : `${inteiro},${String(resto).padStart(2, "0")}`;
}

/** Arruma no blur, quando ele já terminou: "20," → "20"  ·  "20,5" → "20,50" */
export const arrumarDinheiro = (texto: string | null | undefined) => textoDeReais(reaisDeTexto(texto));

/* ---------- comparação de dinheiro ----------
   0,1 + 0,2 não dá 0,3 em ponto flutuante. Comparar dois valores com > ou ===
   faz o app inventar um calote de R$ 0,000000000000004 e travar o fechamento
   do dia. Meio centavo é a margem: abaixo disso não existe dinheiro. */

/** true quando a diferença é menor que meio centavo */
export const mesmoValor = (a: number, b: number) => Math.abs((a || 0) - (b || 0)) < 0.005;

/** a diferença que sobra, já zerada quando é só poeira de ponto flutuante */
export function sobra(a: number, b: number): number {
  const d = (a || 0) - (b || 0);
  return Math.abs(d) < 0.005 ? 0 : d;
}

/** o que faltou receber (nunca negativo, nunca poeira) */
export const faltou = (devido: number, recebido: number) => Math.max(0, sobra(devido, recebido));

/** arredonda pro centavo — use antes de gravar qualquer valor no banco */
export const emCentavos = (n: number) => Math.round((n || 0) * 100) / 100;
