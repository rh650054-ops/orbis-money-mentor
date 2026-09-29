/* ============================================================
   RAIO-X DO EXTRATO — dados da tela (Rick, 29/09/2026).

   O vendedor manda o extrato dos bancos que usa (pode ser mais de um por mês).
   A edge function `extrato-analisar` lê cada arquivo, categoriza e grava em
   `extrato_lancamentos`; aqui só lemos os RPCs que montam a tela e mandamos os
   arquivos, um por vez (cada leitura leva ~20s).
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

export interface RaioXCategoria {
  categoria: string; rotulo: string; icone: string; esfera: "corre" | "pessoal";
  total: number; qtd: number; pct: number; anterior: number;
}
export interface RaioXVilao {
  categoria: string; rotulo: string; icone: string; total: number; qtd: number; media: number; anterior: number;
  top_comerciante: string | null; top_total: number | null; top_qtd: number | null; madrugada: number;
}
export interface RaioXArquivo {
  id: string; banco: string | null; lancamentos: number; inicio: string | null; fim: string | null; origem: string; quando: string;
}
export interface RaioXResumo {
  mes: string; saiu: number; entrou: number; lancamentos: number; bancos: string[];
  corre: number; pessoal: number; nao_identificados: number;
  categorias: RaioXCategoria[]; viloes: RaioXVilao[]; arquivos: RaioXArquivo[];
}
export interface RaioXLancamento {
  id: string; data: string; hora: string | null; descricao: string; comerciante: string | null;
  valor: number; categoria: string; esfera: string; confianca: string; banco: string | null;
}
export interface RaioXMes { mes: string; lancamentos: number; bancos: string[] }
export interface RaioXCategoriaDef { slug: string; rotulo: string; icone: string; esfera_padrao: "corre" | "pessoal"; tipo: "saida" | "entrada"; ordem: number }

export interface UploadRetorno {
  ok: boolean; erro?: string; banco?: string | null; mes?: string; lidos?: number; novos?: number; repetidos?: number; jaLido?: boolean;
}

function fileToB64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^;]+;base64,/, ""));
    r.onerror = () => reject(new Error("read_error"));
    r.readAsDataURL(file);
  });
}

const n = (v: unknown) => Number(v) || 0;

function normalizaResumo(raw: unknown): RaioXResumo | null {
  const r = raw as Partial<RaioXResumo> | null;
  if (!r || typeof r !== "object" || !r.mes) return null;
  return {
    mes: String(r.mes), saiu: n(r.saiu), entrou: n(r.entrou), lancamentos: n(r.lancamentos),
    bancos: Array.isArray(r.bancos) ? r.bancos.map(String) : [],
    corre: n(r.corre), pessoal: n(r.pessoal), nao_identificados: n(r.nao_identificados),
    categorias: (Array.isArray(r.categorias) ? r.categorias : []).map((c) => ({ ...c, total: n(c.total), qtd: n(c.qtd), pct: n(c.pct), anterior: n(c.anterior) })),
    viloes: (Array.isArray(r.viloes) ? r.viloes : []).map((v) => ({ ...v, total: n(v.total), qtd: n(v.qtd), media: n(v.media), anterior: n(v.anterior), madrugada: n(v.madrugada), top_total: v.top_total == null ? null : n(v.top_total), top_qtd: v.top_qtd == null ? null : n(v.top_qtd) })),
    arquivos: Array.isArray(r.arquivos) ? r.arquivos : [],
  };
}

/** Meses que já têm extrato lido (pra entrada nas Finanças e pra barra de meses). */
export function useRaioXMeses(userId: string | undefined) {
  const [meses, setMeses] = useState<RaioXMes[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data, error } = await (supabase as any).rpc("extrato_meses");
      if (error) throw error;
      setMeses(((data ?? []) as any[]).map((m) => ({ mes: String(m.mes), lancamentos: n(m.lancamentos), bancos: Array.isArray(m.bancos) ? m.bancos.map(String) : [] })));
    } catch (e) { avisar.erro("RaioX: meses", e); }
    setLoading(false);
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);
  return { meses, loading, reload };
}

