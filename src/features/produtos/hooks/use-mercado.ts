/* Estado da tela "Tô no mercado": as linhas da compra, o modo de preço e a
   prévia ao vivo (mesma conta do banco, em lib/mercado). */
import { useMemo, useRef, useState } from "react";
import {
  calcularMercado, emUnidades, itensParaRpc, totaisDasLinhas,
  type BaseMercado, type LinhaMercado, type TipoLinha,
} from "../lib/mercado";
import { custoDosProdutos, ingredientesDaReceita, receitaDaCompra, semReceita } from "../lib/mercado-produto";

export type ModoPreco = "item" | "total";

const VAZIA: BaseMercado = { ingredientes: [], receitas: [], produtos: [] };

export function useMercado(base: BaseMercado | undefined) {
  const b = base ?? VAZIA;
  const seq = useRef(0);
  const [linhas, setLinhas] = useState<LinhaMercado[]>([]);
  const [modo, setModo] = useState<ModoPreco>("item");
  const [total, setTotal] = useState(0);
  // pra qual produto ele está comprando (null = compra solta) e, sem receita, quanto rende
  const [foco, setFoco] = useState<string | null>(null);
  const [unidades, setUnidades] = useState(0);

  // a tela conta pacotes; a conta (igual à do banco) usa a unidade de medida
  const emUn = useMemo(() => linhas.map((l) => emUnidades(l, b)), [linhas, b]);
  const previa = useMemo(() => calcularMercado(emUn, b), [emUn, b]);
  const subtotais = useMemo(() => totaisDasLinhas(emUn, modo === "item", total, b), [emUn, modo, total, b]);
  const totalItens = subtotais.reduce((s, x) => s + x, 0);
  const custos = useMemo(() => custoDosProdutos(emUn, subtotais, previa, b), [emUn, subtotais, previa, b]);
  const primeiraVez = !!foco && semReceita(foco, b);

  const adicionar = (tipo: TipoLinha, id: string | null, nome: string) => {
    setLinhas((ls) => {
      const ja = tipo !== "novo" && ls.find((l) => l.tipo === tipo && l.id === id);
      if (ja) return ls.map((l) => (l === ja ? { ...l, qtd: l.qtd + 1 } : l));
      seq.current += 1;
      return [...ls, { key: `l${seq.current}`, tipo, id, nome, qtd: 1, precoUnit: null, para: [] }];
    });
  };
  /** Escolheu o produto: a receita dele já entra no carrinho, só falta quantidade e preço. */
  const escolherProduto = (pid: string | null) => {
    setFoco(pid); setUnidades(0);
    if (!pid) return;
    setLinhas((ls) => {
      const novas = ingredientesDaReceita(pid, b).filter((i) => !ls.some((l) => l.tipo === "ingrediente" && l.id === i.id));
      const marcadas = ls.map((l) => (l.tipo === "ingrediente" && ingredientesDaReceita(pid, b).some((i) => i.id === l.id) && !l.para.includes(pid)
        ? { ...l, para: [...l.para, pid] } : l));
      return [...marcadas, ...novas.map((i) => {
        seq.current += 1;
        return { key: `l${seq.current}`, tipo: "ingrediente" as const, id: i.id, nome: i.nome, qtd: 0, precoUnit: null, para: [pid] };
      })];
    });
  };
  const mudar = (key: string, patch: Partial<LinhaMercado>) =>
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const tirar = (key: string) => setLinhas((ls) => ls.filter((l) => l.key !== key));

  const temItem = linhas.some((l) => l.qtd > 0);
  const podeConcluir = temItem && previa.pendentes.length === 0;
  const itens = () => itensParaRpc(emUn, modo === "item", b);
  const novaReceita = () => (primeiraVez && foco ? receitaDaCompra(foco, unidades, emUn) : null);
  const totalCompra = modo === "item" ? totalItens : total;

  return {
    linhas, modo, setModo, total, setTotal, previa, subtotais, totalItens, totalCompra, custos,
    foco, escolherProduto, primeiraVez, unidades, setUnidades, novaReceita,
    adicionar, mudar, tirar, temItem, podeConcluir, itens,
  };
}
