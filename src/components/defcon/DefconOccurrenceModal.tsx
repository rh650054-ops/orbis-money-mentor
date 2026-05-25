import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-card border-border max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">Marcar ocorrência</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChip(chip)}
              className="px-3 h-11 bg-secondary border border-border rounded-lg text-xs font-mono text-foreground active:scale-95 active:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
          aria-label="Descrição da ocorrência"
          className="w-full bg-background border-2 border-border rounded-xl p-4 text-sm text-foreground font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-colors placeholder:text-muted-foreground resize-none"
        />

        <button
          onClick={() => {
            if (text.trim()) {
              onSave(text.trim());
            }
          }}
          disabled={!text.trim()}
          className="w-full h-12 bg-warning text-warning-foreground font-bold text-base rounded-xl disabled:opacity-30 active:scale-95 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Salvar ocorrência
        </button>
      </DialogContent>
    </Dialog>
  );
}
