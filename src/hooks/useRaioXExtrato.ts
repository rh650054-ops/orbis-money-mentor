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
export interface RaioXConta { banco: string; uso: "vendas" | "pessoal"; auto: boolean; saiu: number; entrou: number; qtd: number }
export interface RaioXRecorrente { chave: string; nome: string; categoria: string; total: number; qtd: number }
export interface RaioXResumo {
  mes: string; saiu: number; entrou: number; lancamentos: number; bancos: string[];
  corre: number; pessoal: number; nao_identificados: number;
  /** Dinheiro que só mudou de lugar (entre contas do mesmo dono) — fora dos totais. */
  entre_contas: { saiu: number; entrou: number; qtd: number; pares: number };
  /** Pagamento de fatura de cartão. detalhada = a fatura do cartão foi enviada (aí não conta de novo). */
  fatura: { total: number; detalhada: boolean };
  vendas: number; vendas_qtd: number; manuais: number; perguntas: number;
  contas: RaioXConta[]; recorrentes: RaioXRecorrente[];
  categorias: RaioXCategoria[]; viloes: RaioXVilao[]; arquivos: RaioXArquivo[];
}
export interface RaioXLancamento {
  id: string; data: string; hora: string | null; descricao: string; comerciante: string | null;
  valor: number; categoria: string; esfera: string; confianca: string; banco: string | null;
  tipo: "saida" | "entrada"; movimento: "normal" | "entre_contas" | "fatura"; recorrente: boolean;
  origem: "arquivo" | "manual" | "pluggy"; par_banco: string | null;
}
export interface RaioXMes { mes: string; lancamentos: number; bancos: string[] }
export interface RaioXCategoriaDef { slug: string; rotulo: string; icone: string; esfera_padrao: "corre" | "pessoal"; tipo: "saida" | "entrada"; ordem: number }

export interface UploadRetorno {
  ok: boolean; erro?: string; banco?: string | null; titular?: string | null; mes?: string; lidos?: number; novos?: number; repetidos?: number; jaLido?: boolean;
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
    entre_contas: { saiu: n(r.entre_contas?.saiu), entrou: n(r.entre_contas?.entrou), qtd: n(r.entre_contas?.qtd), pares: n(r.entre_contas?.pares) },
    fatura: { total: n(r.fatura?.total), detalhada: !!r.fatura?.detalhada },
    vendas: n(r.vendas), vendas_qtd: n(r.vendas_qtd), manuais: n(r.manuais), perguntas: n(r.perguntas),
    contas: (Array.isArray(r.contas) ? r.contas : []).map((c) => ({ ...c, saiu: n(c.saiu), entrou: n(c.entrou), qtd: n(c.qtd) })),
    recorrentes: (Array.isArray(r.recorrentes) ? r.recorrentes : []).map((x) => ({ ...x, total: n(x.total), qtd: n(x.qtd) })),
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

  const lista = useCallback(async (categoria: string | null, tipo: "saida" | "entrada" | null = "saida"): Promise<RaioXLancamento[]> => {
    if (!mes) return [];
    try {
      const { data, error } = await (supabase as any).rpc("extrato_lista", { p_mes: mes, p_categoria: categoria, p_tipo: tipo });
      if (error) throw error;
      return ((data ?? []) as any[]).map((l) => ({ ...l, valor: n(l.valor), hora: l.hora ? String(l.hora).slice(0, 5) : null, recorrente: !!l.recorrente }));
    } catch (e) { avisar.erro("RaioX: lista", e); return []; }
  }, [mes]);