/** Resumo do mês (a tela inteira numa chamada) + ações. */
export function useRaioXExtrato(userId: string | undefined, mes: string | null) {
  const [resumo, setResumo] = useState<RaioXResumo | null>(null);
  const [categorias, setCategorias] = useState<RaioXCategoriaDef[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId || !mes) { setResumo(null); setLoading(false); return; }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc("extrato_resumo", { p_mes: mes });
      if (error) throw error;
      setResumo(normalizaResumo(data));
    } catch (e) { avisar.erro("RaioX: resumo", e); setResumo(null); }
    setLoading(false);
  }, [userId, mes]);
  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    let vivo = true;
    (supabase as any).from("extrato_categorias").select("slug,rotulo,icone,esfera_padrao,tipo,ordem").order("ordem")
      .then((r: { data: RaioXCategoriaDef[] | null }) => { if (vivo) setCategorias(r.data ?? []); })
      .catch((e: unknown) => avisar.erro("RaioX: categorias", e));
    return () => { vivo = false; };
  }, []);

  const lista = useCallback(async (categoria: string | null, tipo: "saida" | "entrada" = "saida"): Promise<RaioXLancamento[]> => {
    if (!mes) return [];
    try {
      const { data, error } = await (supabase as any).rpc("extrato_lista", { p_mes: mes, p_categoria: categoria, p_tipo: tipo });
      if (error) throw error;
      return ((data ?? []) as any[]).map((l) => ({ ...l, valor: n(l.valor), hora: l.hora ? String(l.hora).slice(0, 5) : null }));
    } catch (e) { avisar.erro("RaioX: lista", e); return []; }
  }, [mes]);

  // "Mover": corrige a categoria, ensina a regra e reaplica no mesmo comerciante.
  const mover = useCallback(async (id: string, categoria: string): Promise<number> => {
    try {
      const { data, error } = await (supabase as any).rpc("extrato_mover", { p_id: id, p_categoria: categoria });
      if (error) throw error;
      await reload();
      return n(data);
    } catch (e) { avisar.erro("RaioX: mover", e); return 0; }
  }, [reload]);

  const apagarArquivo = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any).rpc("extrato_apagar_arquivo", { p_id: id });
      if (error) throw error;
      await reload();
      return true;
    } catch (e) { avisar.erro("RaioX: apagar", e); return false; }
  }, [reload]);

  return { resumo, categorias, loading, reload, lista, mover, apagarArquivo };
}

/** Manda UM arquivo pra IA ler. A tela chama em sequência pra cada arquivo escolhido. */
export async function enviarExtrato(file: File): Promise<UploadRetorno> {
  try {
    if (file.size > 9_000_000) return { ok: false, erro: "Arquivo muito grande (máx. 9 MB). Manda o PDF do mês ou prints menores." };
    const b64 = await fileToB64(file);
    const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const { data, error } = await supabase.functions.invoke("extrato-analisar", { body: { file: b64, mime } });
    const res = data as { ok?: boolean; error?: string; dica?: string; banco?: string | null; mes?: string; lidos?: number; novos?: number; repetidos?: number; ja_lido?: boolean } | null;
    if (error || !res?.ok) {
      const msg = res?.dica
        ?? (res?.error === "limite_diario" ? "Você já mandou bastante extrato hoje. Volta amanhã."
          : "Não consegui ler esse arquivo. Tenta o PDF do mês ou um print mais nítido.");
      return { ok: false, erro: msg };
    }
    return { ok: true, banco: res.banco ?? null, mes: res.mes, lidos: n(res.lidos), novos: n(res.novos), repetidos: n(res.repetidos), jaLido: !!res.ja_lido };
  } catch (e) {
    avisar.erro("RaioX: enviar", e);
    return { ok: false, erro: "Não consegui enviar agora. Tenta de novo." };
  }
}
