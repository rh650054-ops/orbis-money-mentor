/* Passo 1 — "O que você vende?" (nome, foto opcional, atalhos). */
import { emojiDoNome, SUGESTOES_NOME } from "../lib/conta";
import { BotaoOuro, QuizCasca } from "./quiz-casca";
import { FotoPicker } from "./foto-produto";

export function PassoNome({ nome, foto, enviandoFoto, onNome, onFoto, onRemoverFoto, onContinuar, onVoltar, total }: {
  nome: string; foto: string | null; enviandoFoto: boolean; total: number;
  onNome: (n: string) => void; onFoto: (f: File) => void; onRemoverFoto?: () => void; onContinuar: () => void; onVoltar: () => void;
}) {
  return (
    <QuizCasca passo={1} total={total} onVoltar={onVoltar}
      titulo="O que você vende?" sub="Começa pelo que mais sai. Os outros você cadastra depois."
      rodape={<>
        <p className="text-center text-xs font-bold" style={{ color: "#7b766e" }}>A foto é opcional. Ajuda a achar rápido na hora da venda.</p>
        <BotaoOuro onClick={onContinuar} disabled={nome.trim().length < 2}>CONTINUAR</BotaoOuro>
      </>}>
      <div className="flex gap-3 items-center mt-2">
        <FotoPicker foto={foto} enviando={enviandoFoto} onEscolher={onFoto} onRemover={onRemoverFoto} />
        <input value={nome} onChange={(e) => onNome(e.target.value)} placeholder="Ex.: Mentos" maxLength={60} autoFocus
          className="flex-1 min-w-0 h-14 rounded-2xl px-4 text-lg font-extrabold outline-none bg-[#0f0d08]"
          style={{ border: "1.5px solid #F5B800" }} aria-label="Nome do produto" />
      </div>
      <span className="text-[11px] font-black tracking-[.14em] mt-2.5" style={{ color: "#7b766e" }}>OU TOQUE NUM DESSES</span>
      <div className="flex flex-wrap gap-2">
        {SUGESTOES_NOME.map((s) => (
          <button key={s} type="button" onClick={() => onNome(s)} className="rounded-full px-3.5 py-2 text-[13px] font-extrabold"
            style={{ background: nome === s ? "#1a1305" : "#121211", border: `1px solid ${nome === s ? "#F5B800" : "#26241f"}`, color: "#d8d2c4" }}>
            {emojiDoNome(s)} {s}
          </button>
        ))}
      </div>
    </QuizCasca>
  );
}
