import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Clock, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading || !user) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-12">
        <h1 className="text-5xl md:text-6xl font-bold gradient-text animate-fade-in">
          Bem-vindo ao Orbis
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
          O aplicativo definitivo para vendedores visionários dominarem sua rotina e finanças
        </p>
      </div>

      {/* Main Features */}
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Card 
          className="card-gradient-border hover:shadow-glow-primary transition-smooth cursor-pointer group animate-fade-in"
          onClick={() => navigate("/routine")}
        >
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Clock className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold">⚡ Rotina Visionária</h2>
              <p className="text-muted-foreground">
                Configure sua rotina diária e acompanhe suas atividades com cronômetros de foco em tempo real.
              </p>
              <div className="pt-4">
                <Button className="w-full">
                  Acessar Rotina
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card 
          className="card-gradient-border hover:shadow-glow-secondary transition-smooth cursor-pointer group animate-fade-in"
          onClick={() => navigate("/finances")}
          style={{ animationDelay: "100ms" }}
        >
          <CardContent className="p-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-secondary/20 to-secondary/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wallet className="w-10 h-10 text-secondary" />
              </div>
              <h2 className="text-2xl font-bold">💰 Minhas Finanças</h2>
              <p className="text-muted-foreground">
                Controle total do seu dinheiro — quanto ganhou, gastou, reinvestiu e guardou.
              </p>
              <div className="pt-4">
                <Button variant="secondary" className="w-full">
                  Acessar Finanças
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Section */}
      <div className="max-w-3xl mx-auto text-center space-y-6 py-8">
        <div className="p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-lg">
          <h3 className="text-xl font-bold mb-3">🔥 Por que o Orbis é diferente?</h3>
          <div className="grid md:grid-cols-2 gap-4 text-left">
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-semibold text-primary">✓</span> Rotina integrada com cronômetros de foco
              </p>
              <p className="text-sm">
                <span className="font-semibold text-primary">✓</span> Checklist diário automático
              </p>
              <p className="text-sm">
                <span className="font-semibold text-primary">✓</span> Timer de meta de horas trabalhadas
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-semibold text-secondary">✓</span> Controle financeiro completo
              </p>
              <p className="text-sm">
                <span className="font-semibold text-secondary">✓</span> Orçamento mensal inteligente
              </p>
              <p className="text-sm">
                <span className="font-semibold text-secondary">✓</span> Análise de despesas por categoria
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
