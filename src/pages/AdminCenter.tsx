import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { toast } from "@/shared/hooks/use-toast";
import {
  ArrowLeft, ShieldCheck, Trophy, Eye, Loader2, Sparkles, ChevronRight,
  Users, CreditCard, Brain, ShieldAlert, FileCog, Swords,
} from "lucide-react";

// ============================================================================
// CENTRAL DE ADMINISTRAÇÃO DO ORBIS — acessível só pelo Perfil, só pra admins.
// Tudo que era painel de admin espalhado na aba X1 mora aqui:
//   🏦 Tesouraria (só Rick e Mohamed — o banco barra o resto via x1_tesouraria)
//   ⚔️ Revisões de duelos (conferir pagamento, ver comprovante, premiar vencedor
//      com extrato verificado + parecer da IA)
//   📋 Depósitos (fila pendente de conferência + últimos auto-creditados)
//   💰 Carteiras (creditar/debitar saldo de qualquer vendedor)
//   🏁 Liquidação manual (roda sozinha às 9h05; botão pra forçar agora)
//   🔗 Atalhos pras outras áreas de admin já existentes
// A segurança REAL está no banco (RLS/RPCs) — esta tela é só a interface.
// ============================================================================

interface Challenge {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  scheduled_date: string | null;
  goal_amount: number | null;
  stakes_amount: number;
  fee_amount: number;
  prize_amount: number;
  challenger_paid: boolean;
  opponent_paid: boolean;
  modo: string | null;
  challenger_proof_url: string | null;
  opponent_proof_url: string | null;
}
interface RankUser {
  user_id: string;
  nome_usuario: string | null;
  avatar_url: string | null;
}

const TESOURARIA_UIDS = ["79312077-3496-44b0-b543-4c9f81425425", "e38b0499-abbc-439d-b592-c8cac4c83741"];
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const dateBR = (iso: string | null) => {
  if (!iso) return "a combinar";
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return iso;
  }
};
const dtBR = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Outras áreas de admin que já existem no app — atalhos num lugar só.
const OUTRAS_AREAS = [
  { icon: Users, label: "CRM — Funil de vendas", desc: "Trial, relacionamento, inadimplentes e leads por parceiro", path: "/crm.html" },
  { icon: Swords, label: "Competições", desc: "Criar e gerenciar competições", path: "/admin/competitions" },
  { icon: Users, label: "Usuários demo", desc: "Contas de demonstração", path: "/admin/demo-users" },
  { icon: CreditCard, label: "Assinaturas", desc: "Planos e pagamentos", path: "/admin/subscriptions" },
  { icon: Brain, label: "Cérebro da IA", desc: "Configurar a IA do app", path: "/admin/ai-brain" },
  { icon: ShieldAlert, label: "Anti-trapaça", desc: "Análise de anomalias", path: "/admin/anti-trapaca" },
  { icon: FileCog, label: "Config. de extrato", desc: "Regras da verificação", path: "/admin/extrato-config" },
];

// Ferramentas de teste/simulação — antes ficavam soltas no Minha Conta.
const TESTES = [
  { icon: FileCog, label: "Teste · Extrato", desc: "Simular upload de extrato", path: "/admin/teste-extrato" },
  { icon: Trophy, label: "Bilhete dourado", desc: "Testar o bilhete dourado", path: "/?bilhete-teste=1" },
  { icon: Eye, label: "Ranking (simulador)", desc: "Simular o ranking", path: "/admin/teste-ranking" },
];

