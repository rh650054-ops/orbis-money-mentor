import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { CreditCard } from "lucide-react";
import { getCheckoutUrl } from "@/shared/lib/checkout";

interface CardRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CardRegistrationModal({ isOpen, onClose }: CardRegistrationModalProps) {
  const handleRegister = () => {
    onClose();
    window.open(getCheckoutUrl(), "_blank");
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            🚀 Garanta seu acesso ao Orbis!
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-4">
            Depois dos 3 dias grátis, é só <strong>R$0,99 por dia</strong> (R$29,90/mês) pra manter tudo: seus números, o mentor de rua (IA) e seu lugar no ranking.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-6">
          <Button 
            onClick={handleRegister}
            className="w-full h-12 text-base"
            size="lg"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            ✅ Assinar agora
          </Button>

          <Button 
            onClick={handleSkip}
            variant="ghost"
            className="w-full"
          >
            Agora não — quero usar meus 3 dias grátis
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Você pode assinar a qualquer momento nas configurações.
        </p>
      </DialogContent>
    </Dialog>
  );
}
