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
        ? { titulo: "Tudo que você lançou caiu.", apoio: `Caiu ${reais(extra)} a mais do que você lançou.` }
        : { titulo: "Tudo que você lançou caiu.", apoio: "" };
    }
    case "depois":
      return { titulo: "Tudo caiu.", apoio: `${reais(d.depois)} caíram depois e já contam.` };
    case "aguardando": {
      const lento = bancos.map((b) => ({ b, h: demoraDoBanco(b) })).find((x) => x.h);
      return {
        titulo: `Faltam ${f} pra conciliar`,
        apoio: lento ? `Ainda podem cair (o ${lento.b} demora ~${lento.h} h).` : "Ainda podem cair hoje.",
      };
    }
    case "parcial":
      return { titulo: `Faltam ${f} pra conciliar`, apoio: "Confira no relatório do dia." };
    case "nada":
      return { titulo: "Nada caiu na conta", apoio: "Confira se a conta certa está como Trabalho." };
    default:
      return { titulo: "Nenhuma venda lançada", apoio: "Lance no Foco pra comparar com o banco." };
  }
}
