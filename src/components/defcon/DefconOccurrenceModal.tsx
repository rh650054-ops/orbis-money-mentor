import { useState } from "react";
import { X } from "lucide-react";

interface DefconOccurrenceModalProps {
  onSave: (description: string) => void;
  onClose: () => void;
}

const SUGGESTED_CHIPS = [
  "Cliente grosseiro",
  "Abordagem ignorada",
  "Perdeu venda no preço",
  "Calote tentado",
  "Chuva/clima ruim",
  "Ponto fraco de movimento",
];

export function DefconOccurrenceModal({ onSave, onClose }: DefconOccurrenceModalProps) {
  const [text, setText] = useState("");

  const handleChip = (chip: string) => {
    setText((prev) => (prev ? `${prev}, ${chip}` : chip));
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-end justify-center z-50">
      <div className="w-full max-w-md bg-neutral-900 rounded-t-3xl p-6 pb-10 space-y-5 animate-in slide-in-from-bottom duration-200">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">📝 Marcar ocorrência</h3>
          <button onClick={onClose}>
            <X className="w-6 h-6 text-neutral-500" />
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChip(chip)}
              className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs font-mono text-neutral-300 active:scale-95 active:bg-neutral-700 transition-all"
            >
              {chip}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Descreva o que aconteceu..."
          rows={3}
          className="w-full bg-black border-2 border-neutral-700 rounded-xl p-4 text-sm text-white font-mono focus:outline-none focus:border-amber-500 transition-colors placeholder:text-neutral-700 resize-none"
        />

        <button
          onClick={() => {
            if (text.trim()) {
              onSave(text.trim());
            }
          }}
          disabled={!text.trim()}
          className="w-full h-14 bg-amber-600 text-white font-black text-lg rounded-xl disabled:opacity-30 active:scale-95 transition-transform"
        >
          SALVAR OCORRÊNCIA
        </button>
      </div>
    </div>
  );
}
