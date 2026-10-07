/* ============================================================
   PIX PELO BANCO — o que caiu na conta hoje (Open Finance / Pluggy).
   Uma fonte só pro DEFCON (linha discreta) e pro relatório (Pix travado).
   O servidor (pluggy-hora) lê o banco de hora em hora; aqui só lemos o
   resultado (banco_pix_do_dia). "Puxar agora" pede uma leitura na hora
   (pluggy-sync), com freio de 10 min por conexão lá no servidor.
   Sem banco ligado → temBanco=false e as telas simplesmente não mostram nada.
   Janela do DEFCON (06/10): o Pix conta a partir do INICIAR e segue contando
   pro mesmo dia até o próximo DEFCON começar (Pix atrasado entra sozinho).
   Pix que cai antes do INICIAR não entra. Regra no servidor: banco_pix_por_dia.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

export interface PixDoBanco {
  temBanco: boolean;
  banco: string | null;
  total: number;
  qtd: number;
  ultimaSync: string | null;
  status: string | null;
}

export const PIX_VAZIO: PixDoBanco = { temBanco: false, banco: null, total: 0, qtd: 0, ultimaSync: null, status: null };

export async function carregarPixDoBanco(dia?: string): Promise<PixDoBanco> {
  const { data, error } = await (supabase as any).rpc("banco_pix_do_dia", dia ? { p_dia: dia } : {});
  if (error) { avisar.silencioso("banco_pix_do_dia", error); return PIX_VAZIO; }
  const r = ((data as any[]) || [])[0];
  if (!r) return PIX_VAZIO;
  return {
    temBanco: !!r.tem_banco,
    banco: r.banco ?? null,
    total: Number(r.total) || 0,
    qtd: Number(r.qtd) || 0,
    ultimaSync: r.ultima_sync ?? null,
    status: r.status ?? null,
  };
}

/** Pede pro servidor ler o banco agora. Não espera a Pluggy responder. */
export async function puxarBancoAgora(): Promise<void> {
  try { await supabase.functions.invoke("pluggy-sync", { body: {} }); }
  catch (e) { avisar.silencioso("pluggy-sync", e); }
}

/** "13:40" no fuso de Brasília. */
export const horaDaLeitura = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";

/** Quando vem a próxima leitura do banco: a Pluggy libera 1 por hora por banco,
 *  e o robô (pluggy-hora) passa a cada 5 min — então ~65 min depois da última. */
export const proximaLeitura = (iso: string | null) =>
  iso ? horaDaLeitura(new Date(Date.parse(iso) + 65 * 60_000).toISOString()) : "";

/** Lê o Pix do banco e repete a cada `intervaloMs` (padrão 5 min). */
export function usePixDoBanco(ativo: boolean, intervaloMs = 5 * 60_000) {
  const [pix, setPix] = useState<PixDoBanco>(PIX_VAZIO);
  const recarregar = useCallback(async () => { setPix(await carregarPixDoBanco()); }, []);
  useEffect(() => {
    if (!ativo) return;
    void recarregar();
    const t = setInterval(() => { void recarregar(); }, intervaloMs);
    return () => clearInterval(t);
  }, [ativo, intervaloMs, recarregar]);
  return { pix, recarregar };
}

/** Quanto do Pix do banco entra na conta do dia: nunca mais do que falta pra
 *  fechar o vendido (o resto é Pix que caiu e não tinha venda lançada). */
export function pixQueEntraNoDia(pixBanco: number, vendido: number, dinheiro: number, cartao: number): { entra: number; aMais: number } {
  const espaco = Math.max(0, Math.round((vendido - dinheiro - cartao) * 100) / 100);
  const entra = Math.min(Math.max(0, pixBanco), espaco);
  return { entra, aMais: Math.round((Math.max(0, pixBanco) - entra) * 100) / 100 };
}
