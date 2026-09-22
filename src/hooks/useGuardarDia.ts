import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { getBrazilDate } from "@/shared/lib/date-utils";
import type { Database, Json } from "@/integrations/supabase/types";

type Row = Database["public"]["Tables"]["financas_guardar_dia"]["Row"];
type Insert = Database["public"]["Tables"]["financas_guardar_dia"]["Insert"];

/** What the last "Guardei tudo" added, so it can be undone. */
export type UltimoGuardei = {
  billDeltas: { id: string; delta: number }[];
  goalDeltas: { id: string; delta: number; prevStatus: string }[];
  savedHojeDelta: number;
};

export interface GuardarDiaState {
  /** Day (Brazil TZ, YYYY-MM-DD) this state belongs to. */
  dia: string;
  /** Frozen target of the day; null = no row for today yet (caller decides the initial value). */
  alvo: number | null;
  /** How much was already put away today. */
  guardado: number;
  ultimoGuardei: UltimoGuardei | null;
  /** When "Guardei tudo" closed the day; null = not closed today. */
  salvoEm: string | null;
  carregando: boolean;
}

const LEGACY_KEYS = [
  "orbis_guardar_ver",
  "orbis_guardar_date",
  "orbis_guardar_target",
  "orbis_guardar_saved",
  "orbis_last_save_date",
  "orbis_ultimo_guardei",
] as const;

const ERRO_SALVAR = { title: "Não consegui salvar. Tenta de novo.", variant: "destructive" as const };

const round2 = (n: number) => Math.round(n * 100) / 100;

function parseUltimoGuardei(raw: Json | null): UltimoGuardei | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.billDeltas) || !Array.isArray(o.goalDeltas) || typeof o.savedHojeDelta !== "number") return null;
  return o as unknown as UltimoGuardei;
}

function rowToState(row: Row): GuardarDiaState {
  return {
    dia: row.dia,
    alvo: Number(row.alvo),
    guardado: Number(row.guardado) || 0,
    ultimoGuardei: parseUltimoGuardei(row.ultimo_guardei),
    salvoEm: row.salvo_em,
    carregando: false,
  };
}

/**
 * Reads the legacy per-device localStorage state, but only when it is today's and
 * on the v2 model (v1 residue used to be wiped by the page, so it is not migrated).
 */
function lerLegado(hoje: string): Omit<Insert, "user_id" | "dia"> | null {
  try {
    if (localStorage.getItem("orbis_guardar_ver") !== "2") return null;
    if (localStorage.getItem("orbis_guardar_date") !== hoje) return null;
    const target = localStorage.getItem("orbis_guardar_target");
    const saved = Number(localStorage.getItem("orbis_guardar_saved") || 0);
    const salvoHoje = localStorage.getItem("orbis_last_save_date") === hoje;
    let ultimo: Json | null = null;
    const rawUltimo = localStorage.getItem("orbis_ultimo_guardei");
    if (rawUltimo) {
      const obj = JSON.parse(rawUltimo) as { date?: string; data?: Json };
      if (obj?.date === hoje && obj.data) ultimo = obj.data;
    }
    return {
      ...(target != null && !Number.isNaN(Number(target)) ? { alvo: round2(Number(target)) } : {}),
      guardado: round2(Math.max(0, saved)),
      salvo_em: salvoHoje ? new Date().toISOString() : null,
      ultimo_guardei: ultimo,
    };
  } catch (err) {
    console.warn("[useGuardarDia] legacy localStorage unreadable, skipping migration:", err);
    return null;
  }
}

function limparLegado() {
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch (err) {
    console.warn("[useGuardarDia] could not remove legacy localStorage keys:", err);
  }
}

/**
 * "Guardar do dia" persisted in `financas_guardar_dia` (one row per user+day) so it
 * survives switching phones / clearing the browser. Local state only changes after
 * the DB write succeeds; on failure a toast is shown and the state is left as is.
 */
export function useGuardarDia(userId: string | undefined) {
  const { toast } = useToast();
  const [state, setState] = useState<GuardarDiaState>({
    dia: getBrazilDate(),
    alvo: null,
    guardado: 0,
    ultimoGuardei: null,
    salvoEm: null,
    carregando: true,
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const upsert = useCallback(
    async (userIdNow: string, dia: string, patch: Omit<Insert, "user_id" | "dia">): Promise<Row | null> => {
      const { data, error } = await supabase
        .from("financas_guardar_dia")
        .upsert({ user_id: userIdNow, dia, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id,dia" })
        .select()
        .single();
      if (error) {
        console.warn("[useGuardarDia] upsert failed:", error.message, patch);
        return null;
      }
      return data;
    },
    [],
  );

  const carregar = useCallback(async () => {
    if (!userId) return;
    const hoje = getBrazilDate();
    setState((s) => ({ ...s, carregando: true }));
    const { data, error } = await supabase
      .from("financas_guardar_dia")
      .select("*")
      .eq("user_id", userId)
      .eq("dia", hoje)
      .maybeSingle();
    if (error) {
      console.warn("[useGuardarDia] load failed:", error.message);
      toast({ title: "Não consegui carregar o guardar de hoje.", variant: "destructive" });
      setState((s) => ({ ...s, dia: hoje, carregando: false }));
      return;
    }
    if (data) {
      // DB already has today: whatever is left on the device is stale.
      limparLegado();
      setState(rowToState(data));
      return;
    }
    // No row yet: migrate today's localStorage state (if any) so nobody loses the day.
    const legado = lerLegado(hoje);
    if (legado) {
      const row = await upsert(userId, hoje, legado);
      if (row) {
        limparLegado();
        setState(rowToState(row));
        return;
      }
      // Keep the legacy keys so the next load can try again.
      toast(ERRO_SALVAR);
    } else {
      limparLegado();
    }
    setState({ dia: hoje, alvo: null, guardado: 0, ultimoGuardei: null, salvoEm: null, carregando: false });
  }, [userId, upsert, toast]);

  useEffect(() => {
    if (!userId) return;
    void carregar();
  }, [userId, carregar]);

  /** Applies a patch to today's row; local state follows only on success. */
  const salvar = useCallback(
    async (patch: Omit<Insert, "user_id" | "dia">): Promise<boolean> => {
      if (!userId) return false;
      const hoje = getBrazilDate();
      const row = await upsert(userId, hoje, patch);
      if (!row) {
        toast(ERRO_SALVAR);
        return false;
      }
      setState(rowToState(row));
      return true;
    },
    [userId, upsert, toast],
  );

  const setAlvo = useCallback((n: number) => salvar({ alvo: round2(Math.max(0, n)) }), [salvar]);
  const setGuardado = useCallback((n: number) => salvar({ guardado: round2(Math.max(0, n)) }), [salvar]);
  const marcarSalvo = useCallback(
    (ultimoGuardei: UltimoGuardei) =>
      salvar({ salvo_em: new Date().toISOString(), ultimo_guardei: ultimoGuardei as unknown as Json }),
    [salvar],
  );
  const desfazerSalvo = useCallback(
    (guardado?: number) =>
      salvar({
        salvo_em: null,
        ultimo_guardei: null,
        ...(guardado != null ? { guardado: round2(Math.max(0, guardado)) } : {}),
      }),
    [salvar],
  );

  return {
    ...state,
    /** Re-reads today's row (used when the day rolls over while the app is open). */
    recarregar: carregar,
    setAlvo,
    setGuardado,
    marcarSalvo,
    desfazerSalvo,
  };
}
