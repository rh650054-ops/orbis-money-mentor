import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { LogOut, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { useState } from "react";

import { PaywallPro } from "@/components/conectar/PaywallPro";

interface TrialExpiredModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function TrialExpiredModal({ isOpen }: TrialExpiredModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);

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
        .maybeSingle();

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
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="p-0 gap-0 max-w-[420px] w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-hidden border border-primary/30 bg-background rounded-2xl [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Glow decorations */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative overflow-y-auto max-h-[92dvh] px-5 py-6 sm:px-7 sm:py-7">
          {/* Header — 03/10/2026 (Rick): o teste de 3 dias acabou e o que se
              assina agora é o Vant Pro. A paywall inteira mora aqui dentro. */}
          <div className="flex flex-col items-center text-center mb-3">
            <p className="font-mono text-[10px] font-bold tracking-[.18em]" style={{ color: "#7b766e" }}>SEUS 3 DIAS ACABARAM</p>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-[320px]">
              Seu histórico, sua ofensiva 🔥 e seu lugar no ranking estão guardados. Assina o Vant Pro e segue de onde parou.
            </p>
          </div>

          <PaywallPro />

          {/* Actions */}
          <div className="space-y-2 mt-3">
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
              onClick={handleLogout}
              variant="ghost"
              className="w-full h-9 text-xs text-muted-foreground/50 hover:text-foreground"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sair
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground/70 mt-3">
            🔒 Pagamento seguro via Hotmart
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
