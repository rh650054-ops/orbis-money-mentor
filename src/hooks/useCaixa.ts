/* ============================================================
   CAIXA DA VANT — dados do painel dos sócios (Rick, 30/09/2026).
   Tudo passa pelo RLS (só quem está em caixa_socios) e cada gravação
   cai em caixa_auditoria pelo trigger — aqui é só leitura e escrita simples.
   ============================================================ */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

export interface CaixaLancamento {
  id: string; data: string; tipo: "entrada" | "saida" | "ajuste"; valor: number; descricao: string; categoria: string;
  origem: string; status: "pago" | "a_pagar"; afeta_saldo: boolean; moeda_original: string | null; valor_original: number | null;
  cambio: number | null; influenciador_id: string | null; chave_externa: string | null; comprovante_url: string | null; obs: string | null;
  criado_por: string | null; criado_em: string;
}
export interface CaixaInfluenciador {
  id: string; nome: string; handle: string | null; tipo: "cache" | "comissao" | "permuta"; combinado: string | null; valor: number;
  periodicidade: "unico" | "mensal" | "por_video"; proximo_vencimento: string | null; pix_chave: string | null; cupom: string | null;
  status: "ativo" | "pausado" | "encerrado"; obs: string | null; pago_mes: number; pago_total: number;
}
export interface CaixaRecorrente { id: string; descricao: string; categoria: string; valor: number; dia: number; ativo: boolean; ultimo_lancado: string | null }
export interface CaixaIaProv { recargas_total: number; consumo_total: number; consumo_mes: number; consumo_7d: number; ultimo: string | null }
export interface CaixaDica { titulo: string; texto: string; acao?: string }
export interface CaixaResumo {
  mes: string; hoje: string; saldo: number; a_pagar: number; entrou: number; saiu: number; saiu_anterior: number; media_dia_30: number;
  categorias: { categoria: string; total: number; qtd: number; anterior: number }[];
  serie: { d: string; saldo: number; entrou: number; saiu: number }[];
  ia: { anthropic: CaixaIaProv; openai: CaixaIaProv };
  influenciadores: CaixaInfluenciador[];
  config: { cambio_usd?: number; tetos?: Record<string, number>; hotmart_a_receber?: number; ia_sync?: Record<string, unknown> };
  dicas: { geradas_em: string; dicas: CaixaDica[]; alertas: { nivel: string; texto: string }[]; fonte: string; app?: Record<string, number> } | null;
}

export interface CaixaVendas { qtd: number; liquido: number; estornos: number; aberto_em: string | null; assinantes: number; liquido_medio: number }
export interface CaixaAuditoria { id: number; quando: string; quem: string | null; tabela: string; registro_id: string | null; acao: string; antes: Record<string, unknown> | null; depois: Record<string, unknown> | null }

const n = (v: unknown) => Number(v) || 0;

export const CATEGORIAS: Record<string, { rotulo: string; icone: string; cor: string }> = {
  marketing: { rotulo: "Marketing / tráfego", icone: "📣", cor: "#FF5A45" },
  influenciador: { rotulo: "Influenciadores", icone: "🤝", cor: "#B07CFF" },
  ia: { rotulo: "IA (Anthropic / OpenAI)", icone: "🤖", cor: "#FFC800" },
  infra: { rotulo: "Infra (Supabase, Vercel, domínio)", icone: "🖥️", cor: "#4FA3FF" },
  open_finance: { rotulo: "Open Finance (Pluggy)", icone: "🔗", cor: "#4FA3FF" },
  premios: { rotulo: "Prêmios das competições", icone: "🏆", cor: "#FF8A3D" },
  ferramentas: { rotulo: "Ferramentas", icone: "🧰", cor: "#8a8378" },
  impostos: { rotulo: "Impostos / contador", icone: "📄", cor: "#8a8378" },
  retirada: { rotulo: "Retirada dos sócios", icone: "👤", cor: "#B07CFF" },
  vendas_hotmart: { rotulo: "Vendas Hotmart (líquido)", icone: "💚", cor: "#3DD68C" },
  estornos: { rotulo: "Reembolsos / chargeback", icone: "↩️", cor: "#FF5A45" },
  saque_hotmart: { rotulo: "Saque da Hotmart", icone: "💚", cor: "#3DD68C" },
  saldo_inicial: { rotulo: "Saldo inicial", icone: "🏁", cor: "#FFC800" },
  aporte: { rotulo: "Aporte dos sócios", icone: "➕", cor: "#3DD68C" },
  ajuste: { rotulo: "Ajuste de saldo", icone: "🛠️", cor: "#8a8378" },
  outros: { rotulo: "Outros", icone: "📎", cor: "#8a8378" },
};
export const catInfo = (slug: string) => CATEGORIAS[slug] ?? { rotulo: slug, icone: "📎", cor: "#8a8378" };

