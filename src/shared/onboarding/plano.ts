/* ============================================================
   PLANO DO CORRE — a matemática e a memória do onboarding.
   O usuário informa: meta do MÊS, dias por semana, horas por dia.
   Daqui saem: valor no ANO, na SEMANA, a DIÁRIA e a HORA dele.
   A diária vira a meta do dia no Modo Foco; as horas viram os
   blocos do DEFCON — mas isso só é REVELADO no 1º Modo Foco
   ("gravado em silêncio, só avisamos depois" — decisão do Rick).
   ============================================================ */
import { supabase } from "@/integrations/supabase/client";

export interface PlanoDoCorre {
  metaMensal: number;   // R$ por mês (o que ele digitou)
  diasSemana: number;   // 4 | 5 | 6 | 7
  horasDia: number;     // 6 | 8 | 10 | 12
  /** Que horas ele vai começar a vender (7–10). null = ainda não marcou —
   *  a pergunta aparece no FIM da definição de metas, com fala natural
   *  ("Que horas você vai começar a vender amanhã?"). Sem hora marcada,
   *  o Orbis NÃO cobra nada. */
  horaInicio: number | null;
}

export interface PlanoCalculado extends PlanoDoCorre {
  ano: number;     // metaMensal × 12
  semana: number;  // ano ÷ 52 (arredondado pra ficar "falável")
  diaria: number;  // semana ÷ diasSemana  → meta do dia no Foco
  hora: number;    // diaria ÷ horasDia    → "sua hora na rua vale"
}

/** MESMA CONTA do "Editar Planejamento" que já existe no app
 *  (39.000/mês · 5 dias · 13h → 9.750/semana · 1.950/dia · 150/hora):
 *  semana = mês ÷ 4 · diária = semana ÷ dias · hora = diária ÷ horas.
 *  Os números têm que bater em TODO lugar — onboarding, modal e cobrança. */
export function calcularPlano(p: PlanoDoCorre): PlanoCalculado {
  const ano = p.metaMensal * 12;
  const semana = Math.round(p.metaMensal / 4);
  const diaria = p.diasSemana > 0 ? Math.round(semana / p.diasSemana) : 0;
  const hora = p.horasDia > 0 ? Math.round(diaria / p.horasDia) : 0;
  return { ...p, ano, semana, diaria, hora };
}

const chaveLocal = (userId: string) => `orbis_plano_corre_${userId}`;

/** Grava o plano em DOIS lugares: localStorage (resposta imediata,
 *  funciona offline) e banco (fonte de verdade, cross-device).
 *  Se o banco falhar (sem rede na rua), o local segura a onda e o
 *  app tenta de novo na próxima leitura. */
export async function salvarPlano(userId: string, plano: PlanoDoCorre): Promise<void> {
  try { localStorage.setItem(chaveLocal(userId), JSON.stringify(plano)); } catch { /* modo privado */ }
  // FONTE ÚNICA: as metas moram em profiles (mesmas colunas que o modal
  // "Editar Planejamento" grava) — assim o dashboard, o DEFCON e o checklist
  // enxergam o plano do onboarding sem nenhum código extra.
  try {
    const calc = calcularPlano(plano);
    const hoje = new Date();
    const dataBR = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
    await supabase.from("profiles").update({
      monthly_goal: plano.metaMensal,
      goal_hours: plano.horasDia,
      weekly_work_days: plano.diasSemana,
      base_daily_goal: calc.diaria,
      weekly_goal: calc.semana,
      week_start_date: dataBR,
    }).eq("user_id", userId);
  } catch { /* offline — tenta de novo na próxima gravação */ }
  try {
    await supabase.from("onboarding_planos").upsert(
      {
        user_id: userId,
        meta_mensal: plano.metaMensal,
        dias_semana: plano.diasSemana,
        horas_dia: plano.horasDia,
        hora_inicio: plano.horaInicio ?? null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  } catch {
    // sem rede agora — o localStorage já garantiu; sincroniza depois
  }
}

/** Lê o plano: banco primeiro (verdade), localStorage como fallback. */
export async function carregarPlano(userId: string): Promise<PlanoCalculado | null> {
  try {
    // metas: profiles (fonte única) · hora de começar: onboarding_planos
    const [{ data: perfil }, { data: data }] = await Promise.all([
      supabase.from("profiles").select("monthly_goal, goal_hours, weekly_work_days").eq("user_id", userId).maybeSingle(),
      supabase.from("onboarding_planos").select("meta_mensal, dias_semana, horas_dia, hora_inicio").eq("user_id", userId).maybeSingle(),
    ]);
    if (perfil || data) {
      return calcularPlano({
        metaMensal: Number(perfil?.monthly_goal) || Number(data?.meta_mensal) || 0,
        diasSemana: Number(perfil?.weekly_work_days) || Number(data?.dias_semana) || 6,
        horasDia: Number(perfil?.goal_hours) || Number(data?.horas_dia) || 8,
        horaInicio: data?.hora_inicio == null ? null : Number(data.hora_inicio),
      });
    }
  } catch { /* offline — cai pro local */ }
  try {
    const raw = localStorage.getItem(chaveLocal(userId));
    if (raw) return calcularPlano(JSON.parse(raw) as PlanoDoCorre);
  } catch { /* nada */ }
  return null;
}

/** Grava SÓ a hora de começar a vender (chamada pelo cartão no fim das
 *  metas). Atualiza o local na hora; no banco tenta update e, se o plano
 *  ainda não existe lá (pulou o onboarding), cria com o que der. */
export async function salvarHoraInicio(userId: string, hora: number): Promise<void> {
  try {
    const raw = localStorage.getItem(chaveLocal(userId));
    const atual = raw ? (JSON.parse(raw) as PlanoDoCorre) : null;
    localStorage.setItem(chaveLocal(userId), JSON.stringify({
      metaMensal: atual?.metaMensal ?? 0,
      diasSemana: atual?.diasSemana ?? 6,
      horasDia: atual?.horasDia ?? 8,
      horaInicio: hora,
    }));
  } catch { /* modo privado */ }
  try {
    const { data } = await supabase
      .from("onboarding_planos")
      .update({ hora_inicio: hora, atualizado_em: new Date().toISOString() })
      .eq("user_id", userId)
      .select("user_id");
    if (!data || data.length === 0) {
      // não tinha plano no banco (pulou o onboarding) — cria um mínimo
      await supabase.from("onboarding_planos").upsert(
        { user_id: userId, meta_mensal: 1, dias_semana: 6, horas_dia: 8, hora_inicio: hora },
        { onConflict: "user_id" },
      );
    }
  } catch { /* sem rede — o localStorage segura */ }
}

/** O 1º Modo Foco chama isto pra saber se ainda deve REVELAR o plano
 *  ("lembra da meta que você montou? Ela virou sua meta do dia").
 *  Marca como revelado depois de mostrar — acontece UMA vez. */
export function planoJaRevelado(userId: string): boolean {
  try { return localStorage.getItem(`orbis_plano_revelado_${userId}`) === "1"; } catch { return true; }
}
export function marcarPlanoRevelado(userId: string): void {
  try { localStorage.setItem(`orbis_plano_revelado_${userId}`, "1"); } catch { /* nada */ }
}
