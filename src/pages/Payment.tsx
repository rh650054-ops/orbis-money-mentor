import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Loader2, RefreshCw, Lock, TrendingUp, Brain, Target, Flame, X, Check, ArrowLeft } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";

const HOTMART_CHECKOUT_URL = "https://pay.hotmart.com/N104683123F";

export default function Payment() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [isDemo, setIsDemo] = useState(false);
  const [checkingDemo, setCheckingDemo] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
      return;
    }

    const checkDemoStatus = async () => {
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_demo, billing_exempt")
        .eq("user_id", user.id)
        .single();

      if (profile?.is_demo && profile?.billing_exempt) setIsDemo(true);
      setCheckingDemo(false);
    };

    checkDemoStatus();
  }, [user, loading, navigate]);

  const handleHotmartCheckout = () => {
    window.open(HOTMART_CHECKOUT_URL, "_blank");
  };

  const handleCheckAccess = async () => {
    if (!user) return;
    setIsChecking(true);

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_status")
        .eq("user_id", user.id)
        .single();

      if (profile?.plan_status === "active") {
        toast({
          title: "✅ Acesso liberado!",
          description: "Seu plano foi ativado. Redirecionando...",
        });
        setTimeout(() => navigate("/"), 1500);
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
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  if (loading || !user || checkingDemo) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isDemo) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-primary/30">
          <CardContent className="p-6 text-center space-y-4">
            <h1 className="text-2xl font-bold">Conta Demo</h1>
            <p className="text-muted-foreground">
              Acesso ilimitado a todas as funcionalidades sem necessidade de pagamento.
            </p>
            <Button onClick={() => navigate("/")} className="w-full">
              Voltar ao Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative min-h-[100dvh] bg-background overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Glow decorations */}
      <div className="absolute -top-32 -right-32 w-72 h-72 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-center min-h-[100dvh] p-4">
        <div className="w-full max-w-[440px] space-y-4">
          {/* Back */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>

          {/* Header */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-3">
              <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-[hsl(45_100%_38%)] flex items-center justify-center shadow-[0_8px_24px_-4px_hsl(var(--primary)/0.6)]">
                <Lock className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground leading-tight">
              Ative o Plano Visionário
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Continue dominando seus números com o Orbis
            </p>
          </div>

          <Card className="border border-primary/30 bg-card/80 backdrop-blur-sm overflow-hidden">
            <CardContent className="p-5 space-y-4">
              {/* What you LOSE */}
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
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
                  <li className="flex items-start gap-2">
                    <span className="text-destructive/70 mt-0.5">•</span>
                    <span>Constância, recompensas e Vision Points</span>
                  </li>
                </ul>
              </div>

              {/* What you GET */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2.5 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  Continuando no Orbis você
                </p>
                <ul className="space-y-2.5 text-[13px] text-foreground/90">
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
              <div className="text-center py-2">
                <div className="inline-flex items-baseline gap-1">
                  <span className="text-4xl font-black text-primary leading-none">R$ 19,90</span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">Cancele quando quiser • Sem multa</p>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <Button
                  onClick={handleHotmartCheckout}
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
                  onClick={() => navigate("/benefits")}
                  variant="ghost"
                  className="w-full h-9 text-xs text-muted-foreground hover:text-foreground"
                >
                  Ver todos os benefícios
                </Button>
              </div>

              <div className="pt-1 space-y-1">
                <p className="text-[10px] text-center text-muted-foreground/70">
                  🔒 Pagamento seguro via Hotmart
                </p>
                <p className="text-[10px] text-center text-muted-foreground/70">
                  💳 Cartão • Boleto • PIX
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
