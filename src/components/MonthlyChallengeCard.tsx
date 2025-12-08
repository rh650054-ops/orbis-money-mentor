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
    <Card className={`glass border-2 ${getLevelBorderColor(currentLevel.nivel)} transition-all overflow-hidden`}>
      {/* Header com nível destacado */}
      <div className={`bg-gradient-to-r ${getLevelColor(currentLevel.nivel)} p-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl">
              {getLevelEmoji(currentLevel.nivel)}
            </div>
            <div className="text-white">
              <p className="text-sm opacity-90">Seu nível atual</p>
              <h3 className="text-2xl font-bold">{currentLevel.nivel}</h3>
            </div>
          </div>
          <div className="text-right text-white">
            <p className="text-sm opacity-90">XP Total</p>
            <p className="text-2xl font-bold flex items-center gap-1">
              <Zap className="w-5 h-5 text-yellow-300" />
              {challenge.xp_total}
            </p>
          </div>
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Progresso atual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1">
              <Target className="w-4 h-4" />
              Dias trabalhados este mês
            </span>
            <span className="font-bold text-lg">{challenge.progresso_atual} / {challenge.meta_progresso}</span>
          </div>
          <Progress 
            value={(challenge.progresso_atual / challenge.meta_progresso) * 100} 
            className="h-3"
          />
        </div>

        {/* Próximo nível */}
        {nextLevel && (
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-muted">
            <div className="flex items-center gap-2">
              <span className="text-xl">{getLevelEmoji(nextLevel.nivel)}</span>
              <div>
                <p className="text-xs text-muted-foreground">Próximo nível</p>
                <p className="font-semibold">{nextLevel.nivel}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Faltam</p>
              <p className="font-bold text-primary">{nextLevel.dias_necessarios - challenge.progresso_atual} dias</p>
            </div>
          </div>
        )}

        {/* Barra de níveis visual */}
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-3">Progressão de níveis:</p>
          <div className="flex items-center justify-between gap-1">
            {levels.slice(1).map((level, index) => {
              const isAchieved = challenge.progresso_atual >= level.dias_necessarios;
              const isCurrent = currentLevel.nivel === level.nivel;
              
              return (
                <div 
                  key={level.nivel} 
                  className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-all ${
                    isCurrent 
                      ? `bg-gradient-to-b ${getLevelColor(level.nivel)} text-white scale-105 shadow-lg` 
                      : isAchieved 
                        ? 'bg-muted/50' 
                        : 'bg-muted/20 opacity-50'
                  }`}
                >
                  <span className={`text-lg ${isCurrent ? 'animate-pulse' : ''}`}>
                    {getLevelEmoji(level.nivel)}
                  </span>
                  <span className={`text-[10px] font-medium ${isCurrent ? 'text-white' : 'text-muted-foreground'}`}>
                    {level.dias_necessarios}d
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mensagem motivacional */}
        <p className="text-xs text-center text-muted-foreground italic pt-2 border-t border-muted">
          {challenge.progresso_atual === 0 
            ? "🚀 Comece seu desafio trabalhando no primeiro dia!"
            : challenge.progresso_atual >= 30
              ? "👑 Você é Lendário! Desafio completo!"
              : `💪 Continue assim! Você está no caminho certo.`
          }
        </p>
      </CardContent>
    </Card>
  );
}