export function useCaixa(userId: string | undefined, mes: string | null) {
  const [resumo, setResumo] = useState<CaixaResumo | null>(null);
  const [lancamentos, setLancamentos] = useState<CaixaLancamento[]>([]);
  const [recorrentes, setRecorrentes] = useState<CaixaRecorrente[]>([]);
  const [socios, setSocios] = useState<Record<string, string>>({});
  const [vendas, setVendas] = useState<CaixaVendas | null>(null);
  const [auditoria, setAuditoria] = useState<CaixaAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const [r, l, rec, s, v, a] = await Promise.all([
        (supabase as any).rpc("caixa_resumo", { p_mes: mes }),
        (supabase as any).from("caixa_lancamentos").select("*").order("data", { ascending: false }).order("criado_em", { ascending: false }).limit(400),
        (supabase as any).from("caixa_recorrentes").select("*").order("dia"),
        (supabase as any).from("caixa_socios").select("user_id, nome"),
        (supabase as any).rpc("caixa_vendas", { p_mes: mes }),
        (supabase as any).from("caixa_auditoria").select("*").order("quando", { ascending: false }).limit(120),
      ]);
      if (r.error) throw r.error;
      const d = r.data as CaixaResumo;
      setResumo({ ...d, saldo: n(d.saldo), a_pagar: n(d.a_pagar), entrou: n(d.entrou), saiu: n(d.saiu), saiu_anterior: n(d.saiu_anterior), media_dia_30: n(d.media_dia_30),
        categorias: (d.categorias ?? []).map((c) => ({ ...c, total: n(c.total), qtd: n(c.qtd), anterior: n(c.anterior) })),
        serie: (d.serie ?? []).map((p) => ({ ...p, saldo: n(p.saldo), entrou: n(p.entrou), saiu: n(p.saiu) })),
        influenciadores: (d.influenciadores ?? []).map((i) => ({ ...i, valor: n(i.valor), pago_mes: n(i.pago_mes), pago_total: n(i.pago_total) })) });
      setLancamentos(((l.data ?? []) as CaixaLancamento[]).map((x) => ({ ...x, valor: n(x.valor) })));
      setRecorrentes(((rec.data ?? []) as CaixaRecorrente[]).map((x) => ({ ...x, valor: n(x.valor) })));
      const m: Record<string, string> = {};
      for (const x of (s.data ?? []) as { user_id: string; nome: string }[]) m[x.user_id] = x.nome;
      setSocios(m);
      const vd = (v.data ?? null) as CaixaVendas | null;
      setVendas(vd ? { ...vd, qtd: n(vd.qtd), liquido: n(vd.liquido), estornos: n(vd.estornos), assinantes: n(vd.assinantes), liquido_medio: n(vd.liquido_medio) || 24.45 } : null);
      setAuditoria((a.data ?? []) as CaixaAuditoria[]);
      setErro(null);
    } catch (e) {
      avisar.erro("Caixa: carregar", e);
      setErro("Não consegui carregar o caixa. Recarrega a página.");
    }
    setLoading(false);
  }, [userId, mes]);
  useEffect(() => { reload(); }, [reload]);

  const lancar = useCallback(async (l: Partial<CaixaLancamento> & { valor: number; descricao: string; tipo: CaixaLancamento["tipo"] }) => {
    const { error } = await (supabase as any).from("caixa_lancamentos").insert({ ...l, criado_por: userId });
    if (error) { avisar.usuario("Não consegui lançar. Tenta de novo.", error, "Caixa: lançar"); return false; }
    await reload(); return true;
  }, [userId, reload]);

  const editarLancamento = useCallback(async (id: string, patch: Partial<CaixaLancamento>) => {
    const { error } = await (supabase as any).from("caixa_lancamentos").update(patch).eq("id", id);
    if (error) { avisar.usuario("Não consegui salvar.", error, "Caixa: editar"); return false; }
    await reload(); return true;
  }, [reload]);

  const apagarLancamento = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from("caixa_lancamentos").delete().eq("id", id);
    if (error) { avisar.usuario("Não consegui apagar.", error, "Caixa: apagar"); return false; }
    await reload(); return true;
  }, [reload]);

  const ajustarSaldo = useCallback(async (novo: number, motivo: string) => {
    const { error } = await (supabase as any).rpc("caixa_ajustar_saldo", { p_novo_saldo: novo, p_motivo: motivo });
    if (error) { avisar.usuario("Não consegui ajustar.", error, "Caixa: ajustar saldo"); return false; }
    await reload(); return true;
  }, [reload]);

  const syncHotmart = useCallback(async (disponivel: number, receber: number, ajustar: boolean) => {
    const { error } = await (supabase as any).rpc("caixa_sync_hotmart", { p_disponivel: disponivel, p_receber: receber, p_ajustar: ajustar });
    if (error) { avisar.usuario("Não consegui atualizar com a Hotmart.", error, "Caixa: hotmart"); return false; }
    await reload(); return true;
  }, [reload]);

  // Paga o combinado do influenciador: vira saída no extrato e empurra o próximo vencimento.
  const pagarInfluenciador = useCallback(async (i: CaixaInfluenciador, valor: number, data: string) => {
    const { error } = await (supabase as any).from("caixa_lancamentos").insert({
      data, tipo: "saida", valor: -Math.abs(valor), descricao: `Pagamento ${i.nome}${i.combinado ? ` — ${i.combinado}` : ""}`.slice(0, 200),
      categoria: "influenciador", origem: "influenciador", status: "pago", influenciador_id: i.id, criado_por: userId });
    if (error) { avisar.usuario("Não consegui registrar o pagamento.", error, "Caixa: pagar influenciador"); return false; }
    if (i.periodicidade === "mensal" && i.proximo_vencimento) {
      const d = new Date(`${i.proximo_vencimento}T12:00:00`); d.setMonth(d.getMonth() + 1);
      await (supabase as any).from("caixa_influenciadores").update({ proximo_vencimento: d.toISOString().slice(0, 10) }).eq("id", i.id);
    } else if (i.periodicidade === "unico") {
      await (supabase as any).from("caixa_influenciadores").update({ status: "encerrado" }).eq("id", i.id);
    }
    await reload(); return true;
  }, [userId, reload]);

  const salvarInfluenciador = useCallback(async (i: Partial<CaixaInfluenciador> & { nome: string }) => {
    const { id, pago_mes: _pm, pago_total: _pt, ...rest } = i as CaixaInfluenciador;
    const q = id ? (supabase as any).from("caixa_influenciadores").update(rest).eq("id", id)
      : (supabase as any).from("caixa_influenciadores").insert({ ...rest, criado_por: userId });
    const { error } = await q;
    if (error) { avisar.usuario("Não consegui salvar.", error, "Caixa: influenciador"); return false; }
    await reload(); return true;
  }, [userId, reload]);

  const salvarRecorrente = useCallback(async (r: Partial<CaixaRecorrente> & { descricao: string; valor: number; dia: number }) => {
    const { id, ...rest } = r as CaixaRecorrente;
    const q = id ? (supabase as any).from("caixa_recorrentes").update(rest).eq("id", id)
      : (supabase as any).from("caixa_recorrentes").insert({ ...rest, criado_por: userId });
    const { error } = await q;
    if (error) { avisar.usuario("Não consegui salvar.", error, "Caixa: recorrente"); return false; }
    await (supabase as any).rpc("caixa_lancar_recorrentes");
    await reload(); return true;
  }, [userId, reload]);

  const salvarConfig = useCallback(async (chave: string, valor: unknown) => {
    const { error } = await (supabase as any).from("caixa_config").upsert({ chave, valor, atualizado_por: userId, atualizado_em: new Date().toISOString() });
    if (error) { avisar.usuario("Não consegui salvar.", error, "Caixa: config"); return false; }
    await reload(); return true;
  }, [userId, reload]);

  const sincronizar = useCallback(async (acao: "ia" | "dicas") => {
    const { data, error } = await supabase.functions.invoke("caixa-sync", { body: { acao } });
    if (error || !(data as { ok?: boolean })?.ok) { avisar.erro("Caixa: sync " + acao, error ?? data); return null; }
    await reload(); return data as Record<string, unknown>;
  }, [reload]);

  const subirComprovante = useCallback(async (file: File): Promise<string | null> => {
    const nome = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
    const { error } = await supabase.storage.from("caixa-comprovantes").upload(nome, file, { upsert: false });
    if (error) { avisar.usuario("Não consegui anexar o comprovante.", error, "Caixa: comprovante"); return null; }
    return nome;
  }, []);

  const linkComprovante = useCallback(async (path: string): Promise<string | null> => {
    const { data } = await supabase.storage.from("caixa-comprovantes").createSignedUrl(path, 600);
    return data?.signedUrl ?? null;
  }, []);

  return { resumo, lancamentos, recorrentes, socios, vendas, auditoria, loading, erro, reload, lancar, editarLancamento, apagarLancamento, ajustarSaldo,
    syncHotmart, pagarInfluenciador, salvarInfluenciador, salvarRecorrente, salvarConfig, sincronizar, subirComprovante, linkComprovante };
}
