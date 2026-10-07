/* Estado da jornada do teste: em que dia a pessoa está, o que já cumpriu e,
   no último dia, quanto vendeu nos 3 dias (o argumento da tela de planos). */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { avisar } from "@/shared/lib/avisar";
import { diaDoTeste, diaDoPasso, diasEntre, passoLiberado, type Passo } from "./jornada-lib";
import { lerSimulacao, passosSimulados, gravarPassoSimulado, EVENTO_SIMULACAO } from "./simulador";

type Linha = Record<string, unknown>;
type Resp<T> = { data: T | null; error: unknown };
interface Consulta<T> extends PromiseLike<Resp<T>> {
  select: (c: string) => Consulta<T>;
  eq: (c: string, v: unknown) => Consulta<T>;
  gte: (c: string, v: unknown) => Consulta<T>;
  limit: (n: number) => Consulta<T>;
  maybeSingle: () => PromiseLike<Resp<Linha>>;
  insert: (v: Linha) => PromiseLike<{ error: { code?: string } | null }>;
}
const tabela = (nome: string) => (supabase as unknown as { from: (t: string) => Consulta<Linha[]> }).from(nome);

const chaveLocal = (uid: string) => `vant_jornada_${uid}`;
function lerLocal(uid: string): Passo[] {
  try { return JSON.parse(localStorage.getItem(chaveLocal(uid)) || "[]") as Passo[]; } catch { return []; }
}
function gravarLocal(uid: string, passos: Passo[]) {
  try { localStorage.setItem(chaveLocal(uid), JSON.stringify(Array.from(new Set(passos)))); } catch { /* sem storage: só não guarda */ }
}

const OUVINTES = new Set<() => void>();
/** Dia do teste da conta logada (null = fora do teste ou ainda não carregou). */
let DIA_ATUAL: number | null | undefined = undefined;

/** Dia do teste direto do perfil (quando a tela abriu antes do Início carregar a jornada). */
async function diaDaConta(uid: string): Promise<number | null> {
  try {
    const { data: p } = await tabela("profiles").select("trial_start, trial_end, plan_status, is_demo, billing_exempt").eq("user_id", uid).maybeSingle();
    if (!p || p.plan_status === "active" || p.billing_exempt || p.is_demo) return null;
    const hoje = getBrazilDate();
    const fim = (p.trial_end as string | null) ?? null;
    if (fim && hoje > fim) return null;
    return diaDoTeste((p.trial_start as string | null) ?? null, hoje);
  } catch { return null; }
}

/** Marca um passo da jornada como feito (uma vez por conta; silencioso se falhar). */
export async function marcarPasso(passo: Passo): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    // simulador do admin: marca só na chave local da simulação, nunca no banco
    const sim = lerSimulacao(uid);
    // Um passo só vale no dia dele ou depois: abrir o relatório no dia 0 (passeando pelo app)
    // não pode deixar a missão do dia 1 pronta antes de ela aparecer (Rick, 07/10).
    if (sim == null && DIA_ATUAL === undefined) DIA_ATUAL = await diaDaConta(uid);
    if (!passoLiberado(passo, sim != null ? (sim <= 3 ? sim : null) : (DIA_ATUAL ?? null))) return;
    if (sim != null) { gravarPassoSimulado(uid, passo); OUVINTES.forEach((f) => f()); return; }
    const locais = lerLocal(uid);
    if (locais.includes(passo)) return;
    gravarLocal(uid, [...locais, passo]);
    OUVINTES.forEach((f) => f());
    const { error } = await tabela("jornada_teste").insert({ user_id: uid, passo });
    if (error && error.code !== "23505") avisar.silencioso("jornada: marcar passo", error);
  } catch (e) {
    avisar.silencioso("jornada: marcar passo", e);
  }
}

/** Marca o passo quando a tela abre. */
export function useMarcarPasso(passo: Passo, ativo = true) {
  useEffect(() => { if (ativo) void marcarPasso(passo); }, [passo, ativo]);
}

export interface EstadoJornada {
  carregando: boolean;
  emTeste: boolean;
  dia: number | null;
  feitos: Set<Passo>;
  vendidoNoTeste: number | null;
}