export default function AdminCenter() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { whitelisted, role, loading: adminLoading } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";
  const podeVerTesouraria = !!user && TESOURARIA_UIDS.includes(user.id);

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Record<string, RankUser>>({});

  // Revisões: duelos que precisam de ação do admin.
  const [revisoes, setRevisoes] = useState<Challenge[]>([]);
  // Extrato verificado (IA) por duelista|dia — evidência pra premiar.
  const [extratos, setExtratos] = useState<Record<string, { total: number; qtd: number }>>({});
  const [aiById, setAiById] = useState<Record<string, { loading?: boolean; suspeito?: boolean; score?: number; motivo?: string; erro?: string }>>({});

  // Tesouraria.
  const [tesouraria, setTesouraria] = useState<null | {
    total_devido: number; depositos: number; saques: number; em_jogo: number;
    premios_pagos: number; taxas: number;
    por_usuario: { user_id: string; nome: string; saldo: number }[];
  }>(null);

  // Depósitos.
  const [depsPendentes, setDepsPendentes] = useState<{ id: string; user_id: string; valor: number; motivo: string | null; remetente: string | null; created_at: string; nome?: string }[]>([]);
  const [depsRecentes, setDepsRecentes] = useState<{ id: string; user_id: string; valor: number; e2e_id: string | null; remetente: string | null; created_at: string; nome?: string }[]>([]);

  // Saques: o valor já foi RESERVADO (debitado) no pedido — aqui é só enviar o
  // Pix pra chave do usuário e marcar "pago" (ou rejeitar, que devolve o valor).
  const [saques, setSaques] = useState<{ id: string; user_id: string; valor: number; pix_key: string; pix_nome: string | null; created_at: string; nome?: string }[]>([]);

  // Carteiras.
  const [admWallet, setAdmWallet] = useState({ busca: "", achados: [] as RankUser[], sel: null as RankUser | null, valor: "", tipo: "deposito" as "deposito" | "saque" });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const name = (uid: string) => profiles[uid]?.nome_usuario || "Vendedor";

  const loadAll = async () => {
    if (!user || !isAdmin) return;
    setLoading(true);

    // Duelos que pedem revisão: pagamento a conferir OU vencedor a definir.
    const { data: rows } = await supabase
      .from("x1_challenges" as any)
      .select("id, challenger_id, opponent_id, status, scheduled_date, goal_amount, stakes_amount, fee_amount, prize_amount, challenger_paid, opponent_paid, modo, challenger_proof_url, opponent_proof_url")
      .in("status", ["accepted", "active", "awaiting_result"])
      .order("scheduled_date", { ascending: true });
    const chs = ((rows as any[]) || []) as Challenge[];
    setRevisoes(chs);

    const uids = Array.from(new Set(chs.flatMap((c) => [c.challenger_id, c.opponent_id])));
    if (uids.length) {
      const { data: profs } = await supabase.from("public_profiles").select("user_id, nickname, avatar_url").in("user_id", uids);
      const map: Record<string, RankUser> = {};
      ((profs as any[]) || []).forEach((p) => (map[p.user_id] = { user_id: p.user_id, nome_usuario: p.nickname, avatar_url: p.avatar_url }));
      setProfiles(map);
    }

    // Evidência: extrato verificado dos duelistas nos dias relevantes.
    const relev = chs.filter((c) => c.scheduled_date && (c.status === "active" || c.status === "awaiting_result"));
    if (relev.length) {
      const ruids = Array.from(new Set(relev.flatMap((c) => [c.challenger_id, c.opponent_id])));
      const dias = Array.from(new Set(relev.map((c) => c.scheduled_date))) as string[];
      const { data: ex } = await supabase
        .from("extrato_uploads")
        .select("user_id, dia, total_verificado, qtd_vendas")
        .in("user_id", ruids)
        .in("dia", dias);
      const em: Record<string, { total: number; qtd: number }> = {};
      ((ex as any[]) || []).forEach((r) => {
        const k = `${r.user_id}|${r.dia}`;
        if (!em[k]) em[k] = { total: 0, qtd: 0 };
        em[k].total += Number(r.total_verificado) || 0;
        em[k].qtd += Number(r.qtd_vendas) || 0;
      });
      setExtratos(em);
    } else {
      setExtratos({});
    }

    // Tesouraria (o banco barra quem não for Rick/Mohamed).
    if (podeVerTesouraria) {
      const { data: tes } = await (supabase as any).rpc("x1_tesouraria");
      if (tes) setTesouraria(tes as any);
    }

    // Depósitos (fila pendente + auto-creditados recentes) e SAQUES pendentes.
    const [{ data: pend }, { data: rec }, { data: wds }] = await Promise.all([
      supabase.from("x1_deposit_requests" as any).select("id, user_id, valor, motivo, remetente, created_at").eq("status", "pendente_revisao").order("created_at", { ascending: true }),
      supabase.from("x1_deposit_requests" as any).select("id, user_id, valor, e2e_id, remetente, created_at").eq("status", "creditado").order("created_at", { ascending: false }).limit(8),
      supabase.from("x1_withdraw_requests" as any).select("id, user_id, valor, pix_key, pix_nome, created_at").eq("status", "pendente").order("created_at", { ascending: true }),
    ]);
    const todos = [...(((pend as any[]) || [])), ...(((rec as any[]) || [])), ...(((wds as any[]) || []))];
    const uidsDep = Array.from(new Set(todos.map((d) => d.user_id)));
    let nomes: Record<string, string> = {};
    if (uidsDep.length) {
      const { data: pf } = await supabase.from("public_profiles").select("user_id, nickname").in("user_id", uidsDep);
      ((pf as any[]) || []).forEach((p) => (nomes[p.user_id] = p.nickname));
    }
    setDepsPendentes((((pend as any[]) || [])).map((d) => ({ ...d, nome: nomes[d.user_id] })));
    setDepsRecentes((((rec as any[]) || [])).map((d) => ({ ...d, nome: nomes[d.user_id] })));
    setSaques((((wds as any[]) || [])).map((d) => ({ ...d, nome: nomes[d.user_id] })));

    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin]);

  const rpc = async (fn: string, args: Record<string, unknown>, okMsg: string) => {
    const { error } = await (supabase as any).rpc(fn, args);
    if (error) {
      toast({ title: "Não rolou", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: okMsg });
    loadAll();
  };

  const adminConfirmPayment = (id: string) => rpc("x1_admin_confirm_payment", { p_id: id }, "Pagamentos confirmados — duelo liberado");
  const setWinner = (c: Challenge, winner: string) =>
    rpc(
      "x1_admin_set_result",
      { p_id: c.id, p_winner: winner, p_challenger_score: null, p_opponent_score: null, p_prize: c.prize_amount, p_fee: c.fee_amount, p_notes: "" },
      "Resultado salvo! 🏆",
    );
  const admLiquidarAgora = () => rpc("x1_settle_due", {}, "Liquidação executada — confere os resultados 🏁");
  const admResolverDeposito = (id: string, aprovar: boolean) =>
    rpc("x1_admin_resolve_deposit", { p_id: id, p_aprovar: aprovar, p_motivo: aprovar ? null : "não localizado no banco" }, aprovar ? "Depósito creditado ✅" : "Depósito rejeitado");
  // Saque: "pago" mantém o débito (você JÁ enviou o Pix); "rejeitado" devolve o valor.
  const admResolverSaque = (id: string, acao: "pago" | "rejeitado") =>
    rpc("x1_admin_resolve_withdraw", { p_id: id, p_acao: acao, p_motivo: acao === "rejeitado" ? "rejeitado pelo admin" : null }, acao === "pago" ? "Saque marcado como pago 💸" : "Saque rejeitado — valor devolvido ao saldo");

  const viewProof = async (path: string | null) => {
    if (!path) return;
    const { data } = await supabase.storage.from("x1-proofs").createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast({ title: "Não consegui abrir o comprovante", variant: "destructive" });
  };

  const analisarIA = async (uid: string) => {
    setAiById((a) => ({ ...a, [uid]: { loading: true } }));
    try {
      const { data, error } = await supabase.functions.invoke("analisar-anomalia", { body: { user_id: uid } });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      setAiById((a) => ({ ...a, [uid]: { suspeito: !!r.suspeito, score: Number(r.score ?? 0), motivo: r.motivo || "" } }));
    } catch (e: any) {
      setAiById((a) => ({ ...a, [uid]: { erro: e?.message || "Falhou — tenta de novo." } }));
    }
  };

  const admBuscar = async (q: string) => {
    setAdmWallet((s) => ({ ...s, busca: q, sel: null }));
    if (q.trim().length < 2) {
      setAdmWallet((s) => ({ ...s, achados: [] }));
      return;
    }
    const { data } = await supabase.from("public_profiles").select("user_id, nickname, avatar_url").ilike("nickname", `%${q.trim()}%`).limit(5);
    setAdmWallet((s) => ({ ...s, achados: (((data as any[]) || []).map((p) => ({ user_id: p.user_id, nome_usuario: p.nickname, avatar_url: p.avatar_url })) as RankUser[]) }));
  };
  const admMoverCarteira = async () => {
    const v = Number(admWallet.valor);
    if (!admWallet.sel || !v || v <= 0) {
      toast({ title: "Escolhe o vendedor e um valor válido", variant: "destructive" });
      return;
    }
    await rpc(
      "x1_admin_wallet_move",
      { p_user: admWallet.sel.user_id, p_amount: v, p_tipo: admWallet.tipo, p_notes: `${admWallet.tipo} via central de admin` },
      admWallet.tipo === "deposito" ? `Crédito de ${fmt(v)} pra ${admWallet.sel.nome_usuario} ✅` : `Saque de ${fmt(v)} registrado ✅`,
    );
    setAdmWallet({ busca: "", achados: [], sel: null, valor: "", tipo: "deposito" });
  };

  // Evidência de um duelista: extrato verificado + parecer da IA sob demanda.
  const evidenceRow = (c: Challenge, uid: string) => {
    const e = extratos[`${uid}|${c.scheduled_date}`];
    const hitGoal = c.goal_amount != null && e != null && e.total >= c.goal_amount;
    const ai = aiById[uid];
    return (
      <div key={uid} className="rounded-lg bg-card border border-border/60 px-2.5 py-1.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground truncate">{name(uid)}</span>
          <span className="text-xs font-black tabular-nums shrink-0" style={{ color: e ? "#22c55e" : "#6b7280" }}>
            {e ? fmt(e.total) : "sem extrato"}{hitGoal ? " · ✓ meta" : ""}
          </span>
        </div>
        <button
          onClick={() => analisarIA(uid)}
          disabled={ai?.loading}
          className="w-full h-7 rounded-md bg-primary/10 border border-primary/40 text-primary text-[11px] font-bold inline-flex items-center justify-center gap-1 disabled:opacity-60"
        >
          {ai?.loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Analisar com IA
        </button>
        {ai && !ai.loading &&
          (ai.erro ? (
            <p className="text-[10px] text-red-400">Erro: {ai.erro}</p>
          ) : (
            <p className="text-[10px] leading-snug" style={{ color: (ai.score ?? 0) >= 60 ? "#f87171" : "#4ade80" }}>
              IA: {ai.suspeito ? "🚩 Suspeito" : "✅ Normal"} · {ai.score} — <span className="text-muted-foreground">{ai.motivo}</span>
            </p>
          ))}
      </div>
    );
  };

  // ---- guarda de acesso ----
  if (authLoading || adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="text-center py-20 px-6 max-w-2xl mx-auto">
        <p className="text-5xl mb-3">🔒</p>
        <p className="text-foreground font-bold">Área restrita</p>
        <p className="text-sm text-muted-foreground mt-1">Só administradores do Orbis entram aqui.</p>
        <button onClick={() => navigate("/profile")} className="mt-6 h-11 px-6 rounded-xl bg-card border border-border text-sm font-bold text-foreground active:scale-95 transition-transform">
          Voltar ao perfil
        </button>
      </div>
    );
  }

  const hoje = getBrazilDate();
  const revAcc = revisoes.filter((c) => c.status === "accepted" && c.stakes_amount > 0);
  const revWin = revisoes.filter((c) => c.status === "awaiting_result" || (c.status === "active" && (c.scheduled_date ?? "") < hoje));
  const revAtivos = revisoes.filter((c) => c.status === "active" && c.scheduled_date === hoje);

  return (
    <div className="pb-24 px-4 pt-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/profile")} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/40">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-violet-400" /> Administração
        </h1>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">Central de controle do Orbis — só admins veem esta tela.</p>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-card/40 border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ===== 🏦 Tesouraria (só Rick e Mohamed) ===== */}
          {podeVerTesouraria && tesouraria && (
            <div className="rounded-2xl border border-violet-500/40 bg-violet-500/5 p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-violet-400">🏦 Tesouraria X1 · confidencial</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-card border border-border/60 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Devido aos usuários</p>
                  <p className="text-xl font-black text-foreground tabular-nums">{fmt(tesouraria.total_devido)}</p>
                  <p className="text-[9px] text-muted-foreground/70">tem que ter isso na conta Pix do Orbis</p>
                </div>
                <div className="rounded-xl bg-card border border-border/60 p-3">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold">Taxas acumuladas</p>
                  <p className="text-xl font-black text-emerald-400 tabular-nums">{fmt(tesouraria.taxas)}</p>
                  <p className="text-[9px] text-muted-foreground/70">isso é do Orbis 💰</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                <span className="text-muted-foreground">Depósitos totais</span><span className="text-right font-bold tabular-nums text-foreground">{fmt(tesouraria.depositos)}</span>
                <span className="text-muted-foreground">Saques totais</span><span className="text-right font-bold tabular-nums text-foreground">{fmt(tesouraria.saques)}</span>
                <span className="text-muted-foreground">Em jogo agora (duelos ativos)</span><span className="text-right font-bold tabular-nums text-amber-400">{fmt(tesouraria.em_jogo)}</span>
                <span className="text-muted-foreground">Prêmios já pagos</span><span className="text-right font-bold tabular-nums text-foreground">{fmt(tesouraria.premios_pagos)}</span>
              </div>
              {tesouraria.por_usuario.length > 0 && (
                <div className="space-y-1 pt-1 border-t border-border/40">
                  <p className="text-[10px] uppercase text-muted-foreground font-bold pt-1">Saldo por usuário</p>
                  {tesouraria.por_usuario.map((u) => (
                    <div key={u.user_id} className="flex items-center justify-between text-[11px]">
                      <span className="text-foreground truncate">{u.nome}</span>
                      <span className="font-bold tabular-nums text-emerald-400 shrink-0">{fmt(u.saldo)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== ⚔️ Revisões de duelos ===== */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-wider text-primary">⚔️ Revisões de duelos</p>

            {revAcc.length === 0 && revWin.length === 0 && revAtivos.length === 0 && (
              <p className="text-xs text-muted-foreground">Nada pendente — nenhum duelo esperando revisão. 🏖️</p>
            )}

            {/* Pagamentos a conferir (fluxo por comprovante) */}
            {revAcc.map((c) => (
              <div key={c.id} className="rounded-xl bg-card border border-amber-500/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-foreground truncate">
                    {name(c.challenger_id)} <span className="text-muted-foreground">VS</span> {name(c.opponent_id)}
                  </p>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ background: "#2a1a05", color: "#f59e0b" }}>
                    💰 conferir pagamento
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  📅 {dateBR(c.scheduled_date)} · pote {fmt(c.stakes_amount * 2)}
                  {c.modo ? ` · ⚡ ${c.modo}` : ""}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => viewProof(c.challenger_proof_url)} disabled={!c.challenger_proof_url} className="flex-1 min-w-0 h-9 rounded-lg bg-background border border-border text-xs font-bold text-foreground disabled:opacity-40 inline-flex items-center justify-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> {name(c.challenger_id)}
                  </button>
                  <button onClick={() => viewProof(c.opponent_proof_url)} disabled={!c.opponent_proof_url} className="flex-1 min-w-0 h-9 rounded-lg bg-background border border-border text-xs font-bold text-foreground disabled:opacity-40 inline-flex items-center justify-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> {name(c.opponent_id)}
                  </button>
                </div>
                <button onClick={() => adminConfirmPayment(c.id)} className="w-full h-9 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold">
                  Confirmar pagamento dos dois → liberar duelo
                </button>
              </div>
            ))}

            {/* Vencedor a definir */}
            {revWin.map((c) => (
              <div key={c.id} className="rounded-xl bg-card border border-primary/30 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-foreground truncate">
                    {name(c.challenger_id)} <span className="text-muted-foreground">VS</span> {name(c.opponent_id)}
                  </p>
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full shrink-0" style={{ background: "#1c1c22", color: "#c9a6ff" }}>
                    🔎 definir vencedor
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  📅 {dateBR(c.scheduled_date)}
                  {c.stakes_amount > 0 ? ` · pote ${fmt(c.stakes_amount * 2)} · prêmio ${fmt(c.prize_amount)}` : " · amistoso"}
                  {c.goal_amount ? ` · 🎯 ${fmt(c.goal_amount)}` : ""}
                </p>
                <div className="space-y-1.5">
                  {evidenceRow(c, c.challenger_id)}
                  {evidenceRow(c, c.opponent_id)}
                  <p className="text-[9px] text-muted-foreground/70">A IA dá o parecer; você decide o vencedor abaixo.</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setWinner(c, c.challenger_id)} className="flex-1 h-9 rounded-lg bg-background border border-border text-xs font-bold text-foreground">
                    <Trophy className="w-3.5 h-3.5 inline mr-1 text-amber-400" />{name(c.challenger_id)}
                  </button>
                  <button onClick={() => setWinner(c, c.opponent_id)} className="flex-1 h-9 rounded-lg bg-background border border-border text-xs font-bold text-foreground">
                    <Trophy className="w-3.5 h-3.5 inline mr-1 text-amber-400" />{name(c.opponent_id)}
                  </button>
                </div>
              </div>
            ))}

            {/* Rolando hoje (só monitorar — a liquidação das 9h05 resolve) */}
            {revAtivos.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border/40">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 pt-1">🔴 Rolando hoje (liquida sozinho às 9h05)</p>
                {revAtivos.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-[11px] gap-2">
                    <span className="text-foreground truncate">{name(c.challenger_id)} VS {name(c.opponent_id)}</span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">{c.stakes_amount > 0 ? fmt(c.stakes_amount * 2) : "amistoso"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ===== 💸 Saques (valor já reservado — só enviar o Pix e marcar pago) ===== */}
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">💸 Saques {saques.length > 0 ? `· ${saques.length} aguardando` : ""}</p>
            {saques.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum saque aguardando envio.</p>
            ) : (
              saques.map((s) => (
                <div key={s.id} className="rounded-lg bg-card border border-border/60 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-foreground truncate">{s.nome || "Vendedor"} · <span className="text-amber-400 tabular-nums">{fmt(s.valor)}</span></span>
                    <span className="text-muted-foreground shrink-0">{dtBR(s.created_at)}</span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard?.writeText(s.pix_key).then(() => toast({ title: "Chave Pix copiada" }), () => {})}
                    className="w-full rounded-lg bg-background border border-border p-2 text-left active:scale-[0.98] transition-transform"
                  >
                    <span className="block text-[9px] font-bold uppercase text-muted-foreground">Pix pra enviar {fmt(s.valor)} — toca pra copiar</span>
                    <span className="block text-[12px] font-semibold text-amber-400 truncate">{s.pix_key}</span>
                    {s.pix_nome && <span className="block text-[10px] text-muted-foreground truncate">Titular: {s.pix_nome}</span>}
                  </button>
                  <p className="text-[9px] text-muted-foreground/70">O valor já saiu do saldo dele (reservado). Envie o Pix e confirme abaixo.</p>
                  <div className="flex gap-2">
                    <button onClick={() => admResolverSaque(s.id, "pago")} className="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">✓ Pix enviado — marcar pago</button>
                    <button onClick={() => admResolverSaque(s.id, "rejeitado")} className="flex-1 h-8 rounded-lg bg-card border border-destructive/40 text-destructive text-[11px] font-bold">✗ Rejeitar (devolve o valor)</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ===== 📋 Depósitos ===== */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">📋 Depósitos</p>

            {depsPendentes.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum depósito aguardando conferência.</p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Aguardando conferência ({depsPendentes.length})</p>
                {depsPendentes.map((d) => (
                  <div key={d.id} className="rounded-lg bg-card border border-border/60 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-foreground truncate">{d.nome || "Vendedor"} · {fmt(d.valor)}</span>
                      <span className="text-muted-foreground shrink-0">{dtBR(d.created_at)}</span>
                    </div>
                    {d.remetente && <p className="text-[10px] text-muted-foreground">Remetente no comprovante: {d.remetente}</p>}
                    {d.motivo && <p className="text-[10px] text-amber-400">Motivo: {d.motivo}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => admResolverDeposito(d.id, true)} className="flex-1 h-8 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">✓ Caiu no banco — creditar</button>
                      <button onClick={() => admResolverDeposito(d.id, false)} className="flex-1 h-8 rounded-lg bg-card border border-destructive/40 text-destructive text-[11px] font-bold">✗ Rejeitar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {depsRecentes.length > 0 && (
              <div className="space-y-1 pt-1 border-t border-border/40">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground pt-1">✅ Auto-creditados recentes — bata com o banco 1×/dia</p>
                {depsRecentes.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-[10px] gap-2">
                    <span className="text-foreground truncate">{d.nome || "Vendedor"} {d.remetente ? `· de ${d.remetente}` : ""}</span>
                    <span className="text-muted-foreground shrink-0 tabular-nums">{fmt(d.valor)} · {dtBR(d.created_at)}</span>
                  </div>
                ))}
                <p className="text-[9px] text-muted-foreground/70">Não achou algum no extrato do banco? Estorna pelo SQL: x1_admin_estornar_deposit(id).</p>
              </div>
            )}
          </div>

          {/* ===== 💰 Carteiras ===== */}
          <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-2.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-foreground">💰 Carteiras · creditar / debitar</p>
            <input
              value={admWallet.busca}
              onChange={(e) => admBuscar(e.target.value)}
              placeholder="Buscar vendedor pelo nome…"
              className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground"
            />
            {admWallet.achados.length > 0 && !admWallet.sel && (
              <div className="space-y-1">
                {admWallet.achados.map((r) => (
                  <button key={r.user_id} onClick={() => setAdmWallet((s) => ({ ...s, sel: r, achados: [] }))} className="w-full text-left px-3 py-2 rounded-lg bg-card border border-border/60 text-xs text-foreground">
                    {r.nome_usuario || "Vendedor"}
                  </button>
                ))}
              </div>
            )}
            {admWallet.sel && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-foreground">{admWallet.sel.nome_usuario}</span>
                <input type="number" inputMode="numeric" value={admWallet.valor} onChange={(e) => setAdmWallet((s) => ({ ...s, valor: e.target.value }))} placeholder="R$" className="w-24 h-9 px-2 rounded-lg bg-card border border-border text-sm text-foreground" />
                <select value={admWallet.tipo} onChange={(e) => setAdmWallet((s) => ({ ...s, tipo: e.target.value as "deposito" | "saque" }))} className="h-9 px-2 rounded-lg bg-card border border-border text-xs text-foreground">
                  <option value="deposito">Depósito</option>
                  <option value="saque">Saque</option>
                </select>
                <button onClick={admMoverCarteira} className="h-9 px-3 rounded-lg bg-primary/15 border border-primary/40 text-primary text-xs font-bold">Aplicar</button>
              </div>
            )}
          </div>

          {/* ===== 🏁 Liquidação ===== */}
          <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-foreground">🏁 Liquidação</p>
            <p className="text-[11px] text-muted-foreground">Roda sozinha todo dia às 9h05 (extrato verificado decide, prêmio cai na carteira, 10% fica pro Orbis). Use o botão só pra forçar agora.</p>
            <button onClick={admLiquidarAgora} className="w-full h-10 rounded-xl bg-card border border-border text-xs font-bold text-foreground active:scale-[0.98] transition-transform">
              🏁 Liquidar duelos vencidos agora
            </button>
          </div>

          {/* ===== 🔗 Outras áreas ===== */}
          <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-foreground">🔗 Outras áreas de admin</p>
            <div className="space-y-1.5">
              {OUTRAS_AREAS.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.path} onClick={() => (a.path.endsWith(".html") ? window.open(a.path, "_blank") : navigate(a.path))} className="w-full flex items-center gap-3 rounded-xl bg-card border border-border/60 px-3 py-2.5 text-left active:scale-[0.99] transition-transform">
                    <Icon className="w-4 h-4 text-primary shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-foreground">{a.label}</span>
                      <span className="block text-[10px] text-muted-foreground truncate">{a.desc}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* ===== 🧪 Ferramentas de teste ===== */}
          <div className="rounded-2xl border border-border bg-card/50 p-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-foreground">🧪 Ferramentas de teste</p>
            <div className="space-y-1.5">
              {TESTES.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.path} onClick={() => navigate(a.path)} className="w-full flex items-center gap-3 rounded-xl bg-card border border-border/60 px-3 py-2.5 text-left active:scale-[0.99] transition-transform">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-foreground">{a.label}</span>
                      <span className="block text-[10px] text-muted-foreground truncate">{a.desc}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
