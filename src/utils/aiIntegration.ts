/**
 * AI Integration Module
 * 
 * Este módulo está preparado para futura integração com IA
 * que irá analisar automaticamente os dados do usuário e 
 * sugerir melhorias em:
 * 
 * - Rotina diária (melhor distribuição de tempo)
 * - Estratégias de vendas (horários de pico, métodos de pagamento)
 * - Metas personalizadas (baseadas no histórico)
 * - Identificação de padrões (dias mais lucrativos, tendências)
 * - Alertas inteligentes (previsão de calotes, recomendações)
 * 
 * Funcionalidades futuras:
 * 
 * 1. analyzeRoutine(routineData): Promise<RoutineInsights>
 *    - Analisa horários de trabalho e sugere otimizações
 *    - Compara com rotinas de sucesso
 * 
 * 2. analyzeSales(salesHistory): Promise<SalesInsights>
 *    - Identifica padrões de vendas
 *    - Sugere melhores estratégias de pagamento
 *    - Prevê dias de maior lucro
 * 
 * 3. generatePersonalizedGoals(userData): Promise<Goals>
 *    - Cria metas realistas baseadas no histórico
 *    - Adapta metas conforme progresso
 * 
 * 4. predictDebtRisk(customerData): Promise<RiskScore>
 *    - Analisa padrões de calotes
 *    - Sugere estratégias de prevenção
 * 
 * 5. getMotivationalInsights(progress): Promise<Insights>
 *    - Gera mensagens motivacionais personalizadas
 *    - Celebra conquistas e marcos
 */

// Tipos para estrutura de dados da IA
export interface RoutineInsights {
  suggestions: string[];
  optimizedSchedule: any;
  efficiency_score: number;
}

export interface SalesInsights {
  patterns: {
    bestDays: string[];
    bestPaymentMethods: string[];
    averageDailyProfit: number;
  };
  predictions: {
    nextWeekTrend: "up" | "down" | "stable";
    expectedProfit: number;
  };
  recommendations: string[];
}

export interface Goals {
  daily: number;
  weekly: number;
  monthly: number;
  adjustmentReason: string;
}

export interface RiskScore {
  score: number; // 0-100
  level: "low" | "medium" | "high";
  preventionTips: string[];
}

export interface Insights {
  message: string;
  icon: string;
  achievements: string[];
  nextMilestone: {
    description: string;
    progress: number;
  };
}

// Placeholder functions - to be implemented
export async function analyzeRoutine(routineData: any): Promise<RoutineInsights> {
  const wakeTime = routineData?.wake_time || "07:00";
  const workStart = routineData?.work_start || "08:00";
  const workEnd = routineData?.work_end || "18:00";
  const [wh, wm] = wakeTime.split(":").map(Number);
  const [sh, sm] = workStart.split(":").map(Number);
  const gapMinutes = (sh * 60 + sm) - (wh * 60 + wm);

  const suggestions: string[] = [];
  if (gapMinutes < 30) suggestions.push("Aumente o tempo entre acordar e iniciar trabalho para preparar a mente.");
  if (gapMinutes > 120) suggestions.push("Reduza o tempo ocioso antes do trabalho para não perder energia.");
  suggestions.push("Reserve os primeiros 30 minutos do dia para planejar suas abordagens.");
  suggestions.push("Faça uma pausa de 10 min a cada 2 horas de trabalho para manter o ritmo.");

  return { suggestions, optimizedSchedule: { wake_time: wakeTime, work_start: workStart, work_end: workEnd }, efficiency_score: gapMinutes >= 30 && gapMinutes <= 90 ? 85 : 65 };
}

