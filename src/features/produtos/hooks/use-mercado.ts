/* Estado da tela "Tô no mercado": as linhas da compra, o modo de preço e a
   prévia ao vivo (mesma conta do banco, em lib/mercado). */
import { useMemo, useRef, useState } from "react";
import {
  calcularMercado, emUnidades, itensParaRpc, totaisDasLinhas,
  type BaseMercado, type LinhaMercado, type TipoLinha,
} from "../lib/mercado";

export type ModoPreco = "item" | "total";

const VAZIA: BaseMercado = { ingredientes: [], receitas: [], produtos: [] };

export function useMercado(base: BaseMercado | undefined) {
  const b = base ?? VAZIA;
  const seq = useRef(0);
  const [linhas, setLinhas] = useState<LinhaMercado[]>([]);
  const [modo, setModo] = useState<ModoPreco>("item");
  const [total, setTotal] = useState(0);

  // a tela conta pacotes; a conta (igual à do banco) usa a unidade de medida
  const emUn = useMemo(() => linhas.map((l) => emUnidades(l, b)), [linhas, b]);
  const previa = useMemo(() => calcularMercado(emUn, b), [emUn, b]);
  const subtotais = useMemo(() => totaisDasLinhas(emUn, modo === "item", total, b), [emUn, modo, total, b]);
  const totalItens = subtotais.reduce((s, x) => s + x, 0);

  const adicionar = (tipo: TipoLinha, id: string | null, nome: string) => {
    setLinhas((ls) => {
      const ja = tipo !== "novo" && ls.find((l) => l.tipo === tipo && l.id === id);
      if (ja) return ls.map((l) => (l === ja ? { ...l, qtd: l.qtd + 1 } : l));
      seq.current += 1;
      return [...ls, { key: `l${seq.current}`, tipo, id, nome, qtd: 1, precoUnit: null, para: [] }];
    });
  };
  const mudar = (key: string, patch: Partial<LinhaMercado>) =>
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const tirar = (key: string) => setLinhas((ls) => ls.filter((l) => l.key !== key));

  const temItem = linhas.some((l) => l.qtd > 0);
  const podeConcluir = temItem && previa.pendentes.length === 0;
  const itens = () => itensParaRpc(emUn, modo === "item", b);

  return {
    linhas, modo, setModo, total, setTotal, previa, subtotais, totalItens,
    adicionar, mudar, tirar, temItem, podeConcluir, itens,
  };
}
