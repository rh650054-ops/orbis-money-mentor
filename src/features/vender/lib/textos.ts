/* What the hero says for each state. Short, one idea per line. */
import { demoraDoBanco } from "@/components/conectar/banco-pix";
import type { Tom } from "@/shared/components/vant-status";
import { formatCurrency } from "@/shared/lib/utils";
import type { DiaConc, Estado } from "../types";
import { aMais, falta } from "./conciliacao";

export const reais = (v: number) => formatCurrency(v).replace(/,00$/, "");

export const TOM_DO_ESTADO: Record<Estado, Tom> = {
  ok: "ok", depois: "info", aguardando: "atencao", parcial: "atencao", nada: "erro", sem_venda: "neutro",
};

export const ROTULO_DO_ESTADO: Record<Estado, string> = {
  ok: "Conferido", depois: "Caiu depois", aguardando: "Em análise", parcial: "Parcial", nada: "Não caiu", sem_venda: "Sem venda",
};

export function mensagem(d: DiaConc, estado: Estado, bancos: (string | null)[]): { titulo: string; apoio: string } {
  const f = reais(falta(d));
  switch (estado) {
    case "ok": {
      const extra = aMais(d);
      return extra >= 1
        ? { titulo: "Tudo que você lançou caiu.", apoio: `Caiu ${reais(extra)} a mais. Esqueceu de lançar alguma venda?` }
        : { titulo: "Tudo que você lançou caiu.", apoio: "Conciliação fechada." };
    }
    case "depois":
      return { titulo: "Tudo caiu.", apoio: `${reais(d.depois)} apareceram depois do fim do dia e já entraram na conta.` };
    case "aguardando": {
      const lento = bancos.map((b) => ({ b, h: demoraDoBanco(b) })).find((x) => x.h);
      return {
        titulo: `Faltam ${f} pra conciliar`,
        apoio: lento ? `Podem cair depois: o ${lento.b} costuma mostrar o Pix umas ${lento.h} h depois.` : "Podem cair depois. A Vant confere sozinha a cada leitura.",
      };
    }
    case "parcial":
      return { titulo: `Faltam ${f} pra conciliar`, apoio: "Confira no relatório do dia: pode ser fiado, venda fora do Pix ou compensação atrasada." };
    case "nada":
      return { titulo: "Nada do que você lançou caiu", apoio: "Pode ser conta marcada como pessoal, banco desconectado ou venda que não foi Pix." };
    default:
      return { titulo: "Nenhuma venda lançada", apoio: "Lance suas vendas no Foco e a Vant compara com o que cai no banco." };
  }
}
