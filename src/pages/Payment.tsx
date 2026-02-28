import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CreditCard, Loader2, RefreshCw } from "lucide-react";
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

      if (profile?.is_demo && profile?.billing_exempt) {
        setIsDemo(true);
      }
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
          description: "Seu acesso ainda não foi ativado. Se já pagou, aguarde alguns minutos ou entre em contato.",
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isDemo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Conta Demo</CardTitle>
            <CardDescription className="text-center">
              Esta é uma conta de demonstração com acesso ilimitado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              Você tem acesso completo a todas as funcionalidades do Orbis sem necessidade de pagamento.
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
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold">Ative o Plano Visionário</h1>
          <p className="text-muted-foreground text-lg">
            Continue dominando seus números com o Orbis
          </p>
        </div>

        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="text-center text-3xl">
              R$ 19,90<span className="text-base font-normal text-muted-foreground">/mês</span>
            </CardTitle>
            <CardDescription className="text-center text-base">
              Plano Visionário
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Check className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Relatórios automáticos</p>
                  <p className="text-sm text-muted-foreground">
                    Insights personalizados sobre suas vendas
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">IA personalizada</p>
                  <p className="text-sm text-muted-foreground">
                    Assistente inteligente para otimizar seu negócio
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Rotina e checklist diário</p>
                  <p className="text-sm text-muted-foreground">
                    Organize suas atividades e maximize produtividade
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Check className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Acesso completo</p>
                  <p className="text-sm text-muted-foreground">
                    Todas as funcionalidades sem restrições
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-3">
              <Button
                onClick={handleHotmartCheckout}
                className="w-full h-14 text-lg font-semibold"
                size="lg"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Assinar Orbis
              </Button>

              <Button
                onClick={handleCheckAccess}
                variant="outline"
                className="w-full h-12"
                disabled={isChecking}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isChecking ? "animate-spin" : ""}`} />
                {isChecking ? "Verificando..." : "Já paguei, verificar acesso"}
              </Button>

              <Button
                onClick={() => navigate("/benefits")}
                variant="outline"
                className="w-full h-12"
              >
                Ver todos os benefícios
              </Button>

              <Button
                onClick={() => navigate("/")}
                variant="ghost"
                className="w-full"
              >
                Voltar
              </Button>
            </div>

            <div className="pt-2 space-y-2">
              <p className="text-xs text-center text-muted-foreground">
                ✅ Pagamento 100% seguro via Hotmart
              </p>
              <p className="text-xs text-center text-muted-foreground">
                💳 Aceita cartão de crédito, boleto e PIX
              </p>
              <p className="text-xs text-center text-muted-foreground">
                🔒 Cancele quando quiser, sem multa
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