export async function analyzeSales(salesHistory: any[]): Promise<SalesInsights> {
  if (!salesHistory || salesHistory.length === 0) {
    return { patterns: { bestDays: [], bestPaymentMethods: [], averageDailyProfit: 0 }, predictions: { nextWeekTrend: "stable", expectedProfit: 0 }, recommendations: ["Registre suas vendas diariamente para obter análises precisas."] };
  }

  const avg = salesHistory.reduce((s, d) => s + (d.total_profit || 0), 0) / salesHistory.length;
  const recent = salesHistory.slice(0, 7);
  const recentAvg = recent.reduce((s, d) => s + (d.total_profit || 0), 0) / recent.length;
  const trend: "up" | "down" | "stable" = recentAvg > avg * 1.1 ? "up" : recentAvg < avg * 0.9 ? "down" : "stable";

  const dayNames = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const byDay: Record<number, number[]> = {};
  for (const d of salesHistory) { const dow = new Date(d.date).getDay(); if (!byDay[dow]) byDay[dow] = []; byDay[dow].push(d.total_profit || 0); }
  const bestDayIndex = Object.entries(byDay).sort(([, a], [, b]) => b.reduce((x, y) => x + y, 0) / b.length - a.reduce((x, y) => x + y, 0) / a.length)[0];
  const bestDays = bestDayIndex ? [dayNames[parseInt(bestDayIndex[0])]] : [];

  const methods: string[] = [];
  const hasPix = salesHistory.some(d => (d.total_pix || 0) > 0);
  const hasCard = salesHistory.some(d => (d.total_card || 0) > 0);
  if (hasPix) methods.push("Pix");
  if (hasCard) methods.push("Cartão");
  if (!hasPix && !hasCard) methods.push("Dinheiro");

  const recs: string[] = [];
  if (trend === "down") recs.push("Suas vendas recentes estão abaixo da média. Revise sua abordagem.");
  if (trend === "up") recs.push("Suas vendas estão em alta! Mantenha o foco e documente o que está funcionando.");
  recs.push(`Seu melhor dia costuma ser ${bestDays[0] || "dia útil"}. Planeje mais abordagens nesse dia.`);

  return { patterns: { bestDays, bestPaymentMethods: methods, averageDailyProfit: avg }, predictions: { nextWeekTrend: trend, expectedProfit: avg * 5 }, recommendations: recs };
}

export async function generatePersonalizedGoals(userData: any): Promise<Goals> {
  const history = userData?.salesHistory || [];
  const currentMonthly = userData?.monthlyGoal || 0;
  if (history.length < 7) {
    return { daily: currentMonthly / 22, weekly: currentMonthly / 4.3, monthly: currentMonthly, adjustmentReason: "Dados insuficientes — meta baseada no seu planejamento atual." };
  }
  const avg = history.reduce((s: number, d: any) => s + (d.total_profit || 0), 0) / history.length;
  const suggested = Math.round(avg * 1.15 * 22);
  return { daily: Math.round(avg * 1.15), weekly: Math.round(avg * 1.15 * 5), monthly: suggested, adjustmentReason: `Meta sugerida 15% acima da sua média diária de R$${avg.toFixed(2)}.` };
}

export async function predictDebtRisk(customerData: any): Promise<RiskScore> {
  const totalSales = customerData?.total_sales || 0;
  const totalDebt = customerData?.total_debt || 0;
  if (totalSales === 0) return { score: 0, level: "low", preventionTips: ["Registre suas vendas para calcular o risco de calote."] };
  const ratio = totalDebt / totalSales;
  const score = Math.round(ratio * 100);
  const level: "low" | "medium" | "high" = ratio < 0.1 ? "low" : ratio < 0.25 ? "medium" : "high";
  const tips: string[] = [];
  if (level === "high") { tips.push("Evite fiado para novos clientes."); tips.push("Exija pagamento à vista ou Pix para valores acima de R$50."); }
  if (level === "medium") { tips.push("Limite o crédito a clientes antigos com histórico positivo."); }
  tips.push("Registre o nome do cliente em vendas fiadas para cobrança.");
  return { score, level, preventionTips: tips };
}

export async function getMotivationalInsights(progress: any): Promise<Insights> {
  const pct = progress?.percentage || 0;
  const streak = progress?.streak || 0;
  let message = "Cada abordagem é um passo rumo à meta. Continue!";
  if (pct >= 100) message = "🏆 Meta batida! Você é um visionário. Agora vai além!";
  else if (pct >= 75) message = "🚀 75% da meta! Você está no caminho certo. Mais um esforço!";
  else if (pct >= 50) message = "💪 Metade do caminho feito. Não para agora!";
  else if (streak >= 7) message = `🔥 ${streak} dias seguidos! Consistência cria campeões.`;
  const achievements: string[] = [];
  if (streak >= 7) achievements.push(`${streak} dias consecutivos`);
  if (pct >= 100) achievements.push("Meta diária batida");
  if (pct >= 50) achievements.push("Mais da metade da meta");
  return { message, icon: pct >= 100 ? "🏆" : pct >= 75 ? "🚀" : "💪", achievements, nextMilestone: { description: pct >= 100 ? "Bater 110% da meta" : `Chegar a ${pct < 50 ? 50 : pct < 75 ? 75 : 100}% da meta`, progress: pct >= 100 ? 100 : pct } };
}
