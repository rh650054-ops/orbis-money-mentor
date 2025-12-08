import { useState } from "react";
import { Trophy, Target, Zap, ChevronRight, Play, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useMonthlyChallenge, ChallengeLevel } from "@/hooks/useMonthlyChallenge";

interface MonthlyChallengeCardProps {
  userId: string;
}

const getLevelColor = (nivel: string): string => {
  switch (nivel) {
    case 'Bronze': return 'from-amber-600 to-amber-800';
    case 'Prata': return 'from-slate-400 to-slate-600';
    case 'Ouro': return 'from-yellow-400 to-yellow-600';
    case 'Platina': return 'from-cyan-400 to-cyan-600';
    case 'Lendário': return 'from-purple-500 to-pink-500';
    default: return 'from-gray-500 to-gray-700';
  }
};

const getLevelEmoji = (nivel: string): string => {
  switch (nivel) {
    case 'Bronze': return '🥉';
    case 'Prata': return '🥈';
    case 'Ouro': return '🥇';
    case 'Platina': return '💎';
    case 'Lendário': return '👑';
    default: return '🎯';
  }
};

const getLevelBorderColor = (nivel: string): string => {
  switch (nivel) {
    case 'Bronze': return 'border-amber-600/50';
    case 'Prata': return 'border-slate-400/50';
    case 'Ouro': return 'border-yellow-400/50';
    case 'Platina': return 'border-cyan-400/50';
    case 'Lendário': return 'border-purple-500/50';
    default: return 'border-muted';
  }
};

export function MonthlyChallengeCard({ userId }: MonthlyChallengeCardProps) {
  const {
    challenge,
    loading,
    isCreating,
    levels,
    calculateLevel,
    getNextLevel,
    createChallenge,
  } = useMonthlyChallenge(userId);

  if (loading) {
    return (
      <Card className="glass animate-pulse">
        <CardContent className="p-6 flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Se não há desafio, mostrar botão para criar
  if (!challenge) {
    return (
      <Card className="glass border-dashed border-2 border-primary/30 hover:border-primary/50 transition-colors">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <Target className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Desafio do Mês</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Trabalhe em 20 dias este mês e suba de nível!
              </p>
            </div>
            <Button 
              onClick={createChallenge}
              disabled={isCreating}
              className="w-full"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Iniciar Desafio Mensal
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentLevel = calculateLevel(challenge.progresso_atual);
  const nextLevel = getNextLevel(challenge.progresso_atual);
  const progressToNext = nextLevel
    ? ((challenge.progresso_atual - (currentLevel.dias_necessarios || 0)) / 
       (nextLevel.dias_necessarios - (currentLevel.dias_necessarios || 0))) * 100
    : 100;

  const mesNome = new Date(challenge.data_inicio).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <Card className={`glass border-2 ${getLevelBorderColor(currentLevel.nivel)} transition-all`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">Desafio do Mês</CardTitle>
          </div>
          <Badge 
            className={`bg-gradient-to-r ${getLevelColor(currentLevel.nivel)} text-white border-none`}
          >
            {getLevelEmoji(currentLevel.nivel)} {currentLevel.nivel}
          </Badge>
        </div>
        <CardDescription className="capitalize">{mesNome}</CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progresso atual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Dias trabalhados</span>
            <span className="font-semibold">{challenge.progresso_atual} / {challenge.meta_progresso}</span>
          </div>
          <Progress 
            value={(challenge.progresso_atual / challenge.meta_progresso) * 100} 
            className="h-2"
          />
        </div>

        {/* XP Total */}
        <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            <span className="text-sm font-medium">XP Total</span>
          </div>
          <span className="text-lg font-bold text-primary">{challenge.xp_total}</span>
        </div>

        {/* Próximo nível */}
        {nextLevel && (
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Próximo: <span className="font-medium text-foreground">{nextLevel.nivel}</span>
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {nextLevel.dias_necessarios - challenge.progresso_atual} dias restantes
            </span>
          </div>
        )}

        {/* Níveis disponíveis */}
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-2">Níveis do desafio:</p>
          <div className="flex flex-wrap gap-1">
            {levels.slice(1).map((level) => (
              <Badge 
                key={level.nivel}
                variant={challenge.progresso_atual >= level.dias_necessarios ? "default" : "outline"}
                className={`text-xs ${
                  challenge.progresso_atual >= level.dias_necessarios 
                    ? `bg-gradient-to-r ${getLevelColor(level.nivel)} text-white border-none` 
                    : 'opacity-50'
                }`}
              >
                {getLevelEmoji(level.nivel)} {level.dias_necessarios}d
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
