import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

interface NumericKeyboardProps {
  onNumberClick: (num: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

export default function NumericKeyboard({ onNumberClick, onDelete, onClear }: NumericKeyboardProps) {
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '00'];

  return (
    <div className="grid grid-cols-3 gap-2 p-4 bg-muted/30 rounded-lg">
      {numbers.map((num) => (
        <Button
          key={num}
          type="button"
          variant="outline"
          onClick={() => onNumberClick(num)}
          className="h-14 text-lg font-semibold hover:bg-primary/10 hover:text-primary transition-smooth"
        >
          {num}
        </Button>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={onClear}
        className="h-14 text-sm font-semibold hover:bg-destructive/10 hover:text-destructive transition-smooth"
      >
        Limpar
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onDelete}
        className="h-14 hover:bg-destructive/10 hover:text-destructive transition-smooth col-span-2"
      >
        <Delete className="w-5 h-5" />
      </Button>
    </div>
  );
}
