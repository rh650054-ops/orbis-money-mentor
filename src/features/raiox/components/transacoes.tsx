/* Transaction rows and the bridge to the action sheet (alterar categoria,
   transferência, tirar do Raio-X, editar nome). */
import { useState } from "react";
import { COR } from "@/components/financas/planejar/ui";
import { dataCurta, type Lancamento } from "@/components/financas/analise/tipos";
import { TransacaoFolha } from "@/components/financas/analise/TransacaoFolha";
import type { LancamentoRX } from "../types";
import { nomeDestinatario } from "../lib/raiox";
import { Linha, reais } from "./pecas";

function paraFolha(l: LancamentoRX, lista: LancamentoRX[]): Lancamento {
  const nome = nomeDestinatario(l);
  return {
    id: l.id, data: l.data, hora: l.hora, nome, original: l.descricao, apelido: null, valor: l.valor,
    categoria: l.categoria, banco: l.banco, recorrente: false, fora_analise: false, confirmado: true,
    mesmo_nome: lista.filter((x) => nomeDestinatario(x) === nome).length,
  };
}

export function ListaTransacoes({ lista, rotulos, vazio = "Nada por aqui." }: {
  lista: LancamentoRX[]; rotulos: Record<string, string>; vazio?: string;
}) {
  const [aberta, setAberta] = useState<Lancamento | null>(null);
  if (lista.length === 0) return <p className="py-4 text-[14px]" style={{ color: COR.sub }}>{vazio}</p>;
  return (
    <>
      <div>
        {lista.slice(0, 300).map((l) => (
          <Linha key={l.id} onClick={() => setAberta(paraFolha(l, lista))} rotulo={`${nomeDestinatario(l)}, ${reais(l.valor)}`}>
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-semibold truncate" style={{ color: COR.texto }}>{nomeDestinatario(l)}</span>
              <span className="text-[16px] font-bold tabular-nums shrink-0" style={{ color: l.tipo === "entrada" ? COR.verde : COR.texto }}>
                {l.tipo === "entrada" ? "+" : ""}{reais(l.valor)}
              </span>
            </span>
            <span className="block mt-0.5 text-[12.5px] truncate" style={{ color: COR.mute }}>
              {dataCurta(l.data)}{l.hora ? ` ${l.hora}` : ""}{l.banco ? ` · ${l.banco}` : ""} · {rotulos[l.categoria] ?? l.categoria}
            </span>
          </Linha>
        ))}
      </div>
      <TransacaoFolha l={aberta} onFechar={() => setAberta(null)} />
    </>
  );
}
