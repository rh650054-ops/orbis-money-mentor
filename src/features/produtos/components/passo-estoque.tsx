/* Passo 5 — "Quantos você tem agora?" (pode dizer que não controla estoque). */
import { reais } from "./campos";
import { Contador } from "./campos";
import { BotaoOuro, LinkCinza, QuizCasca } from "./quiz-casca";

export function PassoEstoque({ nome, estoque, custo, pacote, salvando, total, onEstoque, onSalvar, onSemEstoque, onVoltar }: {
  nome: string; estoque: number; custo: number; pacote: number | null; salvando: boolean; total: number;
  onEstoque: (n: number) => void; onSalvar: () => void; onSemEstoque: () => void; onVoltar: () => void;
}) {
  return (
    <QuizCasca passo={5} total={total} onVoltar={onVoltar}
      titulo={`Quantos ${nome} você tem agora?`}
      sub="Conta o que está em casa e no isopor. A cada venda no Foco, a VANT desconta sozinha."
      rodape={<>
        <BotaoOuro onClick={onSalvar} disabled={salvando}>{salvando ? "SALVANDO…" : "SALVAR PRODUTO"}</BotaoOuro>
        <LinkCinza onClick={onSemEstoque}>não controlo estoque desse produto</LinkCinza>
      </>}>
      <div className="mt-4">
        <Contador valor={estoque} onChange={onEstoque} grande unidade="unidades" />
      </div>
      {pacote && pacote > 1 && (
        <div className="flex gap-2 justify-center">
          {[1, 2].map((n) => (
            <button key={n} type="button" onClick={() => onEstoque(estoque + pacote * n)} className="rounded-full px-3.5 py-2 text-[12.5px] font-extrabold"
              style={{ background: "#121211", border: "1px solid #26241f" }}>
              + {n} {n === 1 ? "pacote" : "pacotes"} ({pacote * n})
            </button>
          ))}
        </div>
      )}
      {custo > 0 && estoque > 0 && (
        <div className="rounded-2xl px-3.5 py-3 flex justify-between items-center mt-1.5" style={{ background: "#0f0f10", border: "1px solid #26241f" }}>
          <span className="text-[12.5px] font-bold" style={{ color: "#b9b3a6" }}>Você tem em mercadoria</span>
          <span className="text-[17px] font-black">{reais(custo * estoque)}</span>
        </div>
      )}
    </QuizCasca>
  );
}
