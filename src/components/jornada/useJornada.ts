/* Estado da jornada do teste: em que dia a pessoa está, o que já cumpriu e,
   no último dia, quanto vendeu nos 3 dias (o argumento da tela de planos). */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { avisar } from "@/shared/lib/avisar";
import { diaDoTeste, type Passo } from "./jornada-lib";

type Linha = Record<string, unknown>;
type Resp<T> = { data: T | null; error: unknown };
interface Consulta<T> extends PromiseLike<Resp<T>> {
  select: (c: string) => Consulta<T>;
  eq: (c: string, v: unknown) => Consulta<T>;
  gte: (c: string, v: unknown) => Consulta<T>;
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

/** Marca um passo da jornada como feito (uma vez por conta; silencioso se falhar). */
export async function marcarPasso(passo: Passo): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
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
      const [{ data: p }, { data: linhas }] = await Promise.all([
        tabela("profiles").select("trial_start, trial_end, plan_status, is_demo, billing_exempt, created_at").eq("user_id", uid).maybeSingle(),
        tabela("jornada_teste").select("passo").eq("user_id", uid),
      ]);
      const inicio = (p?.trial_start as string | null) ?? ((p?.created_at as string | null)?.slice(0, 10) ?? null);
      const fim = (p?.trial_end as string | null) ?? null;
      const pagante = p?.plan_status === "active" || !!p?.billing_exempt || !!p?.is_demo;
      const dia = diaDoTeste(inicio, hoje);
      const emTeste = !pagante && dia != null && (!fim || hoje <= fim);
      const feitos = new Set<Passo>([...lerLocal(uid), ...((linhas ?? []).map((l) => l.passo as Passo))]);
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
      setEstado({ carregando: false, emTeste, dia: emTeste ? dia : null, feitos, vendidoNoTeste });
    } catch (e) {
      avisar.silencioso("jornada: carregar", e);
      setEstado((s) => ({ ...s, carregando: false, emTeste: false }));
    }
  }, [uid]);

  useEffect(() => { void carregar(); }, [carregar]);
  useEffect(() => {
    const f = () => { if (uid) setEstado((s) => ({ ...s, feitos: new Set([...s.feitos, ...lerLocal(uid)]) })); };
    OUVINTES.add(f);
    return () => { OUVINTES.delete(f); };
  }, [uid]);

  return estado;
}

/** Abre a VANT IA (botão flutuante) já pedindo algo. */
export function abrirChatCom(texto: string) {
  window.dispatchEvent(new CustomEvent("vant:abrir-chat", { detail: { texto } }));
}
