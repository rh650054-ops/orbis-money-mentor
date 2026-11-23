/* Question 4 — "Possui outros sabores ou versões?" (22/11, Etapa 2). Who makes the product gets the
   flavour editor (what changes in each flavour; with no base recipe, each flavour has its own).
   Resale / "configurar depois" just names the versions: no recipe is asked. */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { rascunhoDaReceita } from "../lib/receitas";
import { emojiDoSabor, ingredientesEmConflito, novoSabor, type SaborRascunho } from "../lib/sabores";
import { VANT } from "../lib/visual";
import type { RascunhoProduto } from "../types";
import { EditorSabores } from "./editor-sabores";
import { BotaoOuro, QuizCasca } from "./quiz-casca";

const plural = (n: string) => { const s = n.trim().toLowerCase(); return s ? (s.endsWith("s") ? s : `${s}s`) : "unidades"; };

function SoNomes({ sabores, onMudar }: { sabores: SaborRascunho[]; onMudar: (s: SaborRascunho[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {sabores.map((s, i) => (
        <div key={i} className="flex items-center gap-2 rounded-[14px] px-3 h-14" style={{ background: VANT.cartao, border: `1px solid ${VANT.borda}` }}>
          <span className="text-[20px] w-7 text-center">{s.emoji || emojiDoSabor(s.nome)}</span>
          <input value={s.nome} placeholder="Ex.: Morango, 500 ml, Grande" aria-label={`Versão ${i + 1}`} enterKeyHint="next"
            onChange={(e) => onMudar(sabores.map((x, j) => (j === i ? { ...x, nome: e.target.value, emoji: emojiDoSabor(e.target.value) } : x)))}
            className="flex-1 min-w-0 bg-transparent outline-none text-[15px] font-extrabold" style={{ color: VANT.texto }} />
          <button type="button" aria-label="Tirar versão" onClick={() => onMudar(sabores.filter((_, j) => j !== i))} className="w-9 h-9 flex items-center justify-center" style={{ color: VANT.cinza }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => onMudar([...sabores, novoSabor()])} className="flex items-center gap-1 text-[13px] font-black py-1.5 self-start" style={{ color: VANT.ouro }}>
        <Plus className="w-4 h-4" /> adicionar versão
      </button>
    </div>
  );
}

export function PassoSabores({ r, total, onSabores, onContinuar, onVoltar }: {
  r: RascunhoProduto; total: number; onSabores: (s: SaborRascunho[]) => void; onContinuar: () => void; onVoltar: () => void;
}) {
  const [tem, setTem] = useState<boolean | null>(r.sabores.length > 0 ? true : null);
  const faz = r.origem === "faz";
  if (tem !== true) {
    return (
      <QuizCasca passo={4} total={total} onVoltar={onVoltar} titulo={`${r.nome} tem outros sabores ou versões?`}
        sub={faz ? "Morango, maracujá, Nutella… cada um pode ter um ingrediente a mais, ou a receita toda diferente." : "Sabores, tamanhos ou modelos que você vende separado."}
        rodape={null}>
        <div className="flex flex-col gap-3 mt-3">
          <button type="button" onClick={() => { setTem(true); if (r.sabores.length === 0) onSabores([novoSabor(), novoSabor()]); }}
            className="rounded-[20px] px-4 min-h-[72px] text-left text-[17px] font-black" style={{ background: VANT.cartao, border: `1px solid ${VANT.ouro}`, color: VANT.texto }}>
            Sim, tem mais de um
          </button>
          <button type="button" onClick={() => { onSabores([]); onContinuar(); }}
            className="rounded-[20px] px-4 min-h-[72px] text-left text-[17px] font-black" style={{ background: VANT.cartao, border: `1px solid ${VANT.borda}`, color: VANT.texto }}>
            Não, é um só
          </button>
        </div>
      </QuizCasca>
    );
  }
  const nomeados = r.sabores.filter((s) => s.nome.trim()).length;
  const conflitos = faz ? ingredientesEmConflito(rascunhoDaReceita(r.receita ?? []), r.sabores).size : 0;
  return (
    <QuizCasca passo={4} total={total} onVoltar={() => setTem(null)} titulo={faz ? "Sabores" : "Versões"}
      sub={faz ? "Dê o nome e diga o que muda em cada um. Pode deixar ingrediente sem quantidade: fica como rascunho." : "Só os nomes. Estoque e preço são do produto."}
      rodape={<BotaoOuro onClick={onContinuar} disabled={nomeados === 0 || conflitos > 0}>{conflitos > 0 ? "TIRE O INGREDIENTE REPETIDO" : "CONTINUAR"}</BotaoOuro>}>
      {faz
        ? <EditorSabores sabores={r.sabores} base={rascunhoDaReceita(r.receita ?? [])} rende={r.rende} preco={r.precoLivre ? 0 : r.preco}
            nomeProduto={plural(r.nome)} onMudar={onSabores} />
        : <SoNomes sabores={r.sabores} onMudar={onSabores} />}
    </QuizCasca>
  );
}
