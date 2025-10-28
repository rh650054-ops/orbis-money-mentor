import { useEffect, useState } from "react";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, Target, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

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
  const { toast } = useToast();
  const [insights, setInsights] = useState<InsightWithIcon[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadInsights();
  }, []);

  const loadInsights = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("generate-insights");

      if (error) {
        console.error("Edge function error:", error);
        throw error;
      }

      if (data.error) {
        console.error("AI error response:", data.error);
        toast({
          title: "Erro ao gerar insights",
          description: data.error,
          variant: "destructive",
        });
        setInsights([]);
        return;
      }

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
    } catch (error) {
      console.error("Error loading insights:", error);
      toast({
        title: "Erro ao carregar insights",
        description: "Não foi possível gerar insights. Verifique sua conexão e tente novamente.",
        variant: "destructive",
      });
      setInsights([]);
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