export function useJornada(): EstadoJornada {
  const { user } = useAuth();
  const uid = user?.id ?? null;
  const [estado, setEstado] = useState<EstadoJornada>({ carregando: true, emTeste: false, dia: null, feitos: new Set(), vendidoNoTeste: null });

  const carregar = useCallback(async () => {
    if (!uid) { setEstado((e) => ({ ...e, carregando: false, emTeste: false })); return; }
    try {
      const hoje = getBrazilDate();
      const sim = lerSimulacao(uid);
      if (sim != null) {
        // Simulação: finge um teste que começou há `sim` dias. O "vendido no teste"
        // usa as vendas reais da conta nesses dias, pra tela mostrar número de verdade.
        let vendidoNoTeste: number | null = null;
        if (sim >= 3) {
          const ini = new Date(Date.parse(hoje + "T12:00:00-03:00") - Math.min(sim, 3) * 86_400_000).toISOString().slice(0, 10);
          const { data: vendas } = await tabela("daily_sales").select("total_profit, date").eq("user_id", uid).gte("date", ini);
          vendidoNoTeste = (vendas ?? []).reduce((s, v) => s + (Number(v.total_profit) || 0), 0);
        }
        const emTeste = sim <= 3;
        setEstado({ carregando: false, emTeste, dia: emTeste ? sim : null, feitos: new Set(passosSimulados(uid)), vendidoNoTeste });
        return;
      }
      const [{ data: p }, { data: linhas }, { data: prods }] = await Promise.all([
        tabela("profiles").select("trial_start, trial_end, plan_status, is_demo, billing_exempt, created_at").eq("user_id", uid).maybeSingle(),
        tabela("jornada_teste").select("passo, feito_em").eq("user_id", uid),
        // já tem produto cadastrado (antes da jornada existir, ou por outro caminho) = passo cumprido
        tabela("products").select("id").eq("user_id", uid).eq("is_active", true).limit(1),
      ]);
      const inicio = (p?.trial_start as string | null) ?? ((p?.created_at as string | null)?.slice(0, 10) ?? null);
      const fim = (p?.trial_end as string | null) ?? null;
      const pagante = p?.plan_status === "active" || !!p?.billing_exempt || !!p?.is_demo;
      const dia = diaDoTeste(inicio, hoje);
      const emTeste = !pagante && dia != null && (!fim || hoje <= fim);
      // Só vale o passo feito no dia dele ou depois (o banco guarda quando foi feito).
      const valeu = (l: Linha) => {
        const d = diaDoPasso(l.passo as Passo);
        if (d == null || !inicio) return true;
        const quando = new Date(String(l.feito_em)).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
        return diasEntre(inicio.slice(0, 10), quando) >= d;
      };
      const feitos = new Set<Passo>((linhas ?? []).filter(valeu).map((l) => l.passo as Passo));
      if ((prods ?? []).length > 0) feitos.add("produto");
      gravarLocal(uid, Array.from(feitos));

      // quanto vendeu nos dias de teste: o argumento do último dia e da tela de bloqueio
      let vendidoNoTeste: number | null = null;
      const expirou = !pagante && !!fim && hoje > fim;
      if (inicio && !pagante && ((emTeste && dia === 3) || expirou)) {
        const { data: vendas } = await tabela("daily_sales").select("total_profit, date").eq("user_id", uid).gte("date", inicio.slice(0, 10));
        vendidoNoTeste = (vendas ?? [])
          .filter((v) => !fim || String(v.date) <= fim)
          .reduce((s, v) => s + (Number(v.total_profit) || 0), 0);
      }
      DIA_ATUAL = emTeste ? dia : null;
      setEstado({ carregando: false, emTeste, dia: emTeste ? dia : null, feitos, vendidoNoTeste });
    } catch (e) {
      avisar.silencioso("jornada: carregar", e);
      setEstado((s) => ({ ...s, carregando: false, emTeste: false }));
    }
  }, [uid]);

  useEffect(() => { void carregar(); }, [carregar]);
  // App aberto de um dia pro outro (PWA fica na memória): ao voltar pro app ou virar o dia,
  // recarrega — senão a missão do dia novo não aparece até fechar e abrir de novo.
  useEffect(() => {
    let dia = getBrazilDate();
    const conferir = () => {
      if (document.visibilityState !== "visible") return;
      const agora = getBrazilDate();
      if (agora !== dia) { dia = agora; void carregar(); }
    };
    const voltou = () => { if (document.visibilityState === "visible") void carregar(); };
    document.addEventListener("visibilitychange", voltou);
    const t = setInterval(conferir, 60_000);
    return () => { document.removeEventListener("visibilitychange", voltou); clearInterval(t); };
  }, [carregar]);
  useEffect(() => {
    const f = () => {
      if (!uid) return;
      const extra = lerSimulacao(uid) != null ? passosSimulados(uid) : lerLocal(uid);
      setEstado((s) => ({ ...s, feitos: new Set([...s.feitos, ...extra]) }));
    };
    OUVINTES.add(f);
    return () => { OUVINTES.delete(f); };
  }, [uid]);
  // trocar o dia no simulador (ou zerar) recarrega tudo na hora
  useEffect(() => {
    const f = () => { void carregar(); };
    window.addEventListener(EVENTO_SIMULACAO, f);
    return () => window.removeEventListener(EVENTO_SIMULACAO, f);
  }, [carregar]);

  return estado;
}

/** Abre a VANT IA (botão flutuante) já pedindo algo. */
export function abrirChatCom(texto: string) {
  window.dispatchEvent(new CustomEvent("vant:abrir-chat", { detail: { texto } }));
}
