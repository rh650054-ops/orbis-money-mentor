/* 4 · DETALHE DA CATEGORIA — folha alta: total, comparação com o histórico e a
   lista de transações. Tocar numa transação abre as ações dela. */
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { COR, Folha, LinhaValor } from "../planejar/ui";
import { TransacaoFolha } from "./TransacaoFolha";
import { useLancamentos } from "./use-analise";
import { dataCurta, nomeMes, reais, referencia, type Aberta, type Lancamento } from "./tipos";

function Transacao({ l, onAbrir }: { l: Lancamento; onAbrir: () => void }) {
  return (
    <button type="button" onClick={onAbrir}
      className="group w-full text-left flex items-center gap-3 py-3 border-t first:border-t-0 -mx-2 px-2 rounded-[12px] transition-[transform,background-color] duration-[120ms] active:scale-[0.99] active:bg-white/[.05]"
      style={{ borderColor: "rgba(255,255,255,.06)", opacity: l.fora_analise ? 0.5 : 1 }}>
      <span className="flex-1 min-w-0">
        <span className="block text-[15px] font-semibold truncate" style={{ color: COR.texto }}>{l.nome}</span>
        <span className="block text-[12.5px] mt-0.5 truncate" style={{ color: COR.mute }}>
          {dataCurta(l.data)}{l.banco ? ` · ${l.banco}` : ""}{l.fora_analise ? " · fora da análise" : ""}
        </span>
      </span>
      <span className="text-[16px] font-bold tabular-nums shrink-0" style={{ color: COR.texto }}>{reais(l.valor)}</span>
      <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-[120ms] group-active:translate-x-0.5" strokeWidth={2.4} style={{ color: "#5c5850" }} />
    </button>
  );
}

export function CategoriaFolha({ aberta, mes, corrente, dia, onFechar }: {
  aberta: Aberta | null; mes: string; corrente: boolean; dia: number; onFechar: () => void;
}) {
  const [tx, setTx] = useState<Lancamento | null>(null);
  const cat = aberta?.tipo === "categoria" ? aberta.cat : null;
  const lista = useLancamentos(mes, cat?.categoria ?? null, aberta?.tipo === "negocio" ? "corre" : cat ? "pessoal" : null, !!aberta);
  const itens = lista.data ?? [];
  const titulo = cat ? cat.rotulo : "Custos do negócio";
  const total = cat ? cat.total : aberta?.tipo === "negocio" ? aberta.negocio.total : 0;
  const qtd = itens.filter((l) => !l.fora_analise).length;
  const ref = cat ? referencia(cat, corrente) : null;

  return (
    <Folha open={!!aberta} onOpenChange={(o) => { if (!o) onFechar(); }} titulo={titulo}
      subtitulo={`${lista.isLoading ? "…" : qtd} ${qtd === 1 ? "transação" : "transações"} · ${nomeMes(mes)}`} alta>
      <p className="-mt-2 text-[32px] leading-none font-extrabold tabular-nums" style={{ color: COR.texto }}>{reais(total)}</p>

      {cat && (cat.historico > 0 || cat.tem_teto) && (
        <div>
          {cat.tem_teto && <LinhaValor rotulo="Seu teto no mês" valor={reais(cat.normal)} cor={ref?.cor} />}
          {cat.historico > 0 && <LinhaValor rotulo="Média mensal" valor={reais(cat.historico)} />}
          {corrente && cat.esperado > 0 && <LinhaValor rotulo={`Costuma sair até o dia ${dia}`} valor={reais(cat.esperado)} />}
          {cat.passado_mesmo_dia > 0 && <LinhaValor rotulo={corrente ? `Mês passado até o dia ${dia}` : "Mês anterior"} valor={reais(cat.passado_mesmo_dia)} />}
        </div>
      )}
      {aberta?.tipo === "negocio" && (
        <p className="text-[13px] leading-snug -mt-1" style={{ color: COR.sub }}>
          Mercadoria, gelo, embalagem e imposto são custo do seu trabalho: não entram em "gastos do mês".
          {aberta.negocio.media_mensal > 0 ? ` Média mensal: ${reais(aberta.negocio.media_mensal)}.` : ""}
        </p>
      )}

      <div>
        <p className="text-[12px] font-black uppercase tracking-[.14em] mb-1" style={{ color: COR.mute }}>Transações</p>
        {lista.isLoading ? (
          [0, 1, 2].map((i) => <div key={i} className="h-14 my-1.5 rounded-[12px] animate-pulse" style={{ background: "#1A1A1A" }} />)
        ) : itens.length === 0 ? (
          <p className="py-3 text-[14px]" style={{ color: COR.sub }}>
            {cat ? "Os gastos dessa categoria foram lançados à mão: aparecem nos seus custos do dia." : "Nada no banco este mês."}
          </p>
        ) : itens.map((l) => <Transacao key={l.id} l={l} onAbrir={() => setTx(l)} />)}
      </div>

      <TransacaoFolha l={tx} onFechar={() => setTx(null)} />
    </Folha>
  );
}