  // "Mover": corrige a categoria, ensina a regra e reaplica no mesmo comerciante.
  // soEste: move SÓ esse lançamento e trava ele (Pix pra pessoa varia de motivo).
  const mover = useCallback(async (id: string, categoria: string, soEste = false): Promise<number> => {
    try {
      const { data, error } = soEste
        ? await (supabase as any).rpc("extrato_mover_um", { p_id: id, p_categoria: categoria })
        : await (supabase as any).rpc("extrato_mover", { p_id: id, p_categoria: categoria });
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

/** Progresso do envio de um arquivo (usado quando o PDF é quebrado em partes). */
export interface EnvioProgresso { parte: number; total: number }

interface RespostaFn { ok?: boolean; error?: string; dica?: string; banco?: string | null; titular?: string | null; mes?: string; lidos?: number; novos?: number; repetidos?: number; ja_lido?: boolean }
/** Banco/titular lidos na parte 1 — as páginas seguintes do PDF não repetem o cabeçalho. */
interface Dicas { banco?: string | null; titular?: string | null }

function mensagemErro(res: RespostaFn | null): string {
  if (res?.dica) return res.dica;
  switch (res?.error) {
    case "limite_diario": return "Você já mandou bastante extrato hoje. Volta amanhã.";
    case "leitura_indisponivel": case "sem_chave_ia": case "trava_indisponivel":
      return "O leitor de extratos está fora do ar agora. Seu arquivo não foi perdido — tenta de novo mais tarde.";
    default: return "Não consegui ler esse arquivo. Tenta o PDF do mês ou um print mais nítido.";
  }
}

/** Manda UM pedaço (imagem, ou PDF já cortado) pra IA ler. */
async function enviarParte(file: File, dicas: Dicas = {}): Promise<UploadRetorno> {
  try {
    if (file.size > 9_000_000) return { ok: false, erro: "Arquivo muito grande (máx. 9 MB). Manda o PDF do mês ou prints menores." };
    const b64 = await fileToB64(file);
    const mime = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    const { data, error } = await supabase.functions.invoke("extrato-analisar", {
      body: { file: b64, mime, banco_hint: dicas.banco ?? null, titular_hint: dicas.titular ?? null },
    });
    const res = data as RespostaFn | null;
    if (error || !res?.ok) return { ok: false, erro: mensagemErro(res) };
    return { ok: true, banco: res.banco ?? null, titular: res.titular ?? null, mes: res.mes, lidos: n(res.lidos), novos: n(res.novos), repetidos: n(res.repetidos), jaLido: !!res.ja_lido };
  } catch (e) {
    avisar.erro("RaioX: enviar", e);
    return { ok: false, erro: "Não consegui enviar agora. Tenta de novo." };
  }
}

/**
 * Manda UM arquivo pra IA ler. PDF grande (extrato de vários meses / um ano
 * inteiro) é cortado em partes de poucas páginas no aparelho e cada parte vai
 * separada — assim a IA nunca estoura o limite e nada fica de fora.
 * Devolve o somatório das partes; `meses` lista todos os meses tocados.
 */
export async function enviarExtrato(file: File, onProgresso?: (p: EnvioProgresso) => void): Promise<UploadRetorno & { meses?: string[] }> {
  const ehPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!ehPdf) return enviarParte(file);

  const { dividirPdf } = await import("@/shared/lib/pdf-split");
  const partes = await dividirPdf(file);
  if (partes.length === 1) return enviarParte(partes[0]!.file);

  let lidos = 0, novos = 0, repetidos = 0, okCount = 0, banco: string | null = null, titular: string | null = null, ultimoErro = "";
  const meses = new Set<string>();
  for (const p of partes) {
    onProgresso?.({ parte: p.parte, total: p.total });
    const r = await enviarParte(p.file, { banco, titular });
    if (r.ok) {
      okCount++; lidos += n(r.lidos); novos += n(r.novos); repetidos += n(r.repetidos);
      if (r.mes) meses.add(r.mes);
      if (!banco && r.banco) banco = r.banco;
      if (!titular && r.titular) titular = r.titular;
    } else {
      ultimoErro = r.erro ?? "";
      // Sem IA disponível, não adianta insistir nas outras partes.
      if (/fora do ar|bastante extrato hoje/.test(ultimoErro)) break;
    }
  }
  if (okCount === 0) return { ok: false, erro: ultimoErro || "Não consegui ler esse arquivo." };
  const falhas = partes.length - okCount;
  const mesesArr = [...meses].sort();
  return { ok: true, banco, mes: mesesArr[mesesArr.length - 1], meses: mesesArr, lidos, novos, repetidos, jaLido: false,
    ...(falhas > 0 ? { erro: `${falhas} parte${falhas === 1 ? "" : "s"} não deu pra ler` } : {}) };
}
