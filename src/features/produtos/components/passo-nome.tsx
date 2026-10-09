/* Passo 1 — "O que você vende?" (nome, foto opcional, atalhos). */
import { useRef } from "react";
import { Loader2 } from "lucide-react";
import { emojiDoNome, SUGESTOES_NOME } from "../lib/conta";
import { BotaoOuro, QuizCasca } from "./quiz-casca";

export function PassoNome({ nome, foto, enviandoFoto, onNome, onFoto, onContinuar, onVoltar, total }: {
  nome: string; foto: string | null; enviandoFoto: boolean; total: number;
  onNome: (n: string) => void; onFoto: (f: File) => void; onContinuar: () => void; onVoltar: () => void;
}) {
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <QuizCasca passo={1} total={total} onVoltar={onVoltar}
      titulo="O que você vende?" sub="Começa pelo que mais sai. Os outros você cadastra depois."
      rodape={<>
        <p className="text-center text-xs font-bold" style={{ color: "#7b766e" }}>A foto é opcional. Ajuda a achar rápido na hora da venda.</p>
        <BotaoOuro onClick={onContinuar} disabled={nome.trim().length < 2}>CONTINUAR</BotaoOuro>
      </>}>
      <div className="flex gap-3 items-center mt-2">
        <button type="button" onClick={() => arquivo.current?.click()} aria-label="Foto do produto"
          className="w-[74px] h-[74px] rounded-[18px] shrink-0 flex flex-col items-center justify-center gap-0.5 overflow-hidden"
          style={{ border: "1.5px dashed #3a3833", color: "#7b766e" }}>
          {enviandoFoto ? <Loader2 className="w-5 h-5 animate-spin" />
            : foto ? <img src={foto} alt="" className="w-full h-full object-cover" />
            : <><span className="text-[22px]">📷</span><span className="text-[10px] font-extrabold">foto</span></>}
        </button>
        <input ref={arquivo} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFoto(f); e.target.value = ""; }} />
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
