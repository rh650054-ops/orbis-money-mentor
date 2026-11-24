/* Ficha: foto (toque pra trocar) e nome do produto. */
import { ChevronLeft } from "lucide-react";
import { FotoPicker } from "./foto-produto";
import { emojiDoNome } from "../lib/conta";

export function FichaCabecalho({ nome, foto, emoji, enviandoFoto, onNome, onFoto, onRemoverFoto, onVoltar }: {
  nome: string; foto: string | null; emoji: string; enviandoFoto: boolean;
  onNome: (n: string, emoji: string) => void; onFoto: (f: File) => void; onRemoverFoto: () => void; onVoltar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={onVoltar} aria-label="Voltar" className="-ml-1 p-1" style={{ color: "#7b766e" }}><ChevronLeft className="w-6 h-6" /></button>
        <h1 className="text-xl font-black">Ficha do produto</h1>
      </div>
      <div className="flex gap-3 items-center">
        <FotoPicker foto={foto} emoji={emoji} enviando={enviandoFoto} onEscolher={onFoto} onRemover={onRemoverFoto} />
        <input value={nome} onChange={(e) => onNome(e.target.value, emojiDoNome(e.target.value))} maxLength={60}
          className="flex-1 min-w-0 h-14 rounded-2xl px-4 text-lg font-extrabold outline-none bg-[#0f0d08]"
          style={{ border: "1.5px solid #3a3833" }} aria-label="Nome do produto" />
      </div>
    </div>
  );
}
