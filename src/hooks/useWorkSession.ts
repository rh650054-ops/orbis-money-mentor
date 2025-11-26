import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface HourBlock {
  id: string;
  bloco_index: number;
  horario_inicio: string;
  horario_fim: string;
  ritmo_ideal_hora: number;
  valor_real: number | null;
}

export interface WorkSession {
  id: string;
  user_id: string;
  start_timestamp: string;
  end_timestamp: string | null;
  status: 'active' | 'finished';
  planning_date: string;
  total_vendido: number;
  meta_dia: number;
  ritmo_ideal_inicial: number;
  constancia_dia: boolean;
}

export interface DailyReport {
  total_vendido: number;
  melhor_hora: number;
  pior_hora: number;
  ritmo_medio: number;
  porcentagem_meta: number;
  conselho: string;
}

export const useWorkSession = () => {
  const { user } = useAuth();
  const [session, setSession] = useState<WorkSession | null>(null);
  const [blocks, setBlocks] = useState<HourBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadActiveSession();
    }
  }, [user]);

  const loadActiveSession = async () => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: sessionData, error: sessionError } = await supabase
        .from('work_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('planning_date', today)
        .eq('status', 'active')
        .maybeSingle();

      if (sessionError) throw sessionError;

      if (sessionData) {
        setSession(sessionData as WorkSession);
        await loadBlocks(sessionData.id);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBlocks = async (sessionId: string) => {
    try {
      const { data, error } = await supabase
        .from('hour_blocks_v2')
        .select('*')
        .eq('session_id', sessionId)
        .order('bloco_index');

      if (error) throw error;
      setBlocks(data as HourBlock[]);
    } catch (error) {
      console.error('Error loading blocks:', error);
    }
  };

  const startWorkSession = async (metaDia: number, workHours: number, hourlySchedule: string[]) => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const ritmoIdeal = metaDia / workHours;

      const { data: sessionData, error: sessionError } = await supabase
        .from('work_sessions')
        .insert({
          user_id: user.id,
          start_timestamp: new Date().toISOString(),
          planning_date: today,
          meta_dia: metaDia,
          ritmo_ideal_inicial: ritmoIdeal,
          status: 'active',
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Create hour blocks
      const blocksToInsert = hourlySchedule.map((hour, index) => {
        const [startHour] = hour.split('-');
        const endHour = hourlySchedule[index + 1]?.split('-')[0] || `${parseInt(startHour) + 1}:00`;
        
        return {
          session_id: sessionData.id,
          user_id: user.id,
          bloco_index: index + 1,
          horario_inicio: startHour,
          horario_fim: endHour,
          ritmo_ideal_hora: ritmoIdeal,
        };
      });

      const { error: blocksError } = await supabase
        .from('hour_blocks_v2')
        .insert(blocksToInsert);

      if (blocksError) throw blocksError;

      toast.success('Turno iniciado com sucesso!');
      await loadActiveSession();
    } catch (error) {
      console.error('Error starting session:', error);
      toast.error('Erro ao iniciar turno');
    }
  };

  const updateBlockValue = async (blockId: string, valorReal: number) => {
    if (!session) return;

    try {
      // Update the block
      const { error: updateError } = await supabase
        .from('hour_blocks_v2')
        .update({ valor_real: valorReal })
        .eq('id', blockId);

      if (updateError) throw updateError;

      // Reload blocks
      await loadBlocks(session.id);

      // Recalculate dynamic rhythm
      await recalculateDynamicRhythm(session.id);

      toast.success('Bloco atualizado!');
    } catch (error) {
      console.error('Error updating block:', error);
      toast.error('Erro ao atualizar bloco');
    }
  };

  const recalculateDynamicRhythm = async (sessionId: string) => {
    try {
      // Get all blocks
      const { data: allBlocks, error: blocksError } = await supabase
        .from('hour_blocks_v2')
        .select('*')
        .eq('session_id', sessionId)
        .order('bloco_index');

      if (blocksError) throw blocksError;

      // Calculate total sold so far
      const totalVendido = allBlocks.reduce((sum, block) => {
        return sum + (block.valor_real || 0);
      }, 0);

      // Calculate remaining
      const faltando = session!.meta_dia - totalVendido;

      // Count remaining blocks
      const blocosRestantes = allBlocks.filter(block => block.valor_real === null).length;

      if (blocosRestantes > 0) {
        const novoRitmo = faltando / blocosRestantes;

        // Update remaining blocks with new rhythm
        const updates = allBlocks
          .filter(block => block.valor_real === null)
          .map(block => 
            supabase
              .from('hour_blocks_v2')
              .update({ ritmo_ideal_hora: novoRitmo })
              .eq('id', block.id)
          );

        await Promise.all(updates);
      }

      // Update session total
      await supabase
        .from('work_sessions')
        .update({ total_vendido: totalVendido })
        .eq('id', sessionId);

      // Check if all blocks are filled
      const allFilled = allBlocks.every(block => block.valor_real !== null);
      if (allFilled) {
        await finalizeSession(sessionId, allBlocks);
      }

      // Reload blocks
      await loadBlocks(sessionId);
    } catch (error) {
      console.error('Error recalculating rhythm:', error);
    }
  };

  const finalizeSession = async (sessionId: string, allBlocks: any[]) => {
    try {
      // Calculate totals
      const totalVendido = allBlocks.reduce((sum, block) => sum + (block.valor_real || 0), 0);
      
      // Find best and worst hours
      const blockValues = allBlocks.map((block, index) => ({
        index: index + 1,
        value: block.valor_real || 0
      }));
      
      const melhorHora = blockValues.reduce((max, block) => 
        block.value > max.value ? block : max
      ).index;
      
      const piorHora = blockValues.reduce((min, block) => 
        block.value < min.value ? block : min
      ).index;

      const ritmoMedio = totalVendido / allBlocks.length;
      const porcentagemMeta = (totalVendido / session!.meta_dia) * 100;

      // Generate advice
      const conselho = generateAdvice(melhorHora, piorHora, porcentagemMeta, allBlocks.length);

      // Update session
      await supabase
        .from('work_sessions')
        .update({
          status: 'finished',
          end_timestamp: new Date().toISOString(),
          total_vendido: totalVendido,
          constancia_dia: true, // All blocks filled = constancy
        })
        .eq('id', sessionId);

      // Create daily report
      const { error: reportError } = await supabase
        .from('daily_reports')
        .insert({
          session_id: sessionId,
          user_id: session!.user_id,
          total_vendido: totalVendido,
          melhor_hora: melhorHora,
          pior_hora: piorHora,
          ritmo_medio: ritmoMedio,
          porcentagem_meta: porcentagemMeta,
          conselho,
        });

      if (reportError) throw reportError;

      // Reload session
      await loadActiveSession();
    } catch (error) {
      console.error('Error finalizing session:', error);
    }
  };

  const generateAdvice = (melhorHora: number, piorHora: number, porcentagem: number, totalHours: number) => {
    if (porcentagem >= 100) {
      return "Você ultrapassou sua meta! Isso indica consistência acima do esperado.";
    }

    if (melhorHora <= totalHours / 2) {
      return "Seu pico está no início do dia. Priorize vender mais no começo.";
    }

    if (melhorHora > totalHours / 2) {
      return "Você performa melhor na parte da tarde. Tente manter esse ritmo.";
    }

    if (porcentagem < 80) {
      return "Hoje você ficou abaixo da meta, mas manteve consistência. Continue preenchendo todos os blocos.";
    }

    return "Continue mantendo seu ritmo. A constância é o caminho para o sucesso.";
  };

  return {
    session,
    blocks,
    loading,
    startWorkSession,
    updateBlockValue,
  };
};
