import { Check, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export default function Benefits() {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: "💰",
      title: "Controle Financeiro Completo",
      description: "Acompanhe vendas, lucros, custos e reinvestimentos em tempo real"
    },
    {
      icon: "✅",
      title: "Checklist Inteligente",
      description: "Organize suas atividades diárias com timers e monitoramento de progresso"
    },
    {
      icon: "📅",
      title: "Planejamento Semanal",
      description: "Defina suas metas semanais e mensais com precisão"
    },
    {
      icon: "🤖",
      title: "Relatórios de IA",
      description: "Análises automáticas do seu desempenho e sugestões personalizadas"
    },
    {
      icon: "🔥",
      title: "Ofensiva Visionária",
      description: "Mantenha sua sequência de dias batendo metas e conquiste recompensas"
    },
    {
      icon: "⭐",
      title: "Vision Points",
      description: "Ganhe pontos por conquistas e desbloqueie benefícios exclusivos"
    },
    {
      icon: "🏆",
      title: "Ranking Semanal",
      description: "Compare seu desempenho com outros Visionários"
    },
    {
      icon: "📊",
      title: "Desempenho Diário",
      description: "Visualize gráficos detalhados da sua evolução"
    },
    {
      icon: "💬",
      title: "Suporte Prioritário",
      description: "Atendimento rápido para resolver qualquer dúvida"
    },
    {
      icon: "♾️",
      title: "Acesso Ilimitado",
      description: "Use o Orbis sem restrições, 24/7"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Plano Visionário
          </h1>
          <div className="text-5xl font-bold text-primary mb-2">
            R$ 19,90
            <span className="text-xl font-normal text-muted-foreground">/mês</span>
          </div>
          <p className="text-muted-foreground">
            Desbloqueie todo o potencial do Orbis
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 mb-8">
          {benefits.map((benefit, index) => (
            <Card key={index} className="p-4 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3">
                <div className="text-3xl shrink-0">{benefit.icon}</div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1 flex items-center gap-2">
                    {benefit.title}
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button
            size="lg"
            className="w-full md:w-auto px-12 h-14 text-lg"
            onClick={() => navigate('/payment')}
          >
            🚀 Assinar agora por R$ 19,90/mês
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Cancele quando quiser. Sem compromisso.
          </p>
        </div>
      </div>
    </div>
  );
}
