import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";

const HOTMART_CHECKOUT_URL = "https://pay.hotmart.com/N104683123F";

interface CardRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CardRegistrationModal({ isOpen, onClose }: CardRegistrationModalProps) {
  const handleRegister = () => {
    onClose();
    window.open(HOTMART_CHECKOUT_URL, "_blank");
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
            Após o teste gratuito de 3 dias, assine por apenas <strong>R$19,90/mês</strong> para manter acesso completo.
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
            ❌ Continuar no teste gratuito
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Você pode assinar a qualquer momento nas configurações.
        </p>
      </DialogContent>
    </Dialog>
  );
}
