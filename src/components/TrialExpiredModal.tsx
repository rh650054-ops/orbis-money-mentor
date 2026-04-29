import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, LogOut, RefreshCw, Lock, TrendingUp, Brain, Target, Flame, X, Check, ArrowLeft } from "lucide-react";
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

      await supabase.functions.invoke("check-admin-access");

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("status, grace_until")
        .eq("user_id", user.id)
        .maybeSingle();

      const now = new Date();
      const hasActiveSub = sub && sub.status === "active" && sub.grace_until && now <= new Date(sub.grace_until);

      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_status, is_demo, billing_exempt")
        .eq("user_id", user.id)
        .single();

      const isActive = hasActiveSub || profile?.plan_status === "active" || (profile?.is_demo && profile?.billing_exempt);

      if (isActive) {
        toast({
          title: "✅ Acesso liberado!",
          description: "Seu plano foi ativado com sucesso.",
        });
        window.location.reload();
      } else {
        toast({
          title: "Pagamento não confirmado",
          description: "Aguarde alguns minutos. Se já pagou, em breve será liberado.",
          variant: "destructive",
        });
        onClose();
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="p-0 gap-0 max-w-[420px] w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-hidden border border-primary/30 bg-background rounded-2xl"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Glow decorations */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative overflow-y-auto max-h-[92dvh] px-5 py-6 sm:px-7 sm:py-7">
          {/* Header */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="relative mb-3">
              <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-primary to-[hsl(45_100%_38%)] flex items-center justify-center shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.6)]">
                <Lock className="w-6 h-6 text-primary-foreground" strokeWidth={2.5} />
              </div>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground leading-tight">
              Seu acesso foi pausado
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[300px]">
              Os 3 dias gratuitos acabaram. Continue dominando seus números.
            </p>
          </div>

          {/* What you LOSE */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 mb-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-destructive/90 mb-2.5 flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" />
              Sem assinatura você perde
            </p>
            <ul className="space-y-1.5 text-[13px] text-foreground/80">
              <li className="flex items-start gap-2">
                <span className="text-destructive/70 mt-0.5">•</span>
                <span>Histórico de vendas, blocos e relatórios</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive/70 mt-0.5">•</span>
                <span>IA personalizada e insights diários</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive/70 mt-0.5">•</span>
                <span>Modo DEFCON 4 e ranking entre vendedores</span>
              </li>
            </ul>
          </div>

          {/* What you GET */}
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-5">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2.5 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Continuando no Orbis você
            </p>
            <ul className="space-y-2 text-[13px] text-foreground/90">
              <li className="flex items-start gap-2.5">
                <Target className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Domina seus números</strong> em tempo real</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Brain className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Recebe IA personalizada</strong> pra vender mais</span>
              </li>
              <li className="flex items-start gap-2.5">
                <TrendingUp className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Organiza a rotina</strong> e bate metas com ritmo</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Flame className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span><strong className="text-foreground">Constrói constância</strong> e domina seu futuro</span>
              </li>
            </ul>
          </div>

          {/* Price */}
          <div className="text-center mb-4">
            <div className="inline-flex items-baseline gap-1">
              <span className="text-3xl font-black text-primary leading-none">R$ 19,90</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Cancele quando quiser • Sem multa</p>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Button
              onClick={handleActivatePlan}
              className="w-full h-12 text-sm font-bold bg-gradient-to-r from-primary to-[hsl(45_100%_38%)] hover:opacity-90 text-primary-foreground shadow-[0_8px_20px_-6px_hsl(var(--primary)/0.6)]"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Assinar agora — R$ 19,90/mês
            </Button>

            <Button
              onClick={handleCheckAccess}
              variant="outline"
              className="w-full h-10 text-xs border-border/60 bg-card/50"
              disabled={isChecking}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Verificando..." : "Já paguei, verificar acesso"}
            </Button>

            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full h-9 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-2" />
              Voltar ao app
            </Button>

            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full h-9 text-xs text-muted-foreground/50 hover:text-foreground"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sair
            </Button>
          </div>

          <p className="text-[10px] text-center text-muted-foreground/70 mt-3">
            🔒 Pagamento seguro via Hotmart
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
