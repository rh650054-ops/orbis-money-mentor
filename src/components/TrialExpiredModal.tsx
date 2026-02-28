import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Info, LogOut, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

const HOTMART_CHECKOUT_URL = "https://pay.hotmart.com/N104683123F";

interface TrialExpiredModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TrialExpiredModal({ isOpen, onClose }: TrialExpiredModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);

  const handleActivatePlan = () => {
    window.open(HOTMART_CHECKOUT_URL, "_blank");
  };

  const handleCheckAccess = async () => {
    setIsChecking(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_status")
        .eq("user_id", user.id)
        .single();

      if (profile?.plan_status === "active") {
        toast({
          title: "✅ Acesso liberado!",
          description: "Seu plano foi ativado com sucesso.",
        });
        window.location.reload();
      } else {
        toast({
          title: "Pagamento não confirmado",
          description: "Seu acesso ainda não foi ativado. Se já pagou, aguarde alguns minutos ou entre em contato.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro ao verificar",
        description: "Não foi possível verificar seu acesso. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
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
              onClick={handleCheckAccess}
              variant="outline"
              className="w-full"
              disabled={isChecking}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Verificando..." : "Já paguei, verificar acesso"}
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
  );
}
