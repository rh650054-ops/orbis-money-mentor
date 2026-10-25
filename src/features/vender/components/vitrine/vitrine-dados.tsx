/* Copy for the Pro showcase: benefits (names agreed with Rick, 24/10/2026) and the 3 plans. */
import type { ReactNode } from "react";
import { SeloVerificado } from "@/components/ranking/AvatarRanking";
import { ECONOMIA_ANUAL } from "@/components/conectar/pro-lib";

export const RECURSOS_PRO: { ic: string; nome: string; linha: string }[] = [
  { ic: "🏦", nome: "Vendas Conectadas", linha: "O que caiu, o que está a caminho e o que virou calote." },
  { ic: "💬", nome: "Cobrador da VANT", linha: "A VANT gera o Pix e a cobrança vai pelo seu WhatsApp." },
  { ic: "📅", nome: "Contas em Dia", linha: "Seu aluguel vence dia 10. Você sabe quanto separar hoje." },
  { ic: "📦", nome: "Estoque e Lucro", linha: "Quanto cada produto coloca no seu bolso." },
  { ic: "📍", nome: "Caça-Sinal", linha: "Os melhores pontos pra vender perto de você." },
  { ic: "✨", nome: "VANT IA", linha: "Dicas pra vender mais e o adesivo da sua marca." },
];

export type Plano = "essencial" | "anual" | "mensal";
type Item = [ReactNode, ReactNode];

const PRO: Item[] = [
  ...RECURSOS_PRO.map((r): Item => [r.ic, <><b>{r.nome}:</b> {r.linha}</>]),
  [<SeloVerificado key="s" size={15} />, <><b>Verificado da VANT</b> e <b>X1</b></>],
];
export const PLANOS: Record<Plano, { nome: string; frase: string; preco: string; cor: string; cta: string; rodape: string; itens: Item[]; destaque?: ReactNode }> = {
  essencial: { nome: "Essencial", frase: "Você lança, a VANT organiza.", preco: "R$ 29,90", cor: "#e9e4d8", cta: "COMEÇAR COM O ESSENCIAL", rodape: "Essencial · R$ 29,90/mês · sem banco",
    itens: [["🎯", <><b>Modo Foco:</b> sua meta e o cronômetro do dia</>], ["🏆", <><b>Ranking</b> entre vendedores do Brasil</>], ["📊", <><b>Relatório:</b> quanto vendeu, gastou e sobrou</>], ["👥", <><b>Comunidade</b> no WhatsApp e no app</>]] },
  anual: { nome: "Pro Anual", frase: "O app e o nosso time com você.", preco: "R$ 34,90", cor: "#FFC800", cta: "QUERO O ANUAL COM O TIME VANT", rodape: "Pro Anual · R$ 34,90/mês · R$ 418,80 por ano",
    destaque: <>👥 <b>Só no anual:</b> uma call de 20 min com o time pra deixar tudo pronto e a <b>call de network</b> todo mês com o Rick, o Mohamed e quem está fazendo acontecer.</>,
    itens: [["✨", <><b>Tudo do Pro</b>, com <b>2 bancos</b> e <b>VANT IA sem limite</b></>], ...PRO, ["💰", <><b>R$ {ECONOMIA_ANUAL} a menos</b> que 12 meses do Pro mensal</>]] },
  mensal: { nome: "Pro Mensal", frase: "O banco trabalha pra você.", preco: "R$ 49,90", cor: "#4FB3FF", cta: "QUERO O PRO MENSAL", rodape: "Pro Mensal · R$ 49,90/mês · cancela quando quiser",
    itens: [["✨", <><b>Tudo do Essencial</b>, e:</>], ...PRO, ["↩️", <>1 banco · cancela quando quiser</>]] },
};
