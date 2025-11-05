import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

interface NumericKeyboardProps {
  onNumberClick: (num: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

export function NumericKeyboard({ onNumberClick, onDelete, onClear }: NumericKeyboardProps) {
  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "00"];

  return (
    <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
      {numbers.map((num) => (
        <Button
          key={num}
          variant="outline"
          size="lg"
          onClick={() => onNumberClick(num)}
          className="h-16 text-2xl font-bold hover:bg-primary/10 hover:text-primary transition-smooth"
        >
          {num}
        </Button>
      ))}
      <Button
        variant="outline"
        size="lg"
        onClick={onClear}
        className="h-16 text-lg font-semibold hover:bg-destructive/10 hover:text-destructive transition-smooth"
      >
        Limpar
      </Button>
      <Button
        variant="outline"
        size="lg"
        onClick={onDelete}
        className="h-16 hover:bg-destructive/10 hover:text-destructive transition-smooth col-span-2"
      >
        <Delete className="w-6 h-6 mr-2" />
        Apagar
      </Button>
    </div>
  );
}
