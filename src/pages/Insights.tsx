import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Target, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Insight {
  type: "success" | "warning" | "info" | "goal";
  title: string;
  description: string;
  impact: string;
}

interface InsightWithIcon extends Insight {
  id: string;
  icon: React.ElementType;
}

export default function Insights() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [insights, setInsights] = useState<InsightWithIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }

    if (user) {
      loadInsights();
    }
  }, [user, authLoading, navigate]);

  const generateLocalInsights = async (): Promise<InsightWithIcon[]> => {
    if (!user) return [];

    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];

    const [salesRes, profileRes] = await Promise.all([
      supabase.from("daily_sales").select("*").eq("user_id", user.id).gte("date", firstDayOfMonth).order("date", { ascending: false }),
      supabase.from("profiles").select("base_daily_goal, monthly_goal, streak_days, vision_points").eq("user_id", user.id).single(),
    ]);

    const sales = salesRes.data || [];
    const profile = profileRes.data;

    const result: InsightWithIcon[] = [];

    if (sales.length === 0) {
      result.push({ id: "i0", type: "info", title: "Registre suas primeiras vendas", description: "Ainda não há dados deste mês. Registre suas vendas diárias para ver insights personalizados sobre seu desempenho.", impact: "Alta prioridade", icon: Lightbulb });
      return result;
    }

    const totalLucro = sales.reduce((s, d) => s + (d.total_profit || 0), 0);
    const totalCalote = sales.reduce((s, d) => s + (d.total_debt || 0), 0);
    const mediaLucro = totalLucro / sales.length;
    const metaMensal = profile?.monthly_goal || 0;
    const metaDiaria = profile?.base_daily_goal || 0;
    const streak = profile?.streak_days || 0;

    // Insight 1: progresso vs meta mensal
    if (metaMensal > 0) {
      const pct = Math.round((totalLucro / metaMensal) * 100);
      const diasNoMes = today.getDate();
      const diasTotais = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const progEsperado = Math.round((diasNoMes / diasTotais) * 100);
      if (pct >= progEsperado + 10) {
        result.push({ id: "i1", type: "success", title: "Acima da meta mensal", description: `Você está em ${pct}% da meta mensal (esperado: ${progEsperado}%). Continue assim para bater a meta com folga!`, impact: "Ótimo", icon: TrendingUp });
      } else if (pct < progEsperado - 10) {
        result.push({ id: "i1", type: "warning", title: "Abaixo do ritmo esperado", description: `Você está em ${pct}% da meta mensal, mas já estamos a ${progEsperado}% do mês. É hora de acelerar o ritmo.`, impact: "Atenção", icon: AlertTriangle });
      } else {
        result.push({ id: "i1", type: "info", title: "No ritmo certo", description: `Você está em ${pct}% da meta mensal. No ritmo atual você deve bater a meta ao fim do mês.`, impact: "Bom", icon: Lightbulb });
      }
    }

    // Insight 2: calotes
    if (totalCalote > 0) {
      const pctCalote = Math.round((totalCalote / (totalLucro + totalCalote)) * 100);
      if (pctCalote > 15) {
        result.push({ id: "i2", type: "warning", title: "Alto índice de calotes", description: `${pctCalote}% das suas vendas resultaram em calote (R$${totalCalote.toFixed(2)}). Revise sua política de crédito e prefira pagamentos à vista ou Pix.`, impact: "Crítico", icon: AlertTriangle });
      } else {
        result.push({ id: "i2", type: "success", title: "Controle de calotes saudável", description: `Apenas ${pctCalote}% de calote esse mês (R$${totalCalote.toFixed(2)}). Bom controle de crédito!`, impact: "Positivo", icon: TrendingUp });
      }
    }

    // Insight 3: consistência
    if (streak >= 7) {
      result.push({ id: "i3", type: "success", title: `${streak} dias consecutivos!`, description: `Você está registrando vendas há ${streak} dias seguidos. Consistência é o segredo para bater metas todos os meses.`, impact: "Excelente", icon: TrendingUp });
    } else if (streak < 3 && sales.length > 3) {
      result.push({ id: "i3", type: "warning", title: "Registros inconsistentes", description: "Você tem dias sem registros. Registre todos os dias — mesmo os ruins — para ter um histórico real do seu negócio.", impact: "Melhorar", icon: AlertTriangle });
    }

    // Insight 4: melhor dia da semana
    const byWeekday: Record<number, number[]> = {};
    for (const d of sales) {
      const dow = new Date(d.date).getDay();
      if (!byWeekday[dow]) byWeekday[dow] = [];
      byWeekday[dow].push(d.total_profit || 0);
    }
    const avgByDay = Object.entries(byWeekday).map(([dow, vals]) => ({ dow: parseInt(dow), avg: vals.reduce((a, b) => a + b, 0) / vals.length }));
    if (avgByDay.length >= 3) {
      const best = avgByDay.sort((a, b) => b.avg - a.avg)[0];
      const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
      result.push({ id: "i4", type: "info", title: `Seu melhor dia: ${days[best.dow]}`, description: `Sua média de vendas às ${days[best.dow]}s é R$${best.avg.toFixed(2)}. Planeje mais abordagens nesse dia para maximizar seus resultados.`, impact: "Estratégia", icon: Target });
    }

    // Insight 5: meta diária
    if (metaDiaria > 0) {
      const diasBatiram = sales.filter(d => (d.total_profit || 0) >= metaDiaria).length;
      const pctDias = Math.round((diasBatiram / sales.length) * 100);
      if (pctDias >= 60) {
        result.push({ id: "i5", type: "success", title: "Meta diária sendo batida", description: `Você bateu a meta diária em ${pctDias}% dos dias esse mês. Continue nesse ritmo!`, impact: "Ótimo", icon: Target });
      } else {
        result.push({ id: "i5", type: "goal", title: "Meta diária abaixo do ideal", description: `Você bateu a meta diária em apenas ${pctDias}% dos dias. Tente bater a meta pelo menos em 60% dos seus dias de trabalho.`, impact: "Objetivo", icon: Target });
      }
    }

    return result;
  };

  const loadInsights = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("generate-insights");

      if (!error && data && !data.error) {
        if (data.message) {
          setMessage(data.message);
          setInsights([]);
        } else if (data.insights) {
          const insightsWithIcons = data.insights.map((insight: Insight, index: number) => ({
            ...insight,
            id: `insight-${index}`,
            icon: getIconForType(insight.type)
          }));
          setInsights(insightsWithIcons);
          setMessage("");
        }
        return;
      }

      // Fallback: generate insights locally from user data
      console.log("AI not available, generating local insights...");
      const localInsights = await generateLocalInsights();
      if (localInsights.length > 0) {
        setInsights(localInsights);
        setMessage("");
      } else {
        setMessage("Registre suas vendas para começar a ver insights personalizados aqui.");
      }
    } catch (error) {
      console.error("Error loading insights:", error);
      try {
        const localInsights = await generateLocalInsights();
        setInsights(localInsights.length > 0 ? localInsights : []);
        if (localInsights.length === 0) {
          setMessage("Registre suas vendas para começar a ver insights personalizados aqui.");
        }
      } catch {
        toast({ title: "Erro ao carregar insights", description: "Verifique sua conexão e tente novamente.", variant: "destructive" });
        setInsights([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const getIconForType = (type: string): React.ElementType => {
    switch (type) {
      case "success": return TrendingUp;
      case "warning": return AlertTriangle;
      case "info": return Lightbulb;
      case "goal": return Target;
      default: return Sparkles;
    }
  };
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

  if (authLoading || !user) {
    return null;
  }

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
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : message ? (
        <Card className="glass border-primary/20">
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">{message}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((insight) => {
            const colors = getTypeColors(insight.type);
            const Icon = insight.icon;
            
            return (
              <Card
                key={insight.id}
                className={`glass border ${colors.border} hover:scale-[1.02] transition-smooth cursor-pointer`}
                onClick={() => navigate(`/chat?insight=${encodeURIComponent(insight.title)}`)}
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
      )}

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
