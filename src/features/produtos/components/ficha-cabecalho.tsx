/* Ficha: foto (toque pra trocar) e nome do produto. */
import { useRef } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import { emojiDoNome } from "../lib/conta";

export function FichaCabecalho({ nome, foto, emoji, enviandoFoto, onNome, onFoto, onVoltar }: {
  nome: string; foto: string | null; emoji: string; enviandoFoto: boolean;
  onNome: (n: string, emoji: string) => void; onFoto: (f: File) => void; onVoltar: () => void;
}) {
  const arquivo = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onVoltar} aria-label="Voltar" className="-ml-1 p-1" style={{ color: "#7b766e" }}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-xl font-black">Ficha do produto</h1>
      </div>
      <div className="flex gap-3 items-center">
        <button type="button" onClick={() => arquivo.current?.click()} aria-label="Trocar foto"
          className="w-[74px] h-[74px] rounded-[18px] shrink-0 flex items-center justify-center overflow-hidden text-[26px]"
          style={{ border: "1.5px dashed #3a3833", background: "#0f0f10" }}>
          {enviandoFoto ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#7b766e" }} />
            : foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : emoji}
        </button>
        <input ref={arquivo} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFoto(f); e.target.value = ""; }} />
        <input value={nome} onChange={(e) => onNome(e.target.value, emojiDoNome(e.target.value))} maxLength={60}
          className="flex-1 min-w-0 h-14 rounded-2xl px-4 text-lg font-extrabold outline-none bg-[#0f0d08]"
          style={{ border: "1.5px solid #3a3833" }} aria-label="Nome do produto" />
      </div>
    </div>
  );
}
