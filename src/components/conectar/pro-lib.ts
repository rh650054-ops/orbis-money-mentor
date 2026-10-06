/* Preços e benefícios da VANT — fonte única pra paywall, testes e textos (planos de 06/10/2026). */
export const PRECO_ESSENCIAL = 29.9;
export const PRECO_BANCO = 12.9;
export const PRECO_MENSAL = 49.9;
export const PRECO_ANUAL = 418.8;
/** R$ 418,80 ÷ 12 = R$ 34,90/mês. 12 × 49,90 = R$ 598,80 → economiza R$ 180. */
export const ECONOMIA_ANUAL = Math.round(PRECO_MENSAL * 12 - PRECO_ANUAL);
/** Essencial + 1 banco = R$ 42,80 — R$ 7,10 abaixo do Pro, que já vem com o banco. */
export const ESSENCIAL_COM_BANCO = Math.round((PRECO_ESSENCIAL + PRECO_BANCO) * 100) / 100;
export const brl = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");

export const SO_PRO: { nome: string; linha: string }[] = [
  { nome: "Selo Verificado", linha: "seu número com prova do banco, no ranking, no X1 e no perfil" },
  { nome: "Pix contado na rua", linha: "vê cair enquanto vende; entra no ranking até 23:59" },
  { nome: "Arena Pro", linha: "X1 e Sala de Competição com prêmios" },
  { nome: "Caça-Sinal", linha: "os melhores pontos pra vender, antes dos outros" },
  { nome: "IA de Ganhos", linha: "a Vant lê seu dia e diz onde, quando e o que vender mais" },
  { nome: "Financeiro Completo", linha: "saldo, cartão, dívidas e guardado, tudo lido do banco" },
  { nome: "Estoque de Produtos", linha: "o que tem, o que acaba e o que mais gira" },
  { nome: "Comprovante de renda", linha: "pra alugar casa e pedir crédito" },
];
