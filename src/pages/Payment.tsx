import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function Payment() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleStripeCheckout = async () => {
    toast({
      title: "Redirecionando para pagamento...",
      description: "Aguarde enquanto preparamos seu checkout seguro.",
    });

    // This will be implemented with actual Stripe integration
    // For now, showing a placeholder
    toast({
      title: "Integração Stripe",
      description: "Configure sua chave do Stripe para processar pagamentos.",
      variant: "destructive",
    });
  };

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
                onClick={handleStripeCheckout}
                className="w-full h-12 text-lg"
                size="lg"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                Pagar com Cartão
              </Button>

              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full"
              >
                Voltar
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Pagamento seguro processado via Stripe. 
              Cancele quando quiser, sem taxas adicionais.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
