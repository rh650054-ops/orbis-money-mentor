import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface CardRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CardRegistrationModal({ isOpen, onClose }: CardRegistrationModalProps) {
  const navigate = useNavigate();

  const handleRegisterCard = () => {
    onClose();
    navigate('/payment');
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            💳 Deseja cadastrar seu cartão agora?
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-4">
            O cartão <strong>não será cobrado</strong> durante o teste. Após 3 dias de teste, você pode confirmar sua assinatura por <strong>R$19,90/mês</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-6">
          <Button 
            onClick={handleRegisterCard}
            className="w-full h-12 text-base"
            size="lg"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            ✅ Cadastrar cartão
          </Button>

          <Button 
            onClick={handleSkip}
            variant="ghost"
            className="w-full"
          >
            ❌ Continuar sem cartão
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Você pode cadastrar seu cartão a qualquer momento nas configurações.
        </p>
      </DialogContent>
    </Dialog>
  );
}
