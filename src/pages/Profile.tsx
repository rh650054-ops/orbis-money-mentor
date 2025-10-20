import { Crown, Mail, Calendar, TrendingUp, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Profile() {
  const subscriptionFeatures = [
    "Insights ilimitados da IA",
    "Análises avançadas de gastos",
    "Relatórios personalizados",
    "Metas ilimitadas",
    "Suporte prioritário",
    "Exportação de dados",
  ];

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Perfil</h1>
        <p className="text-muted-foreground mt-1">Gerencie sua conta e assinatura</p>
      </div>

      {/* User Info Card */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full bg-gradient-primary flex items-center justify-center text-2xl font-bold shadow-glow-primary">
              U
            </div>
            <div>
              <CardTitle>Usuário Demo</CardTitle>
              <CardDescription>usuario@email.com</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center space-x-3 text-sm text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span>usuario@email.com</span>
          </div>
          <div className="flex items-center space-x-3 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Membro desde Janeiro 2025</span>
          </div>
        </CardContent>
      </Card>

      {/* Subscription Card */}
      <Card className="glass card-gradient-border overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-primary opacity-20 blur-3xl rounded-full"></div>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-primary">
                <Crown className="w-6 h-6" />
              </div>
              <div>
                <CardTitle>Orbis Premium</CardTitle>
                <CardDescription>Plano Mensal</CardDescription>
              </div>
            </div>
            <Badge className="bg-success/20 text-success">7 Dias Grátis</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Aproveite todos os recursos premium do Orbis por apenas:
            </p>
            <div className="flex items-baseline space-x-2">
              <span className="text-4xl font-bold gradient-text">R$ 19,90</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <p className="font-semibold">Recursos incluídos:</p>
            <div className="grid gap-2">
              {subscriptionFeatures.map((feature, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow-primary">
            Iniciar Período Gratuito
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Cancele quando quiser. Sem taxas escondidas.
          </p>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Suas Estatísticas</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">15</p>
              <p className="text-xs text-muted-foreground">Transações</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-secondary">3</p>
              <p className="text-xs text-muted-foreground">Metas Ativas</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-success">12</p>
              <p className="text-xs text-muted-foreground">Insights</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
