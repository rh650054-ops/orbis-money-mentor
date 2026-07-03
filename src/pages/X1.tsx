import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { toast } from "@/shared/hooks/use-toast";
import PublicProfileModal from "@/components/PublicProfileModal";
import { ArrowLeft, Swords, Plus, Trophy, Check, X, Search, Copy, Upload, Loader2, Eye, Sparkles } from "lucide-react";

interface X1 {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: string;
  scheduled_date: string | null;
  goal_amount: number | null;
  stakes_amount: number;
  fee_amount: number;
  prize_amount: number;
  pix_account: string | null;
  challenger_paid: boolean;
  opponent_paid: boolean;
  money_status: string;
  winner_user_id: string | null;
  modo: string | null;
  challenger_pix: string | null;
  challenger_pix_nome: string | null;
  opponent_pix: string | null;
  opponent_pix_nome: string | null;
  last_proposed_by: string | null;
  challenger_proof_url: string | null;
  opponent_proof_url: string | null;
}
interface RankUser {
  user_id: string;
  nome_usuario: string | null;
  avatar_url: string | null;
}
interface Settings {
  pix_account: string | null;
  fee_flat: number;
}
interface WalletTx {
  id: string;
  amount: number;
  tipo: string;
  notes: string | null;
  created_at: string;
}
interface NegForm {
  open: "accept" | "counter" | null;
  pix: string;
  nome: string;
  modo: string;
  goal: string;
  stakes: string;
  date: string;
}

// LANCAMENTO DA CARTEIRA: enquanto false, o card da carteira so aparece pra ADMINS
// (previa de teste). Vire true pra liberar pra todo mundo. A seguranca real esta
// no banco (RLS/RPCs) — isto aqui e so o interruptor visual.
const CARTEIRA_LIBERADA = true;
// Tesouraria: SO Rick e Mohamed (o banco tambem barra — funcao x1_tesouraria).
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
const statusLabel: Record<string, string> = {
  pending: "Em negociação",
  accepted: "Acordo fechado · aguardando pagamento",
  active: "Em andamento",
  declined: "Recusado",
  cancelled: "Cancelado",
  awaiting_result: "Aguardando resultado",
  finished: "Encerrado",
};
const moneyLabel: Record<string, string> = {
  none: "Amistoso (sem aposta)",
  awaiting_payment: "Aguardando pagamento das apostas",
  secured: "Dinheiro garantido pelo admin",
  prize_released: "Prêmio liberado",
};

