import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Target } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Insight {
  id: string;
  type: "success" | "warning" | "info" | "goal";
  icon: React.ElementType;
  title: string;
  description: string;
  impact: string;
}

const insights: Insight[] = [
  {
    id: "1",
    type: "success",
    icon: TrendingUp,
    title: "Vendas em Alta",
    description: "Suas vendas aumentaram 32% comparado à semana passada. Continue assim!",
    impact: "+32%",
  },
  {
    id: "2",
    type: "warning",
    icon: AlertTriangle,
    title: "Gastos com Transporte",
    description: "Você gastou 20% a mais com transporte este mês. Considere otimizar suas rotas.",
    impact: "+20%",
  },
  {
    id: "3",
    type: "info",
    icon: Lightbulb,
    title: "Oportunidade de Economia",
    description: "Reduzindo seus gastos com alimentação em 15%, você pode aumentar seu lucro mensal em R$ 450.",
    impact: "R$ 450",
  },
  {
    id: "4",
    type: "goal",
    icon: Target,
    title: "Caminho para a Meta",
    description: "Mantendo seu ritmo atual, você atingirá sua meta mensal em 3 dias. Está quase lá!",
    impact: "3 dias",
  },
];

export default function Insights() {
  const getTypeColors = (type: Insight["type"]) => {
    switch (type) {
      case "success":
        return {
          bg: "bg-success/10",
          border: "border-success/20",
          icon: "text-success",
          badge: "bg-success/20 text-success",
        };
      case "warning":
        return {
          bg: "bg-warning/10",
          border: "border-warning/20",
          icon: "text-warning",
          badge: "bg-warning/20 text-warning",
        };
      case "info":
        return {
          bg: "bg-secondary/10",
          border: "border-secondary/20",
          icon: "text-secondary",
          badge: "bg-secondary/20 text-secondary",
        };
      case "goal":
        return {
          bg: "bg-primary/10",
          border: "border-primary/20",
          icon: "text-primary",
          badge: "bg-primary/20 text-primary",
        };
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Insights IA</h1>
        <p className="text-muted-foreground mt-1">
          Análises inteligentes para melhorar seus resultados
        </p>
      </div>

      {/* AI Status Card */}
      <Card className="glass card-gradient-border overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-primary opacity-20 blur-3xl rounded-full"></div>
        <CardHeader>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-primary">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <CardTitle>Orbis IA</CardTitle>
              <CardDescription>Seu assistente financeiro inteligente</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Analisando seus dados financeiros em tempo real para fornecer recomendações personalizadas
            e ajudá-lo a alcançar suas metas mais rapidamente.
          </p>
        </CardContent>
      </Card>

      {/* Insights Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {insights.map((insight) => {
          const colors = getTypeColors(insight.type);
          const Icon = insight.icon;
          
          return (
            <Card
              key={insight.id}
              className={`glass border ${colors.border} hover:scale-[1.02] transition-smooth cursor-pointer`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full ${colors.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${colors.icon}`} />
                    </div>
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                  </div>
                  <Badge className={colors.badge}>{insight.impact}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{insight.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Action Card */}
      <Card className="glass border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Quer mais insights personalizados?</h3>
              <p className="text-muted-foreground">
                Continue registrando suas transações e metas. Quanto mais dados você adicionar,
                mais precisas serão as análises da IA Orbis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
