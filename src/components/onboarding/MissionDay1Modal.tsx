import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/ui/dialog";

interface Props {
  onDone: () => void;
}

export default function MissionDay1Modal({ onDone }: Props) {
  const navigate = useNavigate();

  const handleAccept = () => {
    localStorage.setItem("missao_dia1_vista", "true");
    onDone();
    navigate("/daily-goals");
  };

  const handleSkip = () => {
    localStorage.setItem("missao_dia1_vista", "true");
    onDone();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleSkip(); }}>
      <DialogContent className="bg-card border-border max-w-sm rounded-xl text-center">
        <div className="space-y-5">
          <DialogTitle className="text-xl font-bold text-foreground">Sua primeira missão</DialogTitle>
          <DialogDescription className="text-base text-muted-foreground leading-relaxed">
            Hoje você tem um objetivo simples: iniciar o DEFCON 4 e registrar sua primeira venda. Só isso. Não precisa bater meta ainda. Só precisa começar.
          </DialogDescription>
          <button
            onClick={handleAccept}
            className="w-full h-12 rounded-xl font-bold text-primary-foreground bg-primary text-base active:scale-[0.97] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Aceitar a missão →
          </button>
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          >
            Pular
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
