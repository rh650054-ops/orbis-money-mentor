import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, TrendingUp, Clock, Target, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface AIInsightsReportProps {
  userId: string;
}

export const AIInsightsReport = ({ userId }: AIInsightsReportProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [insights, setInsights] = useState<any>(null);

  const generateInsights = async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-insights", {
        body: { userId },
      });

      if (error) throw error;

      setInsights(data);
      toast({
        title: "✨ Insights gerados!",
        description: "Análise completa dos seus últimos 7 dias.",
      });
    } catch (error: any) {
      console.error("Error generating insights:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível gerar os insights.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="card-gradient-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Relatório de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!insights ? (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-4">
              Gere um relatório com insights inteligentes sobre seu desempenho
            </p>
            <Button onClick={generateInsights} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {insights.weeklyProjection && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-primary">Projeção Semanal</h4>
                </div>
                <p className="text-sm text-muted-foreground">{insights.weeklyProjection}</p>
              </div>
            )}

            {insights.goalEstimate && (
              <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="h-4 w-4 text-success" />
                  <h4 className="font-semibold text-success">Estimativa de Meta</h4>
                </div>
                <p className="text-sm text-muted-foreground">{insights.goalEstimate}</p>
              </div>
            )}

            {insights.last7DaysAnalysis && (
              <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-secondary" />
                  <h4 className="font-semibold text-secondary">Análise dos Últimos 7 Dias</h4>
                </div>
                <p className="text-sm text-muted-foreground">{insights.last7DaysAnalysis}</p>
              </div>
            )}

            {insights.productiveHours && (
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-warning" />
                  <h4 className="font-semibold text-warning">Horários Mais Produtivos</h4>
                </div>
                <p className="text-sm text-muted-foreground">{insights.productiveHours}</p>
              </div>
            )}

            {insights.improvement && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-primary">Sugestão de Melhoria</h4>
                </div>
                <p className="text-sm text-muted-foreground">{insights.improvement}</p>
              </div>
            )}

            <Button 
              onClick={generateInsights} 
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Atualizar Relatório
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};