import { Check, ArrowLeft, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

export default function Benefits() {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: "💰",
      title: "Controle Financeiro Completo",
      description: "Acompanhe vendas, lucros, custos e reinvestimentos em tempo real com dashboards intuitivos"
    },
    {
      icon: "✅",
      title: "Checklist Inteligente",
      description: "Organize suas atividades diárias com timers, notificações e monitoramento automático de progresso"
    },
    {
      icon: "📅",
      title: "Planejamento Semanal",
      description: "Defina metas semanais e mensais com acompanhamento visual e análise de cumprimento"
    },
    {
      icon: "🤖",
      title: "Relatórios de IA",
      description: "Análises automáticas do seu desempenho com insights personalizados e sugestões estratégicas"
    },
    {
      icon: "🔥",
      title: "Ofensiva Visionária",
      description: "Mantenha sua sequência de dias batendo metas, conquiste badges e desbloqueie recompensas exclusivas"
    },
    {
      icon: "⭐",
      title: "Vision Points",
      description: "Sistema de pontuação gamificado que recompensa suas conquistas e disciplina diária"
    },
    {
      icon: "🏆",
      title: "Ranking Semanal",
      description: "Compare seu desempenho com outros Visionários e suba no ranking competitivo"
    },
    {
      icon: "📊",
      title: "Gráficos Detalhados",
      description: "Visualize sua evolução com gráficos avançados de vendas, lucro e produtividade"
    },
    {
      icon: "💬",
      title: "Suporte Prioritário",
      description: "Atendimento rápido e personalizado via chat para resolver qualquer dúvida"
    },
    {
      icon: "♾️",
      title: "Acesso Ilimitado",
      description: "Use todas as funcionalidades do Orbis sem restrições, disponível 24/7"
    },
    {
      icon: "📱",
      title: "Multi-Plataforma",
      description: "Acesse de qualquer dispositivo: celular, tablet ou computador com sincronização em tempo real"
    },
    {
      icon: "🔔",
      title: "Notificações Inteligentes",
      description: "Receba lembretes personalizados para não perder nenhuma meta ou atividade importante"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full mb-4">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-semibold">Plano Visionário</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            Desbloqueie seu Potencial
          </h1>
          
          <p className="text-lg text-muted-foreground mb-6 max-w-2xl mx-auto">
            Transforme sua jornada de vendas com ferramentas profissionais e inteligência artificial
          </p>

          <div className="inline-flex flex-col items-center gap-2 bg-gradient-to-r from-primary/10 to-primary/5 p-6 rounded-2xl border-2 border-primary/20">
            <div className="text-6xl font-bold text-primary">
              R$ 19,90
            </div>
            <div className="text-sm text-muted-foreground">por mês • cancele quando quiser</div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-12">
          {benefits.map((benefit, index) => (
            <Card 
              key={index} 
              className="p-5 hover:shadow-xl hover:scale-[1.02] transition-all duration-200 border-2 hover:border-primary/20"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="text-4xl">{benefit.icon}</div>
                  <Check className="w-5 h-5 text-primary shrink-0 ml-auto" />
                </div>
                <div>
                  <h3 className="font-bold mb-2 text-lg">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 rounded-2xl p-8 md:p-12 text-center border-2 border-primary/20">
          <h2 className="text-3xl font-bold mb-4">Pronto para começar?</h2>
          <p className="text-muted-foreground mb-6 text-lg">
            Junte-se a centenas de Visionários que já estão dominando seus números
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="w-full sm:w-auto px-12 h-16 text-xl font-bold shadow-lg hover:shadow-xl"
              onClick={() => navigate('/payment')}
            >
              🚀 Assinar por R$ 19,90/mês
            </Button>
            
            <div className="text-sm text-muted-foreground">
              💳 Cartão de crédito ou PIX
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>Sem compromisso</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>Cancele quando quiser</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              <span>Pagamento seguro</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
