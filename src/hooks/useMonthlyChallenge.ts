import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getBrazilDate } from "@/lib/dateUtils";

export interface ChallengeLevel {
  nivel: string;
  dias_necessarios: number;
  xp_recompensa: number;
}

export interface MonthlyChallenge {
  id: string;
  user_id: string;
  tipo_desafio: string;
  meta_progresso: number;
  progresso_atual: number;
  status: string;
  data_inicio: string;
  mes_referencia: string;
  nivel_atual: string;
  xp_total: number;
  created_at: string;
  updated_at: string;
}

const CHALLENGE_LEVELS: ChallengeLevel[] = [
  { nivel: 'Iniciante', dias_necessarios: 0, xp_recompensa: 0 },
  { nivel: 'Bronze', dias_necessarios: 10, xp_recompensa: 50 },
  { nivel: 'Prata', dias_necessarios: 15, xp_recompensa: 100 },
  { nivel: 'Ouro', dias_necessarios: 20, xp_recompensa: 200 },
  { nivel: 'Platina', dias_necessarios: 25, xp_recompensa: 350 },
  { nivel: 'Lendário', dias_necessarios: 30, xp_recompensa: 500 },
];

export const useMonthlyChallenge = (userId: string | undefined) => {
  const [challenge, setChallenge] = useState<MonthlyChallenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const getCurrentMonthRef = () => getBrazilDate().substring(0, 7);

  const calculateLevel = (diasTrabalhados: number): ChallengeLevel => {
    let currentLevel = CHALLENGE_LEVELS[0];
    for (const level of CHALLENGE_LEVELS) {
      if (diasTrabalhados >= level.dias_necessarios) {
        currentLevel = level;
      }
    }
    return currentLevel;
  };

  const getNextLevel = (diasTrabalhados: number): ChallengeLevel | null => {
    for (const level of CHALLENGE_LEVELS) {
      if (diasTrabalhados < level.dias_necessarios) {
        return level;
      }
    }
    return null;
  };

  const loadChallenge = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      const mesRef = getCurrentMonthRef();
      
      const { data, error } = await supabase
        .from("monthly_challenges")
        .select("*")
        .eq("user_id", userId)
        .eq("mes_referencia", mesRef)
        .maybeSingle();

      if (error) throw error;
      
      setChallenge(data);
    } catch (error) {
      console.error("Error loading challenge:", error);
    } finally {
      setLoading(false);
    }
  };

  const createChallenge = async () => {
    if (!userId) return null;
    
    setIsCreating(true);
    try {
      const mesRef = getCurrentMonthRef();
      const today = new Date().toISOString().split('T')[0];
      
      const newChallenge = {
        user_id: userId,
        tipo_desafio: 'dias_trabalhados_mes',
        meta_progresso: 20,
        progresso_atual: 0,
        status: 'em_andamento',
        data_inicio: today,
        mes_referencia: mesRef,
        nivel_atual: 'Iniciante',
        xp_total: 0,
      };

      const { data, error } = await supabase
        .from("monthly_challenges")
        .insert(newChallenge)
        .select()
        .single();

      if (error) throw error;

      setChallenge(data);
      toast({
        title: "🎯 Desafio do Mês Criado!",
        description: "Trabalhe em 20 dias este mês para subir de nível!",
      });
      
      return data;
    } catch (error: any) {
      console.error("Error creating challenge:", error);
      if (error.code === '23505') {
        toast({
          title: "Desafio já existe",
          description: "Você já tem um desafio ativo para este mês.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao criar desafio",
          description: "Não foi possível criar o desafio mensal.",
          variant: "destructive",
        });
      }
      return null;
    } finally {
      setIsCreating(false);
    }
  };

  const updateProgress = async (diasTrabalhados: number) => {
    if (!userId || !challenge) return;

    try {
      const level = calculateLevel(diasTrabalhados);
      const totalXp = CHALLENGE_LEVELS
        .filter(l => diasTrabalhados >= l.dias_necessarios)
        .reduce((sum, l) => sum + l.xp_recompensa, 0);

      const { data, error } = await supabase
        .from("monthly_challenges")
        .update({
          progresso_atual: diasTrabalhados,
          nivel_atual: level.nivel,
          xp_total: totalXp,
          status: diasTrabalhados >= 30 ? 'concluido' : 'em_andamento',
        })
        .eq("id", challenge.id)
        .select()
        .single();

      if (error) throw error;

      const previousLevel = challenge.nivel_atual;
      setChallenge(data);

      if (level.nivel !== previousLevel && level.nivel !== 'Iniciante') {
        toast({
          title: `🏆 Nível ${level.nivel} Alcançado!`,
          description: `+${level.xp_recompensa} XP ganhos! Continue assim!`,
        });
      }
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

  useEffect(() => {
    loadChallenge();
  }, [userId]);

  return {
    challenge,
    loading,
    isCreating,
    levels: CHALLENGE_LEVELS,
    calculateLevel,
    getNextLevel,
    createChallenge,
    updateProgress,
    refreshChallenge: loadChallenge,
  };
};
