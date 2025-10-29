import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, CreditCard, QrCode } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TrialExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrialExpiredModal({ isOpen, onClose }: TrialExpiredModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'stripe' | null>(null);
  const navigate = useNavigate();

  const handleActivatePlan = () => {
    // Will redirect to Stripe payment page
    navigate('/payment');
  };

  const handleLogout = () => {
    onClose();
    navigate('/auth');
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            🚫 Seu teste gratuito terminou
          </DialogTitle>
          <DialogDescription className="text-center text-base mt-2">
            Continue dominando seus números com o plano Visionário
          </DialogDescription>
        </DialogHeader>

        <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                R$ 19,90
                <span className="text-base font-normal text-muted-foreground">/mês</span>
              </div>
              <p className="text-sm text-muted-foreground">Plano Visionário</p>
            </div>

            <div className="space-y-3 pt-4">
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">Relatórios automáticos e insights personalizados</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">IA avançada para análise de vendas</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">Rotina e checklist diário</span>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm">Acesso completo a todas as funcionalidades</span>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-3 mt-6">
          <Button 
            onClick={handleActivatePlan}
            className="w-full h-12 text-base"
            size="lg"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            🔑 Ativar agora
          </Button>

          <Button 
            onClick={handleLogout}
            variant="ghost"
            className="w-full"
          >
            Voltar ao login
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
