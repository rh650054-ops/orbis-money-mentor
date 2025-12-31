import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/lib/dateUtils";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface IntentResult {
  response: string;
  data?: any;
}

type IntentHandler = (userId: string) => Promise<IntentResult>;

export function useOrbisIntents(userId: string | undefined) {
  
  // Get today's sales data
  const getTodaySales = useCallback(async (): Promise<{
    total: number;
    meta: number;
    faltando: number;
    porcentagem: number;
    melhorHora: number | null;
    piorHora: number | null;
  }> => {
    if (!userId) return { total: 0, meta: 0, faltando: 0, porcentagem: 0, melhorHora: null, piorHora: null };

    const today = getBrazilDate();

    // Get daily plan
    const { data: plan } = await supabase
      .from("daily_goal_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    // Get hourly blocks
    const { data: blocks } = await supabase
      .from("hourly_goal_blocks")
      .select("*")
      .eq("user_id", userId)
      .eq("plan_id", plan?.id || "")
      .order("hour_index");

    const totalVendido = blocks?.reduce((sum, b) => sum + (b.achieved_amount || 0), 0) || 0;
    const meta = plan?.daily_goal || 0;
    const faltando = Math.max(0, meta - totalVendido);
    const porcentagem = meta > 0 ? (totalVendido / meta) * 100 : 0;

    // Find best and worst hours
    let melhorHora: number | null = null;
    let piorHora: number | null = null;
    let maxVal = -1;
    let minVal = Infinity;

    blocks?.forEach((b) => {
      if (b.achieved_amount > 0) {
        if (b.achieved_amount > maxVal) {
          maxVal = b.achieved_amount;
          melhorHora = b.hour_index;
        }
        if (b.achieved_amount < minVal) {
          minVal = b.achieved_amount;
          piorHora = b.hour_index;
        }
      }
    });

    return { total: totalVendido, meta, faltando, porcentagem, melhorHora, piorHora };
  }, [userId]);

  // Get monthly stats
  const getMonthlyStats = useCallback(async (): Promise<{
    totalMes: number;
    metaMes: number;
    diasTrabalhados: number;
    mediadia: number;
  }> => {
    if (!userId) return { totalMes: 0, metaMes: 0, diasTrabalhados: 0, mediadia: 0 };

    const today = new Date();
    const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(today), "yyyy-MM-dd");
    const currentMonth = format(today, "yyyy-MM");

    // Get monthly goal from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("monthly_goal")
      .eq("user_id", userId)
      .single();

    // Get leaderboard stats
    const { data: leaderboard } = await supabase
      .from("leaderboard_stats")
      .select("faturamento_total_mes, dias_trabalhados_mes")
      .eq("user_id", userId)
      .eq("mes_referencia", currentMonth)
      .single();

    const totalMes = leaderboard?.faturamento_total_mes || 0;
    const diasTrabalhados = leaderboard?.dias_trabalhados_mes || 0;
    const mediadia = diasTrabalhados > 0 ? totalMes / diasTrabalhados : 0;

    return {
      totalMes,
      metaMes: profile?.monthly_goal || 0,
      diasTrabalhados,
      mediadia,
    };
  }, [userId]);

  // Intent handlers
  const intents: Record<string, IntentHandler> = {
    // "Como tá meu faturamento hoje?"
    faturamento_hoje: async () => {
      const data = await getTodaySales();
      return {
        response: `Hoje você fez R$ ${data.total.toFixed(0)}. ${
          data.meta > 0
            ? `Sua meta é R$ ${data.meta.toFixed(0)}, você está em ${data.porcentagem.toFixed(0)}%.`
            : ""
        }`,
        data,
      };
    },

    // "Quanto falta pra bater a meta?"
    meta_faltando: async () => {
      const data = await getTodaySales();
      if (data.faltando <= 0) {
        return {
          response: `Parabéns! Você já bateu a meta de hoje! Fez R$ ${data.total.toFixed(0)} de R$ ${data.meta.toFixed(0)}.`,
          data,
        };
      }
      return {
        response: `Faltam R$ ${data.faltando.toFixed(0)} para bater a meta de R$ ${data.meta.toFixed(0)}. Você já fez R$ ${data.total.toFixed(0)}.`,
        data,
      };
    },

    // "Qual foi minha melhor hora?"
    melhor_hora: async () => {
      const data = await getTodaySales();
      if (data.melhorHora === null) {
        return {
          response: "Ainda não há vendas registradas hoje para identificar a melhor hora.",
          data,
        };
      }
      return {
        response: `Sua melhor hora foi às ${data.melhorHora}h. Continue focado!`,
        data,
      };
    },

    // "E agora, como estou?"
    status_atual: async () => {
      const data = await getTodaySales();
      const horaAtual = new Date().getHours();
      const horasRestantes = Math.max(0, 18 - horaAtual);
      
      let status = "";
      if (data.porcentagem >= 100) {
        status = "Excelente! Você já bateu a meta!";
      } else if (data.porcentagem >= 80) {
        status = "Você está quase lá!";
      } else if (data.porcentagem >= 50) {
        status = "Bom progresso, mantenha o ritmo.";
      } else {
        status = "Hora de acelerar!";
      }

      const ritmoNecessario = horasRestantes > 0 ? data.faltando / horasRestantes : 0;

      return {
        response: `${status} Você fez R$ ${data.total.toFixed(0)} (${data.porcentagem.toFixed(0)}% da meta). ${
          data.faltando > 0 && horasRestantes > 0
            ? `Para bater a meta, precisa fazer R$ ${ritmoNecessario.toFixed(0)} por hora.`
            : ""
        }`,
        data,
      };
    },

    // "Como tá o mês?"
    status_mes: async () => {
      const data = await getMonthlyStats();
      const today = new Date();
      const daysInMonth = endOfMonth(today).getDate();
      const daysPassed = today.getDate();
      const daysLeft = daysInMonth - daysPassed;

      const porcentagem = data.metaMes > 0 ? (data.totalMes / data.metaMes) * 100 : 0;
      const faltaMes = Math.max(0, data.metaMes - data.totalMes);
      const ritmoNecessario = daysLeft > 0 ? faltaMes / daysLeft : 0;

      return {
        response: `No mês você fez R$ ${data.totalMes.toFixed(0)} de R$ ${data.metaMes.toFixed(0)} (${porcentagem.toFixed(0)}%). Trabalhou ${data.diasTrabalhados} dias com média de R$ ${data.mediadia.toFixed(0)} por dia. ${
          faltaMes > 0
            ? `Faltam R$ ${faltaMes.toFixed(0)} em ${daysLeft} dias (R$ ${ritmoNecessario.toFixed(0)}/dia).`
            : "Meta do mês batida!"
        }`,
        data,
      };
    },

    // "Vale a pena acelerar?"
    vale_acelerar: async () => {
      const today = await getTodaySales();
      const month = await getMonthlyStats();
      
      const horaAtual = new Date().getHours();
      const horasRestantes = Math.max(0, 18 - horaAtual);

      let conselho = "";
      if (today.porcentagem >= 100) {
        conselho = "Você já bateu a meta de hoje! Se quiser, pode descansar ou fazer extra para o mês.";
      } else if (today.porcentagem >= 80 && horasRestantes <= 2) {
        conselho = "Vale sim! Você está perto, um sprint final pode garantir a meta.";
      } else if (today.porcentagem < 50 && horasRestantes > 4) {
        conselho = "Sim, ainda dá tempo! Foque nas próximas horas e você consegue.";
      } else if (horasRestantes <= 1) {
        conselho = "Está acabando o dia. Faça o que puder, amanhã é um novo dia.";
      } else {
        conselho = "Mantenha o ritmo atual. Você está no caminho certo.";
      }

      return {
        response: conselho,
        data: { today, month },
      };
    },
  };

  // Parse user message and detect intent
  const detectIntent = useCallback((message: string): string | null => {
    const msg = message.toLowerCase().trim();

    if (msg.includes("faturamento") && (msg.includes("hoje") || msg.includes("dia"))) {
      return "faturamento_hoje";
    }
    if (msg.includes("falta") && msg.includes("meta")) {
      return "meta_faltando";
    }
    if (msg.includes("melhor hora") || (msg.includes("melhor") && msg.includes("hora"))) {
      return "melhor_hora";
    }
    if (msg.includes("agora") && msg.includes("como")) {
      return "status_atual";
    }
    if (msg.includes("mês") || msg.includes("mes") || msg.includes("mensal")) {
      return "status_mes";
    }
    if (msg.includes("acelerar") || msg.includes("vale a pena")) {
      return "vale_acelerar";
    }
    if (msg.includes("como") && (msg.includes("estou") || msg.includes("to") || msg.includes("tô"))) {
      return "status_atual";
    }

    return null;
  }, []);

  // Process message and return response
  const processMessage = useCallback(
    async (message: string): Promise<IntentResult> => {
      if (!userId) {
        return { response: "Por favor, faça login para usar o assistente." };
      }

      const intent = detectIntent(message);

      if (intent && intents[intent]) {
        return await intents[intent](userId);
      }

      // Default response when no intent matched
      return {
        response:
          "Desculpe, não entendi. Você pode perguntar sobre seu faturamento de hoje, meta, melhor hora, status do mês, ou se vale a pena acelerar.",
      };
    },
    [userId, detectIntent, intents]
  );

  return {
    processMessage,
    detectIntent,
    getTodaySales,
    getMonthlyStats,
  };
}
