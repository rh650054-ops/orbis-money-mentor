/* ============================================================
   PIX PELO BANCO — o que caiu na conta hoje (Open Finance / Pluggy).
   Uma fonte só pro DEFCON (linha discreta) e pro relatório (Pix travado).
   O servidor (pluggy-hora) lê o banco de hora em hora; aqui só lemos o
   resultado (banco_pix_do_dia). "Puxar agora" pede uma leitura na hora
   (pluggy-sync), com freio de 10 min por conexão lá no servidor.
   Sem banco ligado → temBanco=false e as telas simplesmente não mostram nada.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

export interface PixDoBanco {
  temBanco: boolean;
  banco: string | null;
  /** Pix de venda que caiu (contas de trabalho) */
  pix: number;
  /** entrada de maquininha ("Vendas" etc.) — também é venda que caiu (Rick, 09/10) */
  maquininha: number;
  /** pix + maquininha */
  total: number;
  qtd: number;
  ultimaSync: string | null;
  status: string | null;
  /** true = o Pix do relatório vem travado pelo banco. false = conta o lançado
   *  (Rick e Mohamed, até o Open Finance ser anunciado pra todos). */
  trava: boolean;
}

export const PIX_VAZIO: PixDoBanco = { temBanco: false, banco: null, pix: 0, maquininha: 0, total: 0, qtd: 0, ultimaSync: null, status: null, trava: true };

const num = (v: unknown) => Number(v) || 0;

/** O que caiu na conta no dia: Pix + maquininha (banco_entrou_do_dia, 09/10).
 *  Se a função nova ainda não existir no banco, cai pra banco_pix_do_dia. */
export async function carregarPixDoBanco(dia?: string): Promise<PixDoBanco> {
  const args = dia ? { p_dia: dia } : {};
  const novo = await (supabase as any).rpc("banco_entrou_do_dia", args);
  if (!novo.error) {
    const r = ((novo.data as any[]) || [])[0];
    if (!r) return PIX_VAZIO;
    return {
      temBanco: !!r.tem_banco, banco: r.banco ?? null,
      pix: num(r.pix), maquininha: num(r.maquininha), total: num(r.total), qtd: num(r.qtd),
      ultimaSync: r.ultima_sync ?? null, status: r.status ?? null, trava: r.trava !== false,
    };
  }
  const { data, error } = await (supabase as any).rpc("banco_pix_do_dia", args);
  if (error) { avisar.silencioso("banco_pix_do_dia", error); return PIX_VAZIO; }
  const r = ((data as any[]) || [])[0];
  if (!r) return PIX_VAZIO;
  return {
    temBanco: !!r.tem_banco, banco: r.banco ?? null,
    pix: num(r.total), maquininha: 0, total: num(r.total), qtd: num(r.qtd),
    ultimaSync: r.ultima_sync ?? null, status: r.status ?? null, trava: true,
  };
}

/** Abriu a tela (Finanças, Vender, Foco) com o banco lido há mais de 1 h: pede uma
 *  leitura da cota normal do dia (não da reserva do fim do Foco). */
export async function puxarBancoAoAbrir(): Promise<void> {
  try { await supabase.functions.invoke("pluggy-sync", { body: { motivo: "abrir" } }); }
  catch (e) { avisar.silencioso("pluggy-sync (abrir)", e); }
}

/** Pede pro servidor ler o banco agora. Não espera a Pluggy responder. */
export async function puxarBancoAgora(): Promise<void> {
  try { await supabase.functions.invoke("pluggy-sync", { body: {} }); }
  catch (e) { avisar.silencioso("pluggy-sync", e); }
}

/** "13:40" no fuso de Brasília. */
export const horaDaLeitura = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) : "";


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
