/* Question 6 — review and confirm (22/11, Etapa 2). Everything he answered, what each answer means for
   production, and the stock question (same controls as the old "Quantos você tem agora?" step). */
import type { ReactNode } from "react";
import { lucroDe } from "../lib/conta";
import { situacaoDoCadastro } from "../lib/situacao-cadastro";
import { VANT } from "../lib/visual";
import type { RascunhoProduto } from "../types";
import { Contador, reais } from "./campos";
import { BotaoOuro, LinkCinza, QuizCasca } from "./quiz-casca";

function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5" style={{ borderTop: `1px solid ${VANT.borda}` }}>
      <span className="text-[13px] font-bold shrink-0" style={{ color: VANT.cinza }}>{rotulo}</span>
      <span className="text-[14px] font-extrabold text-right" style={{ color: VANT.texto }}>{children}</span>
    </div>
  );
}

export function PassoRevisao({ r, pacote, salvando, falha, total, onIr, onEstoque, onSalvar, onSemEstoque, onVoltar }: {
  r: RascunhoProduto; pacote: number | null; salvando: boolean; total: number;
  /** last save attempt failed: the draft is intact and a retry never duplicates the product */
  falha?: string | null;
  onIr: (p: "nome" | "origem" | "custo" | "sabores" | "preco") => void;
  onEstoque: (n: number) => void; onSalvar: () => void; onSemEstoque: () => void; onVoltar: () => void;
}) {
  const s = situacaoDoCadastro(r);
  const sobra = !r.precoLivre && r.custo > 0 && r.preco > 0 ? lucroDe(r.preco, r.custo).sobra : null;
  const sabores = r.sabores.filter((x) => x.nome.trim());
  const editar = (p: Parameters<typeof onIr>[0]) => (
    <button type="button" onClick={() => onIr(p)} className="ml-2 text-[12px] font-black underline" style={{ color: VANT.ouro }}>editar</button>
  );
  return (
    <QuizCasca passo={6} total={total} onVoltar={onVoltar} titulo="Confere e salva" sub="Toque em editar pra voltar em qualquer resposta. Nada se perde."
      rodape={<>
        <BotaoOuro onClick={onSalvar} disabled={salvando}>{salvando ? "SALVANDO…" : falha ? "TENTAR DE NOVO" : "SALVAR PRODUTO"}</BotaoOuro>
        <LinkCinza onClick={onSemEstoque}>salvar sem controlar estoque</LinkCinza>
      </>}>
      <div className="rounded-[18px] px-4 py-3" style={{ background: VANT.cartao, border: `1px solid ${s.cor}66` }}>
        <p className="text-[11px] font-black tracking-[.14em]" style={{ color: s.cor }}>{s.titulo.toUpperCase()}</p>
        <p className="text-[13px] font-bold mt-1" style={{ color: "#d6d6d6" }}>{s.texto}</p>
        {s.completar && r.origem === "faz" && (
          <button type="button" onClick={() => onIr("custo")} className="mt-2 text-[12.5px] font-black underline" style={{ color: VANT.ouro }}>Completar receita</button>
        )}
      </div>
      {falha && (
        <div role="alert" className="rounded-[18px] px-4 py-3" style={{ background: "#1a0c0c", border: `1px solid ${VANT.erro}` }}>
          <p className="text-[13px] font-black" style={{ color: VANT.erro }}>Não salvou tudo</p>
          <p className="text-[12.5px] font-bold mt-1" style={{ color: "#d6d6d6" }}>{falha} Seus dados continuam aqui. Tente de novo: o produto não será duplicado.</p>
        </div>
      )}
      <div className="rounded-[18px] px-4 pt-1 pb-1" style={{ background: VANT.cartao, border: `1px solid ${VANT.borda}` }}>
        <Linha rotulo="Produto">{r.emoji} {r.nome}{editar("nome")}</Linha>
        <Linha rotulo="Como consegue">{r.origem === "faz" ? "Eu mesmo produzo" : r.origem === "compra" ? "Compro pronto" : "Configurar depois"}{editar("origem")}</Linha>
        {r.origem !== null && <Linha rotulo={r.origem === "faz" ? "Receita" : "Paga em 1"}>
          {r.origem === "faz" ? (r.receita?.length ? `${r.receita.length} ingrediente${r.receita.length > 1 ? "s" : ""} · rende ${r.rende || "?"}` : "sem receita") : reais(r.custo)}{editar("custo")}
        </Linha>}
        <Linha rotulo="Sabores / versões">{sabores.length ? sabores.map((x) => x.nome.trim()).join(", ") : "um só"}{editar("sabores")}</Linha>
        <Linha rotulo="Vende por">{r.precoLivre ? "preço na hora" : reais(r.preco)}{editar("preco")}</Linha>
        {sobra !== null && <Linha rotulo="Sobra por venda"><span style={{ color: sobra > 0 ? VANT.verde : VANT.erro }}>{reais(sobra)}</span></Linha>}
      </div>
      <p className="text-[13px] font-black mt-1" style={{ color: VANT.texto }}>Quantos você tem agora?</p>
      <Contador valor={r.estoque} onChange={onEstoque} unidade="unidades" />
      {pacote && pacote > 1 && (
        <div className="flex gap-2">
          {[1, 2].map((n) => (
            <button key={n} type="button" onClick={() => onEstoque(r.estoque + pacote * n)} className="rounded-full px-3.5 py-2 text-[12.5px] font-extrabold"
              style={{ background: VANT.cartao, border: `1px solid ${VANT.borda}` }}>
              + {n} {n === 1 ? "pacote" : "pacotes"} ({pacote * n})
            </button>
          ))}
        </div>
      )}
      {r.custo > 0 && r.estoque > 0 && <p className="text-[12.5px] font-bold" style={{ color: VANT.cinza }}>Você tem {reais(r.custo * r.estoque)} em mercadoria.</p>}
    </QuizCasca>
  );
}
