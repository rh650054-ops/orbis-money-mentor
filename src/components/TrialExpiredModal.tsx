import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Info, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import StripeCheckoutModal from "./StripeCheckoutModal";

interface TrialExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrialExpiredModal({ isOpen, onClose }: TrialExpiredModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showCheckout, setShowCheckout] = useState(false);
  const [clientSecret, setClientSecret] = useState<string>("");
  const [paymentLink, setPaymentLink] = useState<string>("");

  const handleActivatePlan = async () => {
    try {
      toast({
        title: "Preparando pagamento...",
        description: "Aguarde enquanto configuramos seu checkout.",
      });

      // Forçar refresh do token
      const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
      
      if (sessionError || !sessionData?.session?.access_token) {
        throw new Error("Sua sessão expirou. Por favor, faça login novamente.");
      }

      const { data, error } = await supabase.functions.invoke("create-checkout", {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (error) {
        throw new Error(error.message || "Erro ao conectar com o servidor");
      }

      if (!data?.clientSecret) {
        throw new Error("Client secret não recebido do servidor");
      }

      setClientSecret(data.clientSecret);
      setPaymentLink(data.paymentLink || "");
      setShowCheckout(true);
    } catch (error: any) {
      toast({
        title: "Erro ao processar pagamento",
        description: error?.message || "Não foi possível iniciar o checkout. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleViewBenefits = () => {
    navigate("/benefits");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]" onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-2xl">⚠️ Seu teste gratuito acabou!</DialogTitle>
            <DialogDescription>
              Assine o plano Visionário para continuar usando o Orbis
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Plano Visionário</h3>
                  <p className="text-2xl font-bold text-primary">R$ 19,90<span className="text-sm font-normal">/mês</span></p>
                </div>
              </div>
              
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  ✅ Relatórios automáticos personalizados
                </li>
                <li className="flex items-center gap-2">
                  ✅ IA personalizada para seu negócio
                </li>
                <li className="flex items-center gap-2">
                  ✅ Rotina e checklist diário inteligente
                </li>
                <li className="flex items-center gap-2">
                  ✅ Acesso completo sem restrições
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleActivatePlan}
                className="w-full h-12 text-base font-semibold"
                size="lg"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Assinar por R$19,90/mês
              </Button>

              <Button
                onClick={handleViewBenefits}
                variant="outline"
                className="w-full"
              >
                <Info className="w-4 h-4 mr-2" />
                Ver todos os benefícios
              </Button>

              <Button
                onClick={handleLogout}
                variant="ghost"
                className="w-full text-muted-foreground"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Fazer logout
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showCheckout && clientSecret && (
        <StripeCheckoutModal
          isOpen={showCheckout}
          onClose={() => setShowCheckout(false)}
          clientSecret={clientSecret}
          paymentLink={paymentLink}
        />
      )}
    </>
  );
}