export default function X1() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { whitelisted, role } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [list, setList] = useState<X1[]>([]);
  const [profiles, setProfiles] = useState<Record<string, RankUser>>({});
  const [settings, setSettings] = useState<Settings | null>(null);
  // Extratos verificados pela IA (total do dia por duelista) — pro admin decidir o vencedor.
  const [extratos, setExtratos] = useState<Record<string, { total: number; qtd: number }>>({});
  const [uploadingProof, setUploadingProof] = useState<string | null>(null); // id do X1 subindo comprovante
  const [openPlacar, setOpenPlacar] = useState<string | null>(null); // id do X1 com o placar aberto
  const [placar, setPlacar] = useState<Record<string, { ch: number; op: number }>>({}); // totais ao vivo por duelo
  const prevStatusRef = useRef<Record<string, string>>({}); // status anterior de cada duelo (pra avisar "liberado")
  const [aiById, setAiById] = useState<Record<string, { loading?: boolean; suspeito?: boolean; score?: number; motivo?: string; erro?: string }>>({}); // parecer da IA por duelista
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "new">("list");
  const [profileUid, setProfileUid] = useState<string | null>(null);

  // Carteira X1: saldo interno — aposta sai daqui na hora do aceite, prêmio cai aqui.
  const [saldo, setSaldo] = useState(0);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [depositOpen, setDepositOpen] = useState(false);
  // Admin: creditar depósito / registrar saque na carteira de alguém.
  const [admWallet, setAdmWallet] = useState({ busca: "", achados: [] as RankUser[], sel: null as RankUser | null, valor: "", tipo: "deposito" as "deposito" | "saque" });
  // Depósito por comprovante: sobe o recibo do Pix, a IA valida e credita sozinha.
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  // Admin: fila de depósitos pendentes de conferência + últimos auto-creditados.
  const [depsPendentes, setDepsPendentes] = useState<{ id: string; user_id: string; valor: number; motivo: string | null; remetente: string | null; created_at: string; nome?: string }[]>([]);
  const [depsRecentes, setDepsRecentes] = useState<{ id: string; user_id: string; valor: number; e2e_id: string | null; remetente: string | null; created_at: string; nome?: string }[]>([]);
  // Tesouraria (só Rick e Mohamed): resumo financeiro da carteira.
  const [tesouraria, setTesouraria] = useState<null | {
    total_devido: number; depositos: number; saques: number; em_jogo: number;
    premios_pagos: number; taxas: number;
    por_usuario: { user_id: string; nome: string; saldo: number }[];
  }>(null);
  const podeVerTesouraria = !!user && TESOURARIA_UIDS.includes(user.id);

  // novo desafio
  const [ranking, setRanking] = useState<RankUser[]>([]);
  const [search, setSearch] = useState("");
  const [opp, setOpp] = useState<RankUser | null>(null);
  const [schedDate, setSchedDate] = useState(getBrazilDate());
  const [goal, setGoal] = useState("");
  const [stakes, setStakes] = useState("0");
  const [modo, setModo] = useState("");
  const [myPix, setMyPix] = useState("");
  const [myNome, setMyNome] = useState("");
  const [saving, setSaving] = useState(false);

  // formulários inline de negociação por desafio (chave = id do desafio)
  const [negState, setNegState] = useState<Record<string, NegForm>>({});
  const negFor = (c: X1): NegForm =>
    negState[c.id] ?? {
      open: null,
      pix: c.challenger_id === user?.id ? c.challenger_pix ?? "" : c.opponent_pix ?? "",
      nome: c.challenger_id === user?.id ? c.challenger_pix_nome ?? "" : c.opponent_pix_nome ?? "",
      modo: c.modo ?? "",
      goal: c.goal_amount != null ? String(c.goal_amount) : "",
      stakes: String(c.stakes_amount ?? 0),
      date: c.scheduled_date ?? getBrazilDate(),
    };
  const patchNeg = (c: X1, patch: Partial<NegForm>) =>
    setNegState((s) => ({ ...s, [c.id]: { ...negFor(c), ...patch } }));

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: rows } = await supabase
      .from("x1_challenges" as any)
      .select("*")
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    const challenges = ((rows as any[]) || []) as X1[];
    setList(challenges);

    // Avisa quando um duelo seu foi LIBERADO (virou "active") desde a última leitura.
    const prev = prevStatusRef.current;
    if (Object.keys(prev).length > 0) {
      for (const c of challenges) {
        if (prev[c.id] && prev[c.id] !== "active" && c.status === "active") {
          toast({ title: "✅ Duelo liberado!", description: "Pagamento confirmado pelo admin — seu X1 já está valendo. Bora! ⚔️" });
          if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
            navigator.serviceWorker.ready
              .then((reg) => reg.active?.postMessage({ type: "orbis-x1-alert", data: { title: "✅ X1 liberado!", body: "Pagamento confirmado — seu duelo já está valendo." } }))
              .catch(() => {});
          }
        }
      }
    }
    prevStatusRef.current = Object.fromEntries(challenges.map((c) => [c.id, c.status]));
    const ids = Array.from(new Set(challenges.flatMap((c) => [c.challenger_id, c.opponent_id])));
    if (ids.length) {
      const { data: profs } = await supabase.from("public_profiles").select("user_id, nickname, avatar_url").in("user_id", ids);
      const map: Record<string, RankUser> = {};
      ((profs as any[]) || []).forEach((p) => (map[p.user_id] = { user_id: p.user_id, nome_usuario: p.nickname, avatar_url: p.avatar_url }));
      setProfiles(map);
    }

    // Extratos verificados (IA) dos duelistas nos duelos em andamento / aguardando resultado.
    const relev = challenges.filter((c) => c.scheduled_date && (c.status === "active" || c.status === "awaiting_result"));
    if (relev.length) {
      const uids = Array.from(new Set(relev.flatMap((c) => [c.challenger_id, c.opponent_id])));
      const dias = Array.from(new Set(relev.map((c) => c.scheduled_date))) as string[];
      const { data: ex } = await supabase
        .from("extrato_uploads")
        .select("user_id, dia, total_verificado, qtd_vendas")
        .in("user_id", uids)
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

    const { data: st } = await supabase.from("x1_settings" as any).select("pix_account, fee_flat").eq("id", 1).maybeSingle();
    setSettings((st as any) || { pix_account: null, fee_flat: 0 });

    // Carteira: saldo + últimas movimentações.
    const [{ data: w }, { data: tx }] = await Promise.all([
      supabase.from("x1_wallets" as any).select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("x1_wallet_transactions" as any).select("id, amount, tipo, notes, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    ]);
    setSaldo(Number((w as any)?.balance ?? 0));
    setTxs(((tx as any[]) || []) as WalletTx[]);

    // Tesouraria: só tenta se for Rick/Mohamed (o banco barra qualquer outro de todo jeito).
    if (TESOURARIA_UIDS.includes(user.id)) {
      const { data: tes } = await (supabase as any).rpc("x1_tesouraria");
      if (tes) setTesouraria(tes as any);
    }

    // Admin: fila de depósitos pendentes + últimos auto-creditados (pra bater com o banco).
    if (whitelisted && role === "admin") {
      const [{ data: pend }, { data: rec }] = await Promise.all([
        supabase.from("x1_deposit_requests" as any).select("id, user_id, valor, motivo, remetente, created_at").eq("status", "pendente_revisao").order("created_at", { ascending: true }),
        supabase.from("x1_deposit_requests" as any).select("id, user_id, valor, e2e_id, remetente, created_at").eq("status", "creditado").order("created_at", { ascending: false }).limit(8),
      ]);
      const todos = [...(((pend as any[]) || [])), ...(((rec as any[]) || []))];
      const uidsDep = Array.from(new Set(todos.map((d) => d.user_id)));
      let nomes: Record<string, string> = {};
      if (uidsDep.length) {
        const { data: pf } = await supabase.from("public_profiles").select("user_id, nickname").in("user_id", uidsDep);
        ((pf as any[]) || []).forEach((p) => (nomes[p.user_id] = p.nickname));
      }
      setDepsPendentes((((pend as any[]) || [])).map((d) => ({ ...d, nome: nomes[d.user_id] })));
      setDepsRecentes((((rec as any[]) || [])).map((d) => ({ ...d, nome: nomes[d.user_id] })));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Placar ao vivo: atualiza a cada 8s o duelo aberto manualmente OU a arena
  // auto-aberta (duelo ativo de hoje).
  const autoArenaId = useMemo(() => {
    const hoje = getBrazilDate();
    return list.find((c) => c.status === "active" && c.scheduled_date === hoje)?.id ?? null;
  }, [list]);
  useEffect(() => {
    const manual = openPlacar && !openPlacar.startsWith("fechado:") ? openPlacar : null;
    const id = manual ?? (openPlacar?.startsWith("fechado:") && openPlacar === `fechado:${autoArenaId}` ? null : autoArenaId);
    if (!id) return;
    const run = async () => {
      const { data } = await (supabase as any).rpc("x1_placar", { p_id: id });
      const row = ((data as any[]) || [])[0];
      if (row) setPlacar((p) => ({ ...p, [id]: { ch: Number(row.challenger_total) || 0, op: Number(row.opponent_total) || 0 } }));
    };
    run();
    const t = setInterval(run, 8000);
    return () => clearInterval(t);
  }, [openPlacar, autoArenaId]);

  // Pré-seleciona o oponente quando vem de "Chamar pra X1" (/x1?desafiar=<uid>).
  useEffect(() => {
    const uid = searchParams.get("desafiar");
    if (!uid || !user || uid === user.id) return;
    (async () => {
      const { data } = await supabase
        .from("public_profiles")
        .select("user_id, nickname, avatar_url")
        .eq("user_id", uid)
        .maybeSingle();
      const p = data as any;
      setOpp({ user_id: uid, nome_usuario: p?.nickname ?? null, avatar_url: p?.avatar_url ?? null });
      setSchedDate(getBrazilDate());
      setGoal("");
      setStakes("0");
      setModo("");
      setMyPix("");
      setMyNome("");
      setMode("new");
    })().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, searchParams]);

  const loadRanking = async () => {
    const month = getBrazilDate().slice(0, 7);
    const { data } = await supabase
      .from("leaderboard_stats")
      .select("user_id, nome_usuario, avatar_url")
      .eq("mes_referencia", month)
      .order("faturamento_total_mes", { ascending: false })
      .limit(100);
    setRanking((((data as any[]) || []) as RankUser[]).filter((r) => r.user_id !== user?.id));
  };

  const openNew = () => {
    setOpp(null);
    setSearch("");
    setGoal("");
    setStakes("0");
    setModo("");
    setMyPix("");
    setMyNome("");
    setSchedDate(getBrazilDate());
    setMode("new");
    loadRanking();
  };

  const createX1 = async () => {
    if (!user || !opp) return;
    setSaving(true);
    const s = Number(stakes) || 0;
    // Taxa do Orbis: 10% do pote (rake), descontada do prêmio na liquidação.
    const fee = s > 0 ? Math.round(s * 2 * 0.10 * 100) / 100 : 0;
    const prize = s > 0 ? Math.max(0, s * 2 - fee) : 0;
    const { error } = await supabase.from("x1_challenges" as any).insert({
      challenger_id: user.id,
      opponent_id: opp.user_id,
      status: "pending",
      scheduled_date: schedDate || null,
      goal_amount: Number(goal) || null,
      stakes_amount: s,
      fee_amount: fee,
      prize_amount: prize,
      pix_account: settings?.pix_account ?? null,
      modo: modo.trim() || null,
      challenger_pix: myPix.trim() || null,
      challenger_pix_nome: myNome.trim() || null,
      last_proposed_by: user.id,
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao criar X1", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Desafio enviado! ⚔️", description: `${opp.nome_usuario || "Vendedor"} precisa aceitar.` });
    setMode("list");
    loadAll();
  };

  const rpc = async (fn: string, args: Record<string, unknown>, okMsg: string) => {
    const { error } = await (supabase as any).rpc(fn, args);
    if (error) {
      toast({ title: "Não rolou", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: okMsg });
    loadAll();
  };

  const negotiate = (
    id: string,
    action: "accept" | "decline" | "counter",
    extra: { pix?: string | null; nome?: string | null; modo?: string | null; goal?: number | null; stakes?: number | null; date?: string | null } = {},
    okMsg?: string,
  ) =>
    rpc(
      "x1_negotiate",
      {
        p_id: id,
        p_action: action,
        p_pix: extra.pix ?? null,
        p_nome: extra.nome ?? null,
        p_modo: extra.modo ?? null,
        p_goal: extra.goal ?? null,
        p_stakes: extra.stakes ?? null,
        p_date: extra.date ?? null,
      },
      okMsg ?? (action === "accept" ? "Acordo fechado! ⚔️" : action === "decline" ? "Desafio recusado" : "Contra-proposta enviada"),
    );
  const markPaid = (id: string) => rpc("x1_mark_paid", { p_id: id }, "Marcado como pago — admin vai confirmar");
  const cancelX1 = (id: string) => rpc("x1_cancel", { p_id: id }, "Desafio cancelado");

  // Sobe o comprovante do Pix pro bucket privado, grava no desafio e marca como pago.
  const uploadProof = async (c: X1, file: File) => {
    if (!user) return;
    setUploadingProof(c.id);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${c.id}/${user.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("x1-proofs").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: rpcErr } = await (supabase as any).rpc("x1_set_proof", { p_id: c.id, p_url: path });
      if (rpcErr) throw rpcErr;
      await (supabase as any).rpc("x1_mark_paid", { p_id: c.id }); // comprovante enviado = paguei
      toast({ title: "Comprovante enviado ✅", description: "O admin vai conferir e liberar o duelo." });
      await loadAll();
    } catch (e: any) {
      toast({ title: "Não consegui enviar o comprovante", description: e?.message || "Tenta de novo com uma foto mais nítida.", variant: "destructive" });
    } finally {
      setUploadingProof(null);
    }
  };

  // Admin: análise da IA de um duelista (anti-burla) — parecer antes de premiar.
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

  // Admin abre o comprovante (URL assinada temporária do bucket privado).
  const viewProof = async (path: string | null) => {
    if (!path) return;
    const { data } = await supabase.storage.from("x1-proofs").createSignedUrl(path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    else toast({ title: "Não consegui abrir o comprovante", variant: "destructive" });
  };
  const adminConfirmPayment = (id: string) => rpc("x1_admin_confirm_payment", { p_id: id }, "Pagamentos confirmados — duelo liberado");
  const setWinner = (c: X1, winner: string) =>
    rpc(
      "x1_admin_set_result",
      { p_id: c.id, p_winner: winner, p_challenger_score: null, p_opponent_score: null, p_prize: c.prize_amount, p_fee: c.fee_amount, p_notes: "" },
      "Resultado salvo! 🏆",
    );

  const name = (uid: string) => profiles[uid]?.nome_usuario || "Vendedor";

  // Admin: busca usuário por nome pra creditar/debitar carteira.
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
      { p_user: admWallet.sel.user_id, p_amount: v, p_tipo: admWallet.tipo, p_notes: `${admWallet.tipo} via painel X1` },
      admWallet.tipo === "deposito" ? `Crédito de ${fmt(v)} pra ${admWallet.sel.nome_usuario} ✅` : `Saque de ${fmt(v)} registrado ✅`,
    );
    setAdmWallet({ busca: "", achados: [], sel: null, valor: "", tipo: "deposito" });
  };
  const admLiquidarAgora = () => rpc("x1_settle_due", {}, "Liquidação executada — confere os resultados 🏁");

  // Sobe o comprovante do Pix de DEPÓSITO → IA valida → credita sozinho (com travas).
  const enviarComprovanteDeposito = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (e.target) e.target.value = "";
    if (!file) return;
    setEnviandoComprovante(true);
    try {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).replace(/^data:[^;]+;base64,/, ""));
        r.onerror = () => rej(new Error("read_error"));
        r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("verificar-deposito", {
        body: { file: b64, mime: file.type || "image/jpeg" },
      });
      const r = data as { ok?: boolean; status?: string; valor?: number; dica?: string; error?: string } | null;
      if (error || (!r?.ok && r?.error)) {
        toast({ title: "Não rolou", description: r?.dica ?? "Tenta de novo com uma foto mais nítida.", variant: "destructive" });
      } else if (r?.status === "creditado") {
        toast({ title: `💰 +${fmt(r.valor ?? 0)} na carteira!`, description: "Depósito confirmado pela IA. Bora duelar! ⚔️" });
        await loadAll();
      } else {
        toast({ title: "Comprovante recebido 📋", description: r?.dica ?? "Vai passar pela conferência do admin." });
        await loadAll();
      }
    } catch {
      toast({ title: "Não consegui enviar", description: "Tenta de novo.", variant: "destructive" });
    } finally {
      setEnviandoComprovante(false);
    }
  };
  const admResolverDeposito = (id: string, aprovar: boolean) =>
    rpc("x1_admin_resolve_deposit", { p_id: id, p_aprovar: aprovar, p_motivo: aprovar ? null : "não localizado no banco" }, aprovar ? "Depósito creditado ✅" : "Depósito rejeitado");

  // Painel de evidência (admin): total do extrato verificado pela IA de cada duelista + ✓ se bateu a meta.
  const evidence = (c: X1) => {
    const row = (uid: string) => {
      const e = extratos[`${uid}|${c.scheduled_date}`];
      const hitGoal = c.goal_amount != null && e != null && e.total >= c.goal_amount;
      const ai = aiById[uid];
      return (
        <div className="rounded-lg bg-card border border-border/60 px-2.5 py-1.5 space-y-1.5">
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
    return (
      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Análise: extrato verificado + IA — dia {dateBR(c.scheduled_date)}
        </p>
        {row(c.challenger_id)}
        {row(c.opponent_id)}
        <p className="text-[9px] text-muted-foreground/70">A IA dá o parecer; você decide o vencedor abaixo.</p>
      </div>
    );
  };

  const togglePlacar = (id: string) => setOpenPlacar((cur) => (cur === id ? null : id));

  // ARENA: placar do duelo estilo jogo de luta — avatares frente a frente, barras
  // de energia proporcionais, pote em jogo e status da liderança.
  const placarView = (c: X1, iAmCh: boolean) => {
    const p = placar[c.id];
    const my = p ? (iAmCh ? p.ch : p.op) : 0;
    const opp = p ? (iAmCh ? p.op : p.ch) : 0;
    const meId = iAmCh ? c.challenger_id : c.opponent_id;
    const otherId = iAmCh ? c.opponent_id : c.challenger_id;
    const otherName = name(otherId);
    const lead = !p ? "load" : my > opp ? "me" : opp > my ? "opp" : "tie";
    const max = Math.max(my, opp, c.goal_amount ?? 0, 1);
    const barMy = Math.max(4, Math.round((my / max) * 100));
    const barOpp = Math.max(4, Math.round((opp / max) * 100));
    const av = (uid: string, ring: string, glow: string) => (
      profiles[uid]?.avatar_url ? (
        <img src={profiles[uid]!.avatar_url!} alt="" className="w-14 h-14 rounded-full object-cover border-[3px]" style={{ borderColor: ring, boxShadow: `0 0 18px ${glow}` }} />
      ) : (
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-sm font-black border-[3px]" style={{ borderColor: ring, boxShadow: `0 0 18px ${glow}` }}>
          {name(uid).slice(0, 2).toUpperCase()}
        </div>
      )
    );
    return (
      <div className="rounded-2xl border border-amber-500/40 p-4 space-y-3" style={{ background: "radial-gradient(ellipse at top, #1a1206 0%, #0c0c0f 65%)" }}>
        {c.stakes_amount > 0 && (
          <p className="text-center text-[11px] font-black tracking-widest text-amber-400 uppercase">💰 {fmt(c.stakes_amount * 2)} em jogo</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
            {av(meId, lead === "me" ? "#22c55e" : "#38bdf8", lead === "me" ? "rgba(34,197,94,.6)" : "rgba(56,189,248,.35)")}
            <p className="text-[10px] uppercase tracking-wider text-sky-400 font-bold">Você</p>
            <p className="text-xl font-black tabular-nums" style={{ color: lead === "me" ? "#22c55e" : "#fff" }}>{fmt(my)}</p>
          </div>
          <div className="shrink-0 flex flex-col items-center">
            <span className="text-2xl font-black italic text-amber-400" style={{ textShadow: "0 0 16px rgba(245,158,11,.8)" }}>VS</span>
            {lead !== "load" && lead !== "tie" && <span className="text-lg">{lead === "me" ? "🔥" : "⚠️"}</span>}
          </div>
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
            {av(otherId, lead === "opp" ? "#22c55e" : "#f59e0b", lead === "opp" ? "rgba(34,197,94,.6)" : "rgba(245,158,11,.35)")}
            <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold truncate max-w-full">{otherName}</p>
            <p className="text-xl font-black tabular-nums" style={{ color: lead === "opp" ? "#22c55e" : "#fff" }}>{fmt(opp)}</p>
          </div>
        </div>
        {/* Barras de energia */}
        <div className="space-y-1.5">
          <div className="h-2.5 rounded-full bg-black/50 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barMy}%`, background: "linear-gradient(90deg,#0284c7,#38bdf8)", boxShadow: "0 0 10px rgba(56,189,248,.6)" }} />
          </div>
          <div className="h-2.5 rounded-full bg-black/50 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barOpp}%`, background: "linear-gradient(90deg,#b45309,#f59e0b)", boxShadow: "0 0 10px rgba(245,158,11,.6)" }} />
          </div>
        </div>
        <p className="text-center text-xs font-black" style={{ color: lead === "me" ? "#22c55e" : lead === "opp" ? "#ff9b9b" : "#9ca3af" }}>
          {lead === "load" ? "carregando…" : lead === "me" ? "🔥 VOCÊ ESTÁ NA FRENTE — não para!" : lead === "opp" ? `⚠️ ${otherName.toUpperCase()} PASSOU — reage!` : "⚡ EMPATE — a próxima venda decide"}
        </p>
        <p className="text-center text-[9px] text-muted-foreground/70">
          {c.goal_amount ? `meta ${fmt(c.goal_amount)} · ` : ""}ao vivo (8s) · resultado oficial às 9h pelo extrato verificado
        </p>
      </div>
    );
  };
  const filteredRanking = useMemo(
    () => ranking.filter((r) => (r.nome_usuario || "").toLowerCase().includes(search.toLowerCase())),
    [ranking, search],
  );

  if (mode === "new") {
    return (
      <div className="pb-24 px-4 pt-4 max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("list")} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/40">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-foreground">Novo X1</h1>
        </div>

        {!opp ? (
          <>
            {/* FIGHTER SELECT: escolha seu oponente */}
            <p className="text-center text-[11px] font-black uppercase tracking-[0.25em] text-amber-400">— Escolha seu oponente —</p>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vendedor…"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-card border border-border text-sm text-foreground"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-[55vh] overflow-y-auto pb-2">
              {filteredRanking.map((r, i) => (
                <button
                  key={r.user_id}
                  onClick={() => setOpp(r)}
                  className="rounded-xl p-2.5 flex flex-col items-center gap-1.5 active:scale-[0.95] transition-transform border border-border/60"
                  style={{ background: "linear-gradient(160deg,#141417,#0b0b0e)" }}
                >
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: i < 3 ? "#f59e0b" : "#3f3f46" }} />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-sm font-black text-foreground border-2" style={{ borderColor: i < 3 ? "#f59e0b" : "#3f3f46" }}>
                      {(r.nome_usuario ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[10px] font-bold text-white truncate w-full text-center">{r.nome_usuario || "Vendedor"}</span>
                  {i < 3 && <span className="text-[8px] font-black uppercase tracking-wider text-amber-400">TOP {i + 1} 👑</span>}
                </button>
              ))}
              {filteredRanking.length === 0 && <p className="col-span-3 text-sm text-muted-foreground text-center py-6">Ninguém encontrado.</p>}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {/* FIGHT CARD: você VS ele */}
            <div className="rounded-2xl border border-amber-500/40 p-4" style={{ background: "radial-gradient(ellipse at top,#1a1206 0%,#0c0c0f 65%)" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="w-16 h-16 rounded-full bg-sky-500/15 border-[3px] border-sky-400 flex items-center justify-center text-lg font-black text-sky-300" style={{ boxShadow: "0 0 18px rgba(56,189,248,.4)" }}>
                    VC
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-sky-400">Você</p>
                </div>
                <span className="text-3xl font-black italic text-amber-400 shrink-0" style={{ textShadow: "0 0 18px rgba(245,158,11,.8)" }}>VS</span>
                <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  {opp.avatar_url ? (
                    <img src={opp.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border-[3px] border-amber-400" style={{ boxShadow: "0 0 18px rgba(245,158,11,.4)" }} />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted border-[3px] border-amber-400 flex items-center justify-center text-lg font-black">{(opp.nome_usuario ?? "?").slice(0, 2).toUpperCase()}</div>
                  )}
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 truncate max-w-full">{opp.nome_usuario || "Vendedor"}</p>
                </div>
              </div>
              <button onClick={() => setOpp(null)} className="block mx-auto mt-2 text-[10px] text-muted-foreground underline">trocar oponente</button>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">O que é o desafio</label>
              <input
                value={modo}
                onChange={(e) => setModo(e.target.value)}
                placeholder="Ex: quem fatura mais no dia"
                className="w-full h-11 px-3 rounded-xl bg-card border border-border text-sm text-foreground mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Dia do duelo</label>
              <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-card border border-border text-sm text-foreground mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Meta pra ganhar (R$) — opcional</label>
              <input type="number" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: 1000" className="w-full h-11 px-3 rounded-xl bg-card border border-border text-sm text-foreground mt-1" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Aposta de CADA um (R$) — 0 = amistoso</label>
              <input type="number" inputMode="numeric" value={stakes} onChange={(e) => setStakes(e.target.value)} className="w-full h-11 px-3 rounded-xl bg-card border border-border text-sm text-foreground mt-1" />
              {Number(stakes) > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Prêmio do vencedor ≈ {fmt(Math.max(0, Number(stakes) * 2 * 0.9))} (pote {fmt(Number(stakes) * 2)} − taxa Orbis 10%).
                  A aposta sai da <b className="text-emerald-400">carteira X1</b> dos dois quando o desafio for aceito — e o prêmio cai lá na hora do resultado (9h, pelo extrato).
                  {saldo < Number(stakes) ? ` ⚠️ Seu saldo é ${fmt(saldo)} — deposita antes do aceite.` : ""}
                </p>
              )}
            </div>
            <button onClick={createX1} disabled={saving} className="w-full h-12 rounded-xl bg-amber-500 text-black font-bold text-sm active:scale-[0.98] disabled:opacity-60">
              {saving ? "Enviando…" : "Enviar desafio ⚔️"}
            </button>
          </div>
        )}
        <PublicProfileModal open={!!profileUid} onOpenChange={(v) => !v && setProfileUid(null)} userId={profileUid} />
      </div>
    );
  }

  return (
    <div className="pb-24 px-4 pt-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/competitions")} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/40">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Swords className="w-6 h-6 text-amber-400" /> Desafios X1
        </h1>
      </div>

      {/* ===== Tesouraria (SÓ Rick e Mohamed — o banco barra o resto) ===== */}
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

      {/* ===== Carteira X1: deposita uma vez, duela sem burocracia =====
           PRÉVIA: enquanto CARTEIRA_LIBERADA=false, usuário comum NÃO vê. */}
      {(CARTEIRA_LIBERADA || isAdmin) && (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
        {!CARTEIRA_LIBERADA && (
          <p className="text-[9px] font-black uppercase tracking-wider text-amber-400">🔒 Prévia — usuários ainda não veem este card</p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">💰 Sua carteira X1</p>
            <p className="text-2xl font-black text-foreground tabular-nums">{fmt(saldo)}</p>
          </div>
          <button onClick={() => setDepositOpen((v) => !v)} className="h-10 px-4 rounded-xl bg-emerald-500 text-black text-xs font-bold active:scale-[0.98]">
            {depositOpen ? "Fechar" : "Depositar"}
          </button>
        </div>
        {depositOpen && (
          <div className="rounded-xl bg-card border border-border/60 p-3 space-y-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <b className="text-foreground">1.</b> Faça o Pix pra chave abaixo · <b className="text-foreground">2.</b> Suba o comprovante aqui —
              a IA confere e <b className="text-emerald-400">o saldo cai na hora</b> (depósitos até R$ 100; acima disso o admin confere primeiro).
              O prêmio dos duelos também cai aqui. Pra sacar, chama o admin.
            </p>
            <button
              onClick={() => navigator.clipboard?.writeText(settings?.pix_account || "").then(() => toast({ title: "Chave Pix copiada" }), () => {})}
              className="w-full rounded-xl bg-[#0e0e10] border border-border p-2.5 text-left active:scale-[0.98] transition-transform"
            >
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground"><Copy className="w-3 h-3" /> 1 · Copiar chave Pix do Orbis</span>
              <span className="block text-[12px] font-semibold text-emerald-400 truncate mt-0.5">{settings?.pix_account || "—"}</span>
            </button>
            <label className={`w-full rounded-xl border border-dashed border-emerald-500/50 bg-emerald-500/5 p-2.5 flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98] transition-transform ${enviandoComprovante ? "opacity-60 pointer-events-none" : ""}`}>
              {enviandoComprovante ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Upload className="w-4 h-4 text-emerald-400" />}
              <span className="text-[11px] font-bold text-emerald-400">{enviandoComprovante ? "IA conferindo o comprovante…" : "2 · Já fiz o Pix — enviar comprovante"}</span>
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={enviarComprovanteDeposito} disabled={enviandoComprovante} />
            </label>
            <p className="text-[9px] text-muted-foreground/70 text-center">Cada comprovante vale UMA vez (o ID do Pix é registrado). Comprovante falso = banimento.</p>
          </div>
        )}
        {txs.length > 0 && (
          <div className="space-y-1 pt-1">
            {txs.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground truncate">{t.notes || t.tipo}</span>
                <span className={`font-bold tabular-nums shrink-0 ${t.amount >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {t.amount >= 0 ? "+" : ""}{fmt(t.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      <button onClick={openNew} className="w-full h-12 rounded-xl bg-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
        <Plus className="w-4 h-4" /> Chamar alguém pra X1
      </button>

      {/* ===== Admin: carteira + liquidação ===== */}
      {isAdmin && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-2.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary">Admin · Carteiras e liquidação</p>
          <input
            value={admWallet.busca}
            onChange={(e) => admBuscar(e.target.value)}
            placeholder="Buscar vendedor pra creditar/debitar…"
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
          <button onClick={admLiquidarAgora} className="w-full h-9 rounded-lg bg-card border border-border text-xs font-bold text-foreground">
            🏁 Liquidar duelos vencidos agora (roda sozinho às 9h05)
          </button>

          {/* Fila de depósitos aguardando conferência */}
          {depsPendentes.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-border/40">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-400 pt-1">📋 Depósitos aguardando conferência ({depsPendentes.length})</p>
              {depsPendentes.map((d) => (
                <div key={d.id} className="rounded-lg bg-card border border-border/60 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-foreground truncate">{d.nome || "Vendedor"} · {fmt(d.valor)}</span>
                    <span className="text-muted-foreground shrink-0">{new Date(d.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
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

          {/* Últimos auto-creditados: bater com o extrato do banco 1x/dia */}
          {depsRecentes.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-border/40">
              <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground pt-1">✅ Auto-creditados recentes — bata com o banco 1×/dia</p>
              {depsRecentes.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-[10px] gap-2">
                  <span className="text-foreground truncate">{d.nome || "Vendedor"} · {d.remetente ? `de ${d.remetente}` : ""}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {fmt(d.valor)} · {new Date(d.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
              <p className="text-[9px] text-muted-foreground/70">Não achou algum no extrato do banco? Estorna pelo SQL: x1_admin_estornar_deposit(id).</p>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-card/40 border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-14 px-6">
          <p className="text-5xl mb-3">⚔️</p>
          <p className="text-foreground font-bold">Nenhum X1 ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Chame alguém do ranking e prove quem vende mais.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((c) => {
            const other = c.challenger_id === user?.id ? c.opponent_id : c.challenger_id;
            const iAmChallenger = c.challenger_id === user?.id;
            const iPaid = iAmChallenger ? c.challenger_paid : c.opponent_paid;
            return (
              <div key={c.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <button onClick={() => setProfileUid(other)} className="shrink-0">
                    {profiles[other]?.avatar_url ? (
                      <img src={profiles[other]!.avatar_url!} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-border" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">{name(other).slice(0, 2).toUpperCase()}</div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      vs {name(other)} {iAmChallenger ? "(você chamou)" : "(te chamou)"}
                    </p>
                    {c.modo && <p className="text-[11px] text-amber-400 font-semibold truncate">{c.modo}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      {statusLabel[c.status] || c.status} · {dateBR(c.scheduled_date)}
                      {c.goal_amount ? ` · meta ${fmt(c.goal_amount)}` : ""}
                      {c.stakes_amount > 0 ? ` · aposta ${fmt(c.stakes_amount)}` : ""}
                      {c.prize_amount > 0 ? ` · prêmio ${fmt(c.prize_amount)}` : ""}
                    </p>
                  </div>
                  {c.winner_user_id && (
                    <span className="text-[10px] font-black px-2 py-1 rounded" style={{ background: c.winner_user_id === user?.id ? "#16331f" : "#2a2a2e", color: c.winner_user_id === user?.id ? "#22c55e" : "#9ca3af" }}>
                      {c.winner_user_id === user?.id ? "VOCÊ VENCEU 🏆" : "Encerrado"}
                    </span>
                  )}
                </div>

                {/* ----- pending: negociação ----- */}
                {c.status === "pending" && (() => {
                  const myTurn = c.last_proposed_by !== user?.id;
                  const f = negFor(c);
                  return (
                    <div className="space-y-2">
                      {!myTurn ? (
                        <p className="text-[11px] text-muted-foreground rounded-lg bg-muted/30 border border-border/50 p-2.5">
                          Aguardando {name(other)} responder à sua proposta…
                        </p>
                      ) : (
                        <>
                          {f.open === null && (
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => patchNeg(c, { open: "accept" })} className="flex-1 h-9 rounded-lg bg-green-600 text-white text-xs font-bold flex items-center justify-center gap-1">
                                <Check className="w-3.5 h-3.5" /> Aceitar
                              </button>
                              <button onClick={() => negotiate(c.id, "decline")} className="flex-1 h-9 rounded-lg bg-card border border-border text-muted-foreground text-xs font-bold flex items-center justify-center gap-1">
                                <X className="w-3.5 h-3.5" /> Recusar
                              </button>
                              <button onClick={() => patchNeg(c, { open: "counter" })} className="flex-1 h-9 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold">
                                Contra-proposta
                              </button>
                            </div>
                          )}

                          {/* Aceitar → desconta do saldo e o duelo começa NA HORA */}
                          {f.open === "accept" && (
                            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 space-y-2">
                              {c.stakes_amount > 0 ? (
                                <>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Ao confirmar, <b className="text-amber-400">{fmt(c.stakes_amount)}</b> sai da carteira de cada um e o duelo
                                    <b className="text-foreground"> começa na hora</b> — sem comprovante, sem espera. O prêmio cai direto na carteira do vencedor às 9h do dia seguinte, pelo extrato verificado.
                                  </p>
                                  <p className={`text-[11px] font-bold ${saldo >= c.stakes_amount ? "text-emerald-400" : "text-red-400"}`}>
                                    Seu saldo: {fmt(saldo)} {saldo < c.stakes_amount ? `— falta ${fmt(c.stakes_amount - saldo)}. Deposita primeiro!` : "✓"}
                                  </p>
                                </>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">Duelo amistoso (sem aposta) — começa na hora. Valendo a glória! 🏆</p>
                              )}
                              <div className="flex gap-2 pt-1">
                                <button onClick={() => negotiate(c.id, "accept", {}, "⚔️ DUELO VALENDO! Bora vender!")} disabled={c.stakes_amount > 0 && saldo < c.stakes_amount} className="flex-1 h-9 rounded-lg bg-green-600 text-white text-xs font-bold disabled:opacity-50">
                                  Confirmar — começar duelo ⚔️
                                </button>
                                <button onClick={() => patchNeg(c, { open: null })} className="h-9 px-3 rounded-lg bg-card border border-border text-muted-foreground text-xs font-bold">
                                  Voltar
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Contra-proposta */}
                          {f.open === "counter" && (
                            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 space-y-2">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Sua contra-proposta</p>
                              <input value={f.modo} onChange={(e) => patchNeg(c, { modo: e.target.value })} placeholder="O que é o desafio" className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground" />
                              <div className="flex gap-2">
                                <input type="number" inputMode="numeric" value={f.goal} onChange={(e) => patchNeg(c, { goal: e.target.value })} placeholder="Meta (R$)" className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground" />
                                <input type="number" inputMode="numeric" value={f.stakes} onChange={(e) => patchNeg(c, { stakes: e.target.value })} placeholder="Aposta (R$)" className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground" />
                              </div>
                              <input type="date" value={f.date} onChange={(e) => patchNeg(c, { date: e.target.value })} className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground" />
                              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 pt-1">Seu Pix pra receber se ganhar</p>
                              <input value={f.pix} onChange={(e) => patchNeg(c, { pix: e.target.value })} placeholder="Chave Pix" className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground" />
                              <input value={f.nome} onChange={(e) => patchNeg(c, { nome: e.target.value })} placeholder="Nome do titular" className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground" />
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() =>
                                    negotiate(c.id, "counter", {
                                      pix: f.pix.trim() || null,
                                      nome: f.nome.trim() || null,
                                      modo: f.modo.trim() || null,
                                      goal: f.goal === "" ? null : Number(f.goal),
                                      stakes: f.stakes === "" ? null : Number(f.stakes),
                                      date: f.date || null,
                                    })
                                  }
                                  className="flex-1 h-9 rounded-lg bg-amber-500 text-black text-xs font-bold"
                                >
                                  Enviar contra-proposta
                                </button>
                                <button onClick={() => patchNeg(c, { open: null })} className="h-9 px-3 rounded-lg bg-card border border-border text-muted-foreground text-xs font-bold">
                                  Voltar
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {iAmChallenger && (
                        <button onClick={() => cancelX1(c.id)} className="w-full h-9 rounded-lg bg-card border border-border text-muted-foreground text-xs font-bold">
                          Cancelar desafio
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* ----- accepted: fluxo do dinheiro ----- */}
                {c.status === "accepted" && c.stakes_amount > 0 && (
                  <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-3 space-y-2.5">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Pagamento da aposta</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Faça um Pix de <span className="text-amber-400 font-bold">{fmt(c.stakes_amount)}</span> pra a conta do Orbis usando a chave abaixo — é o nosso <b className="text-foreground">CNPJ</b>. Depois suba o comprovante; o admin confere e libera o duelo.
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => navigator.clipboard?.writeText(c.pix_account || "").then(() => toast({ title: "Chave Pix copiada" }), () => {})}
                        className="flex-1 min-w-0 rounded-xl bg-card border border-border p-2.5 text-left active:scale-[0.98] transition-transform"
                      >
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase text-muted-foreground"><Copy className="w-3 h-3" /> Copiar chave Pix</span>
                        <span className="block text-[12px] font-semibold text-amber-400 truncate mt-0.5">{c.pix_account || "—"}</span>
                      </button>

                      {!iPaid ? (
                        <label className={`flex-1 min-w-0 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/5 p-2.5 flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-[0.98] transition-transform ${uploadingProof === c.id ? "opacity-60 pointer-events-none" : ""}`}>
                          {uploadingProof === c.id ? <Loader2 className="w-4 h-4 animate-spin text-amber-400" /> : <Upload className="w-4 h-4 text-amber-400" />}
                          <span className="text-[10px] font-bold text-amber-400 text-center leading-tight">{uploadingProof === c.id ? "Enviando…" : "Subir comprovante"}</span>
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadProof(c, f); }} />
                        </label>
                      ) : (
                        <div className="flex-1 min-w-0 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-2.5 flex flex-col items-center justify-center gap-1">
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-[10px] font-bold text-emerald-400 text-center leading-tight">Comprovante enviado</span>
                        </div>
                      )}
                    </div>

                    {iPaid && (
                      <div className="flex items-center justify-center gap-2 rounded-lg bg-card border border-border/60 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          {(iAmChallenger ? c.opponent_paid : c.challenger_paid) ? "Admins avaliando a competição…" : "Aguardando o oponente enviar o comprovante…"}
                        </span>
                      </div>
                    )}

                    {isAdmin && (
                      <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-primary">Admin · conferir pagamento</p>
                        <div className="flex gap-2">
                          <button onClick={() => viewProof(c.challenger_proof_url)} disabled={!c.challenger_proof_url} className="flex-1 min-w-0 h-9 rounded-lg bg-card border border-border text-xs font-bold text-foreground disabled:opacity-40 inline-flex items-center justify-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> {name(c.challenger_id)}
                          </button>
                          <button onClick={() => viewProof(c.opponent_proof_url)} disabled={!c.opponent_proof_url} className="flex-1 min-w-0 h-9 rounded-lg bg-card border border-border text-xs font-bold text-foreground disabled:opacity-40 inline-flex items-center justify-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> {name(c.opponent_id)}
                          </button>
                        </div>
                        <button onClick={() => adminConfirmPayment(c.id)} className="w-full h-9 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold">
                          Confirmar pagamento dos dois → liberar duelo
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* ----- active: em andamento ----- */}
                {c.status === "active" && (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-amber-400">⚔️ Desafio em andamento</p>
                    <p className="text-[11px] text-muted-foreground">
                      {dateBR(c.scheduled_date)}
                      {c.goal_amount ? ` · meta ${fmt(c.goal_amount)}` : ""}
                    </p>
                    {c.stakes_amount > 0 && (
                      <p className="text-[11px] text-emerald-400 font-semibold">
                        💰 {fmt(c.stakes_amount * 2)} garantidos na carteira · resultado automático às 9h do dia seguinte pelo extrato verificado — não esquece de subir o seu!
                      </p>
                    )}
                    {isAdmin && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-primary">Admin · premiar vencedor</p>
                        {evidence(c)}
                        <div className="flex gap-2">
                          <button onClick={() => setWinner(c, c.challenger_id)} className="flex-1 h-9 rounded-lg bg-card border border-border text-xs font-bold text-foreground">
                            <Trophy className="w-3.5 h-3.5 inline mr-1 text-amber-400" />{name(c.challenger_id)}
                          </button>
                          <button onClick={() => setWinner(c, c.opponent_id)} className="flex-1 h-9 rounded-lg bg-card border border-border text-xs font-bold text-foreground">
                            <Trophy className="w-3.5 h-3.5 inline mr-1 text-amber-400" />{name(c.opponent_id)}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ----- ARENA ao vivo: abre SOZINHA no dia do duelo ----- */}
                {(c.status === "accepted" || c.status === "active") && (() => {
                  const hojeEhODia = c.scheduled_date === getBrazilDate();
                  const aberto = openPlacar === c.id || (c.status === "active" && hojeEhODia && openPlacar !== `fechado:${c.id}`);
                  return (
                    <div className="space-y-2 pt-1">
                      {aberto && placarView(c, iAmChallenger)}
                      <button
                        onClick={() => setOpenPlacar(aberto ? `fechado:${c.id}` : c.id)}
                        className="w-full h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400/80 text-[11px] font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                      >
                        <Swords className="w-3 h-3" /> {aberto ? "Esconder arena" : "Abrir arena ⚔️"}
                      </button>
                    </div>
                  );
                })()}

                {/* ----- finished: vencedor ----- */}
                {c.status === "finished" && c.winner_user_id && (
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    🏆 Vencedor: <span className="text-amber-400">{name(c.winner_user_id)}</span>
                    {c.prize_amount > 0 ? ` · prêmio ${fmt(c.prize_amount)}` : ""}
                  </p>
                )}

                {/* ----- admin: aguardando resultado (legado) ----- */}
                {isAdmin && c.status === "awaiting_result" && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary">Admin · definir vencedor</p>
                    {evidence(c)}
                    <div className="flex gap-2">
                      <button onClick={() => setWinner(c, c.challenger_id)} className="flex-1 h-9 rounded-lg bg-card border border-border text-xs font-bold text-foreground">
                        <Trophy className="w-3.5 h-3.5 inline mr-1 text-amber-400" />{name(c.challenger_id)}
                      </button>
                      <button onClick={() => setWinner(c, c.opponent_id)} className="flex-1 h-9 rounded-lg bg-card border border-border text-xs font-bold text-foreground">
                        <Trophy className="w-3.5 h-3.5 inline mr-1 text-amber-400" />{name(c.opponent_id)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PublicProfileModal open={!!profileUid} onOpenChange={(v) => !v && setProfileUid(null)} userId={profileUid} />
    </div>
  );
}
