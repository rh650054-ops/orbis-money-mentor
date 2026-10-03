/* Preços e benefícios do Vant Pro — fonte única pra paywall, testes e textos. */
export const PRECO_ANUAL = 359.9;
export const PRECO_MENSAL = 49.9;
/** R$ 359,90 ÷ 12 = R$ 29,99/mês. 12 × 49,90 = R$ 598,80 → economiza R$ 238,90. */
export const ECONOMIA_ANUAL = Math.floor(PRECO_MENSAL * 12 - PRECO_ANUAL);

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
