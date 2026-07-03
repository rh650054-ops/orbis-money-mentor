import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { toast } from "@/shared/hooks/use-toast";
import PublicProfileModal from "@/components/PublicProfileModal";
import { ArrowLeft, Swords, Plus, Check, X, Search, Copy, Upload, Loader2, ChevronRight } from "lucide-react";

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
// ADMIN: os painéis de administração (tesouraria, carteiras, depósitos, liquidação
// e revisões) saíram desta tela → agora moram em Perfil → Administração (/admin).

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
  const [uploadingProof, setUploadingProof] = useState<string | null>(null); // id do X1 subindo comprovante
  const [openPlacar, setOpenPlacar] = useState<string | null>(null); // id do X1 com o placar aberto
  const [placar, setPlacar] = useState<Record<string, { ch: number; op: number }>>({}); // totais ao vivo por duelo
  const prevStatusRef = useRef<Record<string, string>>({}); // status anterior de cada duelo (pra avisar "liberado")
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "new">("list");
  const [profileUid, setProfileUid] = useState<string | null>(null);

  // Carteira X1: saldo interno — aposta sai daqui na hora do aceite, prêmio cai aqui.
  const [saldo, setSaldo] = useState(0);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [depositOpen, setDepositOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false); // abre a "tela" da carteira (saque/depósito)
  // Depósito por comprovante: sobe o recibo do Pix, a IA valida e credita sozinha.
  const [enviandoComprovante, setEnviandoComprovante] = useState(false);
  // Depósito AUTOMÁTICO (Mercado Pago): QR dinâmico + webhook = saldo cai sozinho.
  const [mpValor, setMpValor] = useState("20");
  const [mpGerando, setMpGerando] = useState(false);
  const [mpQr, setMpQr] = useState<null | { paymentId: string; valor: number; copiaCola: string; qrB64: string | null }>(null);
  // SAQUE: pede valor + chave Pix, o valor é reservado (sai do saldo na hora) e o
  // admin envia o Pix manualmente pela Central de Admin. 1 pedido pendente por vez.
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wd, setWd] = useState({ valor: "", pix: "", nome: "" });
  const [wdSending, setWdSending] = useState(false);
  const [wdPend, setWdPend] = useState<null | { id: string; valor: number; created_at: string }>(null);
  // Celebração pós-aceite: card "DUELO INICIADO" + envio pro DEFCON se for hoje.
  const [duelStarted, setDuelStarted] = useState<null | { nome: string; stakes: number; hoje: boolean; data: string | null }>(null);

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

    const { data: st } = await supabase.from("x1_settings" as any).select("pix_account, fee_flat").eq("id", 1).maybeSingle();
    setSettings((st as any) || { pix_account: null, fee_flat: 0 });

    // Carteira: saldo + últimas movimentações + saque pendente (se houver).
    const [{ data: w }, { data: tx }, { data: wds }] = await Promise.all([
      supabase.from("x1_wallets" as any).select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("x1_wallet_transactions" as any).select("id, amount, tipo, notes, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("x1_withdraw_requests" as any).select("id, valor, created_at").eq("user_id", user.id).eq("status", "pendente").limit(1),
    ]);
    setSaldo(Number((w as any)?.balance ?? 0));
    setTxs(((tx as any[]) || []) as WalletTx[]);
    setWdPend((((wds as any[]) || [])[0] as any) ?? null);
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
  // Aceite com celebração: desconta a aposta, mostra o card de "DUELO INICIADO"
  // e manda pro DEFCON se o duelo for HOJE.
  const aceitarDuelo = async (c: X1) => {
    const { error } = await (supabase as any).rpc("x1_negotiate", {
      p_id: c.id, p_action: "accept", p_pix: null, p_nome: null, p_modo: null, p_goal: null, p_stakes: null, p_date: null,
    });
    if (error) {
      toast({ title: "Não rolou", description: error.message, variant: "destructive" });
      return;
    }
    const other = c.challenger_id === user?.id ? c.opponent_id : c.challenger_id;
    setDuelStarted({
      nome: name(other),
      stakes: c.stakes_amount,
      hoje: c.scheduled_date === getBrazilDate(),
      data: c.scheduled_date,
    });
    loadAll();
  };

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

  const name = (uid: string) => profiles[uid]?.nome_usuario || "Vendedor";

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
  // Gera o QR Pix dinâmico no Mercado Pago.
  const mpGerarQr = async () => {
    const v = Number(mpValor) || 0;
    if (v < 1) { toast({ title: "Valor mínimo R$ 1", variant: "destructive" }); return; }
    setMpGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke("mp-criar-deposito", { body: { valor: v } });
      const r = data as any;
      if (error || !r?.ok) {
        toast({ title: "Não rolou", description: r?.dica ?? "Tenta de novo.", variant: "destructive" });
      } else {
        setMpQr({ paymentId: r.payment_id, valor: r.valor, copiaCola: r.copia_cola, qrB64: r.qr_base64 });
      }
    } catch { toast({ title: "Não rolou", variant: "destructive" }); }
    setMpGerando(false);
  };
  // Enquanto o QR está na tela, vigia o pagamento — quando o MP confirmar, festeja.
  useEffect(() => {
    if (!mpQr) return;
    const t = setInterval(async () => {
      const { data } = await supabase.from("x1_mp_payments" as any).select("status").eq("payment_id", mpQr.paymentId).maybeSingle();
      if ((data as any)?.status === "creditado") {
        clearInterval(t);
        toast({ title: `💰 +${fmt(mpQr.valor)} na carteira!`, description: "Pix confirmado pelo Mercado Pago. Bora duelar! ⚔️" });
        setMpQr(null);
        loadAll();
      }
    }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mpQr?.paymentId]);

  // Solicita o saque: o banco debita o valor NA HORA (reserva) e cria o pedido
  // que aparece na Central de Admin. Se o admin rejeitar, o valor volta sozinho.
  const solicitarSaque = async () => {
    const v = Number(wd.valor) || 0;
    if (v < 1) { toast({ title: "Valor mínimo de saque: R$ 1", variant: "destructive" }); return; }
    if (v > saldo) { toast({ title: `Seu saldo é ${fmt(saldo)}`, description: "Não dá pra sacar mais do que tem.", variant: "destructive" }); return; }
    if (wd.pix.trim().length < 3) { toast({ title: "Digita a chave Pix que vai receber", variant: "destructive" }); return; }
    setWdSending(true);
    const { error } = await (supabase as any).rpc("x1_request_withdraw", {
      p_valor: v, p_pix: wd.pix.trim(), p_nome: wd.nome.trim() || null,
    });
    setWdSending(false);
    if (error) {
      toast({ title: "Não rolou", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `💸 Saque de ${fmt(v)} solicitado!`, description: "O valor foi reservado — o Pix cai na sua chave assim que o admin enviar." });
    setWd({ valor: "", pix: "", nome: "" });
    setWithdrawOpen(false);
    loadAll();
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
            {av(meId, lead === "me" ? "#22c55e" : "#f59e0b", lead === "me" ? "rgba(34,197,94,.6)" : "rgba(245,158,11,.35)")}
            <p className="text-[10px] uppercase tracking-wider text-amber-400 font-bold">Você</p>
            <p className="text-xl font-black tabular-nums" style={{ color: lead === "me" ? "#22c55e" : "#fff" }}>{fmt(my)}</p>
          </div>
          <div className="shrink-0 flex flex-col items-center">
            <span className="text-2xl font-black italic text-amber-400" style={{ textShadow: "0 0 16px rgba(245,158,11,.8)" }}>VS</span>
            {lead !== "load" && lead !== "tie" && <span className="text-lg">{lead === "me" ? "🔥" : "⚠️"}</span>}
          </div>
          <div className="flex-1 min-w-0 flex flex-col items-center gap-1">
            {av(otherId, lead === "opp" ? "#22c55e" : "#ef4444", lead === "opp" ? "rgba(34,197,94,.6)" : "rgba(239,68,68,.35)")}
            <p className="text-[10px] uppercase tracking-wider text-red-400 font-bold truncate max-w-full">{otherName}</p>
            <p className="text-xl font-black tabular-nums" style={{ color: lead === "opp" ? "#22c55e" : "#fff" }}>{fmt(opp)}</p>
          </div>
        </div>
        {/* Barras de energia */}
        <div className="space-y-1.5">
          <div className="h-2.5 rounded-full bg-black/50 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barMy}%`, background: "linear-gradient(90deg,#b45309,#f59e0b)", boxShadow: "0 0 10px rgba(245,158,11,.6)" }} />
          </div>
          <div className="h-2.5 rounded-full bg-black/50 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barOpp}%`, background: "linear-gradient(90deg,#991b1b,#ef4444)", boxShadow: "0 0 10px rgba(239,68,68,.6)" }} />
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
                  <div className="w-16 h-16 rounded-full bg-amber-500/15 border-[3px] border-amber-400 flex items-center justify-center text-lg font-black text-amber-300" style={{ boxShadow: "0 0 18px rgba(245,158,11,.4)" }}>
                    VC
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">Você</p>
                </div>
                <span className="text-3xl font-black italic text-amber-400 shrink-0" style={{ textShadow: "0 0 18px rgba(245,158,11,.8)" }}>VS</span>
                <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  {opp.avatar_url ? (
                    <img src={opp.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border-[3px] border-red-400" style={{ boxShadow: "0 0 18px rgba(239,68,68,.4)" }} />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-muted border-[3px] border-red-400 flex items-center justify-center text-lg font-black">{(opp.nome_usuario ?? "?").slice(0, 2).toUpperCase()}</div>
                  )}
                  <p className="text-[10px] font-black uppercase tracking-wider text-red-400 truncate max-w-full">{opp.nome_usuario || "Vendedor"}</p>
                </div>
              </div>
              <button onClick={() => setOpp(null)} className="block mx-auto mt-2 text-[10px] text-muted-foreground underline">trocar oponente</button>
            </div>
            {/* REGRAS DO COMBATE */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mb-1.5">⚡ Regra do combate</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {["Quem fatura mais no dia", "Quem bate a meta primeiro", "Só Pix: quem recebe mais"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setModo(m)}
                    className="px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all active:scale-95"
                    style={modo === m
                      ? { background: "#f59e0b", color: "#000", boxShadow: "0 0 10px rgba(245,158,11,.5)" }
                      : { background: "#141417", color: "#9ca3af", border: "1px solid #26262e" }}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <input
                value={modo}
                onChange={(e) => setModo(e.target.value)}
                placeholder="…ou escreve a sua regra"
                className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground"
              />
            </div>

            {/* DIA */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 mb-1.5">📅 Dia do duelo</p>
              <div className="flex gap-1.5">
                {(() => {
                  const hoje = getBrazilDate();
                  const amanha = (() => { const d = new Date(`${hoje}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
                  return (
                    <>
                      {[["HOJE", hoje], ["AMANHÃ", amanha]].map(([lbl, val]) => (
                        <button
                          key={lbl}
                          onClick={() => setSchedDate(val!)}
                          className="flex-1 h-10 rounded-xl text-xs font-black transition-all active:scale-95"
                          style={schedDate === val
                            ? { background: "#f59e0b", color: "#000", boxShadow: "0 0 10px rgba(245,158,11,.5)" }
                            : { background: "#141417", color: "#9ca3af", border: "1px solid #26262e" }}
                        >
                          {lbl}
                        </button>
                      ))}
                      <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} className="flex-1 h-10 px-2 rounded-xl bg-card border border-border text-xs text-foreground" />
                    </>
                  );
                })()}
              </div>
            </div>

            {/* APOSTA: fichas de cassino */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 mb-1.5">💰 Aposta de cada um</p>
              <div className="grid grid-cols-5 gap-1.5 mb-2">
                {[0, 10, 20, 50, 100].map((v) => {
                  const ativo = Number(stakes) === v;
                  return (
                    <button
                      key={v}
                      onClick={() => setStakes(String(v))}
                      className="h-12 rounded-xl flex flex-col items-center justify-center font-black transition-all active:scale-90"
                      style={ativo
                        ? v === 0
                          ? { background: "#1c2a1e", color: "#4ade80", border: "1px solid #22c55e", boxShadow: "0 0 12px rgba(34,197,94,.4)" }
                          : { background: "linear-gradient(160deg,#3b0a0a,#1a0505)", color: "#f87171", border: "1px solid rgba(239,68,68,.7)", boxShadow: "0 0 14px rgba(239,68,68,.5)" }
                        : { background: "#141417", color: "#9ca3af", border: "1px solid #26262e" }}
                    >
                      <span className="text-[13px] leading-none">{v === 0 ? "🤝" : `R$${v}`}</span>
                      <span className="text-[7px] uppercase tracking-wider mt-0.5">{v === 0 ? "amistoso" : "cada"}</span>
                    </button>
                  );
                })}
              </div>
              <input type="number" inputMode="numeric" value={stakes} onChange={(e) => setStakes(e.target.value)} placeholder="Outro valor" className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground" />
              {/* Prêmio em destaque */}
              {Number(stakes) > 0 && (
                <div className="mt-2 rounded-xl border border-amber-500/40 p-3 text-center" style={{ background: "radial-gradient(ellipse at top,#1a1206,#0c0c0f)" }}>
                  <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">O vencedor leva</p>
                  <p className="text-2xl font-black text-amber-400 tabular-nums" style={{ textShadow: "0 0 16px rgba(245,158,11,.6)" }}>
                    🏆 {fmt(Math.max(0, Number(stakes) * 2 * 0.9))}
                  </p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">pote {fmt(Number(stakes) * 2)} − 10% do Orbis · sai da carteira no aceite · cai na carteira às 9h pelo extrato</p>
                  {saldo < Number(stakes) && (
                    <p className="text-[10px] font-bold text-red-400 mt-1">⚠️ Seu saldo é {fmt(saldo)} — deposita antes do aceite!</p>
                  )}
                </div>
              )}
            </div>

            {/* Meta opcional (discreta) */}
            <details className="rounded-xl bg-card/40 border border-border/50 px-3 py-2">
              <summary className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer">🎯 Meta pra ganhar (opcional)</summary>
              <input type="number" inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Ex: 1000" className="w-full h-10 px-3 rounded-xl bg-card border border-border text-sm text-foreground mt-2" />
            </details>

            <button
              onClick={createX1}
              disabled={saving}
              className="w-full h-14 rounded-2xl font-black text-base active:scale-[0.97] transition-transform disabled:opacity-60"
              style={Number(stakes) > 0
                ? { background: "linear-gradient(160deg,#7f1d1d,#450a0a)", color: "#fecaca", border: "1px solid rgba(239,68,68,.6)", boxShadow: "0 0 24px rgba(239,68,68,.45)", textShadow: "0 0 10px rgba(239,68,68,.8)" }
                : { background: "#f59e0b", color: "#000" }}
            >
              {saving ? "Enviando…" : Number(stakes) > 0 ? `⚔️ DESAFIAR VALENDO ${fmt(Number(stakes) * 2)}` : "⚔️ Enviar desafio amistoso"}
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

      {/* ===== Carteira X1: deposita uma vez, duela sem burocracia =====
           PRÉVIA: enquanto CARTEIRA_LIBERADA=false, usuário comum NÃO vê. */}
      {(CARTEIRA_LIBERADA || isAdmin) && (
      <>
      {/* Card COMPACTO na tela: só o valor. Toca -> abre a tela da carteira. */}
      <button
        onClick={() => setWalletOpen(true)}
        className="w-full text-left rounded-2xl border border-amber-500/40 p-4 flex items-center justify-between gap-3 active:scale-[0.99] transition-transform"
        style={{ background: "radial-gradient(ellipse at top left, rgba(245,158,11,.16) 0%, #0c0c0f 60%)" }}
      >
        <div>
          {!CARTEIRA_LIBERADA && (
            <p className="text-[9px] font-black uppercase tracking-wider text-amber-400">🔒 Prévia — usuários ainda não veem</p>
          )}
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">💰 Sua carteira X1</p>
          <p className="text-3xl sm:text-4xl font-black text-amber-300 tabular-nums leading-none mt-0.5" style={{ textShadow: "0 0 20px rgba(245,158,11,.35)" }}>{fmt(saldo)}</p>
          <p className="text-[10px] text-muted-foreground mt-1">toque para sacar ou depositar</p>
        </div>
        <ChevronRight className="w-6 h-6 text-amber-400 shrink-0" />
      </button>

      {/* TELA da carteira (abre por cima): saque + depósito + histórico */}
      {walletOpen && (
      <div className="fixed inset-0 z-[60] bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-24 space-y-3">
          <div className="flex items-center gap-3">
            <button onClick={() => { setWalletOpen(false); setWithdrawOpen(false); setDepositOpen(false); }} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/40">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-foreground">Sua carteira X1</h1>
          </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">💰 Saldo</p>
            <p className="text-3xl sm:text-4xl font-black text-amber-300 tabular-nums leading-none mt-0.5" style={{ textShadow: "0 0 20px rgba(245,158,11,.35)" }}>{fmt(saldo)}</p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button
              onClick={() => { setWithdrawOpen((v) => !v); setDepositOpen(false); }}
              className="h-10 px-3.5 rounded-xl bg-card border border-amber-500/40 text-amber-400 text-xs font-bold active:scale-[0.98]"
            >
              {withdrawOpen ? "Fechar" : "Sacar"}
            </button>
            <button
              onClick={() => { setDepositOpen((v) => !v); setWithdrawOpen(false); }}
              className="h-10 px-3.5 rounded-xl bg-amber-500 text-black text-xs font-bold active:scale-[0.98]"
            >
              {depositOpen ? "Fechar" : "Depositar"}
            </button>
          </div>
        </div>

        {/* Saque pendente: mostra o status até o admin enviar o Pix */}
        {wdPend && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-2.5 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
            <p className="text-[11px] text-amber-400 font-semibold leading-snug">
              Saque de {fmt(wdPend.valor)} solicitado — o valor já foi reservado e o Pix cai na sua chave assim que o admin enviar.
            </p>
          </div>
        )}

        {/* ===== SACAR: valor + chave Pix → pedido vai pra Central de Admin ===== */}
        {withdrawOpen && (
          <div className="rounded-xl bg-card border border-border/60 p-3 space-y-2">
            {wdPend ? (
              <p className="text-[11px] text-muted-foreground">
                Você já tem um saque aguardando envio. Espera ele cair pra pedir outro.
              </p>
            ) : (
              <>
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">💸 Sacar da carteira</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O valor sai do saldo agora (fica reservado) e o <b className="text-foreground">Pix cai na sua chave</b> assim que o admin enviar. Se algo der errado, o valor volta pro saldo.
                </p>
                <div className="flex gap-1.5">
                  {[10, 20, 50].map((v) => (
                    <button key={v} onClick={() => setWd((s) => ({ ...s, valor: String(v) }))}
                      disabled={saldo < v}
                      className="flex-1 h-9 rounded-lg text-xs font-black transition-all active:scale-95 disabled:opacity-30"
                      style={Number(wd.valor) === v
                        ? { background: "#10b981", color: "#000", boxShadow: "0 0 10px rgba(16,185,129,.5)" }
                        : { background: "#141417", color: "#9ca3af", border: "1px solid #26262e" }}>
                      R${v}
                    </button>
                  ))}
                  <button onClick={() => setWd((s) => ({ ...s, valor: String(saldo) }))}
                    disabled={saldo < 1}
                    className="flex-1 h-9 rounded-lg text-xs font-black transition-all active:scale-95 disabled:opacity-30"
                    style={Number(wd.valor) === saldo && saldo >= 1
                      ? { background: "#10b981", color: "#000", boxShadow: "0 0 10px rgba(16,185,129,.5)" }
                      : { background: "#141417", color: "#9ca3af", border: "1px solid #26262e" }}>
                    TUDO
                  </button>
                </div>
                <input type="number" inputMode="numeric" value={wd.valor} onChange={(e) => setWd((s) => ({ ...s, valor: e.target.value }))} placeholder="Outro valor (R$)" className="w-full h-10 px-3 rounded-xl bg-[#0e0e10] border border-border text-sm text-foreground" />
                <input value={wd.pix} onChange={(e) => setWd((s) => ({ ...s, pix: e.target.value }))} placeholder="Chave Pix que vai receber" className="w-full h-10 px-3 rounded-xl bg-[#0e0e10] border border-border text-sm text-foreground" />
                <input value={wd.nome} onChange={(e) => setWd((s) => ({ ...s, nome: e.target.value }))} placeholder="Nome do titular (opcional)" className="w-full h-10 px-3 rounded-xl bg-[#0e0e10] border border-border text-sm text-foreground" />
                <button
                  onClick={solicitarSaque}
                  disabled={wdSending || (Number(wd.valor) || 0) < 1 || wd.pix.trim().length < 3}
                  className="w-full h-10 rounded-xl bg-emerald-500 text-black text-xs font-black active:scale-[0.98] disabled:opacity-40 inline-flex items-center justify-center gap-1.5"
                >
                  {wdSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "💸"} {wdSending ? "Enviando…" : `Sacar ${fmt(Number(wd.valor) || 0)}`}
                </button>
              </>
            )}
          </div>
        )}
        {depositOpen && (
          <div className="rounded-xl bg-card border border-border/60 p-3 space-y-2">
            {/* ===== PIX AUTOMÁTICO (Mercado Pago): paga o QR e o saldo cai SOZINHO ===== */}
            {!mpQr ? (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">⚡ Pix automático — cai na hora, sem comprovante</p>
                <div className="flex gap-1.5">
                  {[10, 20, 50].map((v) => (
                    <button key={v} onClick={() => setMpValor(String(v))}
                      className="flex-1 h-9 rounded-lg text-xs font-black transition-all active:scale-95"
                      style={Number(mpValor) === v
                        ? { background: "#10b981", color: "#000", boxShadow: "0 0 10px rgba(16,185,129,.5)" }
                        : { background: "#141417", color: "#9ca3af", border: "1px solid #26262e" }}>
                      R${v}
                    </button>
                  ))}
                  <input type="number" inputMode="numeric" value={mpValor} onChange={(e) => setMpValor(e.target.value)} className="w-20 h-9 px-2 rounded-lg bg-[#0e0e10] border border-border text-xs text-foreground" />
                </div>
                <button onClick={mpGerarQr} disabled={mpGerando} className="w-full h-10 rounded-xl bg-emerald-500 text-black text-xs font-black active:scale-[0.98] disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
                  {mpGerando ? <Loader2 className="w-4 h-4 animate-spin" /> : "⚡"} {mpGerando ? "Gerando…" : `Gerar Pix de ${fmt(Number(mpValor) || 0)}`}
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">⚡ Pague {fmt(mpQr.valor)} — o saldo cai sozinho</p>
                {mpQr.qrB64 && <img src={`data:image/png;base64,${mpQr.qrB64}`} alt="QR Pix" className="w-40 h-40 mx-auto rounded-lg bg-white p-1.5" />}
                <button
                  onClick={() => navigator.clipboard?.writeText(mpQr.copiaCola).then(() => toast({ title: "Código Pix copiado!" }), () => {})}
                  className="w-full h-9 rounded-lg bg-[#0e0e10] border border-border text-[11px] font-bold text-emerald-400 inline-flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> Copiar código Pix (copia e cola)
                </button>
                <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1.5 justify-center">
                  <Loader2 className="w-3 h-3 animate-spin" /> Esperando o pagamento… confirma em segundos
                </p>
                <button onClick={() => setMpQr(null)} className="text-[10px] text-muted-foreground underline">cancelar</button>
              </div>
            )}

            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center pt-1">— ou manual, com comprovante —</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <b className="text-foreground">1.</b> Faça o Pix pra chave abaixo · <b className="text-foreground">2.</b> Suba o comprovante aqui —
              a IA confere e <b className="text-emerald-400">o saldo cai na hora</b> (depósitos até R$ 100; acima disso o admin confere primeiro).
              O prêmio dos duelos também cai aqui. Pra tirar dinheiro, usa o botão <b className="text-emerald-400">Sacar</b>.
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
      </div>
      )}
      </>
      )}

      <button onClick={openNew} className="w-full h-12 rounded-xl bg-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
        <Plus className="w-4 h-4" /> Chamar alguém pra X1
      </button>

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
            // Personalidade do card por status: desafio pendente PULSA em vermelho,
            // duelo ativo brilha dourado, vitória em verde, resto apagado.
            const meuTurno = c.status === "pending" && c.last_proposed_by !== user?.id;
            const venci = c.winner_user_id === user?.id;
            const perdi = !!c.winner_user_id && c.winner_user_id !== user?.id;
            const cardStyle: React.CSSProperties =
              meuTurno
                ? { background: "linear-gradient(160deg,#1c0808,#0c0c0f)", border: "1px solid rgba(239,68,68,.5)", boxShadow: "0 0 16px rgba(239,68,68,.25)" }
                : c.status === "active"
                  ? { background: "radial-gradient(ellipse at top,#171006,#0c0c0f 70%)", border: "1px solid rgba(245,158,11,.45)", boxShadow: "0 0 16px rgba(245,158,11,.2)" }
                  : venci
                    ? { background: "linear-gradient(160deg,#0a1a0e,#0c0c0f)", border: "1px solid rgba(34,197,94,.4)" }
                    : { background: "#101014", border: "1px solid #26262e", opacity: c.status === "declined" || c.status === "cancelled" ? 0.55 : 1 };
            const statusPill = meuTurno
              ? { txt: "⚔️ TE DESAFIOU!", bg: "#3b0a0a", fg: "#f87171" }
              : c.status === "pending"
                ? { txt: "⏳ AGUARDANDO", bg: "#1c1c22", fg: "#9ca3af" }
                : c.status === "active"
                  ? { txt: "🔴 AO VIVO", bg: "#2a1a05", fg: "#f59e0b" }
                  : venci
                    ? { txt: "VOCÊ VENCEU 🏆", bg: "#16331f", fg: "#22c55e" }
                    : perdi
                      ? { txt: "DERROTA", bg: "#2a2a2e", fg: "#9ca3af" }
                      : c.status === "awaiting_result"
                        ? { txt: "🔎 EM ANÁLISE", bg: "#1c1c22", fg: "#c9a6ff" }
                        : { txt: statusLabel[c.status] || c.status, bg: "#1c1c22", fg: "#6b7280" };
            return (
              <div key={c.id} className={`rounded-2xl p-4 space-y-2 ${meuTurno ? "animate-pulse-slow" : ""}`} style={cardStyle}>
                <div className="flex items-center gap-3">
                  <button onClick={() => setProfileUid(other)} className="shrink-0 relative">
                    {profiles[other]?.avatar_url ? (
                      <img src={profiles[other]!.avatar_url!} alt="" className="w-11 h-11 rounded-full object-cover border-2" style={{ borderColor: meuTurno ? "#ef4444" : c.status === "active" ? "#f59e0b" : "#3f3f46" }} />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-xs font-black text-foreground border-2" style={{ borderColor: meuTurno ? "#ef4444" : "#3f3f46" }}>{name(other).slice(0, 2).toUpperCase()}</div>
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground truncate">
                      <span className="text-muted-foreground font-bold">VS</span> {name(other)}
                      <span className="ml-1 text-[9px] font-bold text-muted-foreground">{iAmChallenger ? "(você chamou)" : "(te chamou)"}</span>
                    </p>
                    {c.modo && <p className="text-[10px] text-amber-400/90 font-semibold truncate">⚡ {c.modo}</p>}
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-muted-foreground">📅 {dateBR(c.scheduled_date)}</span>
                      {c.stakes_amount > 0 && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: "#2a1a05", color: "#f59e0b" }}>💰 {fmt(c.stakes_amount * 2)} no pote</span>}
                      {c.goal_amount ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-muted-foreground">🎯 {fmt(c.goal_amount)}</span> : null}
                      {c.prize_amount > 0 && c.status === "finished" && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: "#16331f", color: "#22c55e" }}>🏆 {fmt(c.prize_amount)}</span>}
                    </div>
                  </div>
                  <span className="text-[9px] font-black px-2 py-1 rounded-full shrink-0" style={{ background: statusPill.bg, color: statusPill.fg }}>
                    {statusPill.txt}
                  </span>
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

                          {/* CONTRATO DE DUELO: confirma o desconto e começa NA HORA */}
                          {f.open === "accept" && (
                            <div className="rounded-2xl border border-red-500/40 p-3.5 space-y-2.5" style={{ background: "radial-gradient(ellipse at top,#1a0808,#0c0c0f 70%)" }}>
                              <p className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-red-400">⚔️ Contrato de duelo</p>
                              {c.stakes_amount > 0 ? (
                                <>
                                  <div className="grid grid-cols-2 gap-2 text-center">
                                    <div className="rounded-xl bg-black/40 border border-red-500/30 p-2">
                                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Sai da sua carteira</p>
                                      <p className="text-lg font-black text-red-400 tabular-nums">−{fmt(c.stakes_amount)}</p>
                                    </div>
                                    <div className="rounded-xl bg-black/40 border border-amber-500/30 p-2">
                                      <p className="text-[9px] uppercase font-bold text-muted-foreground">Se vencer, leva</p>
                                      <p className="text-lg font-black text-amber-400 tabular-nums">🏆 {fmt(Math.max(0, c.stakes_amount * 2 * 0.9))}</p>
                                    </div>
                                  </div>
                                  <p className={`text-center text-[11px] font-bold ${saldo >= c.stakes_amount ? "text-emerald-400" : "text-red-400"}`}>
                                    {saldo >= c.stakes_amount ? `Saldo: ${fmt(saldo)} ✓ pronto pra guerra` : `⚠️ Saldo ${fmt(saldo)} — falta ${fmt(c.stakes_amount - saldo)}. Deposita primeiro!`}
                                  </p>
                                  <p className="text-center text-[9px] text-muted-foreground">O oponente também tem {fmt(c.stakes_amount)} descontado. Resultado às 9h pelo extrato verificado — sem choro.</p>
                                </>
                              ) : (
                                <p className="text-center text-[11px] text-muted-foreground">Amistoso — sem aposta, valendo a honra. 🏆</p>
                              )}
                              <button
                                onClick={() => aceitarDuelo(c)}
                                disabled={c.stakes_amount > 0 && saldo < c.stakes_amount}
                                className="w-full h-12 rounded-xl font-black text-sm active:scale-[0.97] transition-transform disabled:opacity-50"
                                style={c.stakes_amount > 0
                                  ? { background: "linear-gradient(160deg,#7f1d1d,#450a0a)", color: "#fecaca", border: "1px solid rgba(239,68,68,.6)", boxShadow: "0 0 20px rgba(239,68,68,.45)", textShadow: "0 0 10px rgba(239,68,68,.8)" }
                                  : { background: "#16a34a", color: "#fff" }}
                              >
                                {c.stakes_amount > 0 ? `⚔️ ASSINAR — DESCONTAR ${fmt(c.stakes_amount)} E LUTAR` : "⚔️ COMEÇAR O DUELO"}
                              </button>
                              <button onClick={() => patchNeg(c, { open: null })} className="w-full text-[10px] text-muted-foreground underline">voltar</button>
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

                    {/* Conferência de pagamento pelo admin → Perfil → Administração */}
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
                      <div className="pt-2 mt-1 border-t border-amber-500/15 space-y-1.5">
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-400">🛠️ Admin</p>
                        <button
                          onClick={() => cancelX1(c.id)}
                          className="w-full h-8 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold active:scale-[0.98] transition-transform"
                        >
                          Cancelar / encerrar este desafio
                        </button>
                        <p className="text-[9px] text-muted-foreground leading-snug">
                          Definir vencedor com prêmio: Perfil → Administração.
                        </p>
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

                {/* Definição de vencedor pelo admin → Perfil → Administração */}
              </div>
            );
          })}
        </div>
      )}

      <PublicProfileModal open={!!profileUid} onOpenChange={(v) => !v && setProfileUid(null)} userId={profileUid} />

      {/* ===== DUELO INICIADO: celebração pós-aceite + rota pro DEFCON ===== */}
      {duelStarted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.85)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm rounded-3xl border border-amber-500/50 p-6 text-center space-y-3 animate-in zoom-in-95" style={{ background: "radial-gradient(ellipse at top,#1a1206,#0c0c0f 70%)", boxShadow: "0 0 60px rgba(245,158,11,.25)" }}>
            <p className="text-5xl">⚔️</p>
            <p className="text-xl font-black text-white" style={{ textShadow: "0 0 20px rgba(245,158,11,.6)" }}>DUELO INICIADO!</p>
            <p className="text-sm text-muted-foreground">
              Você <span className="text-amber-400 font-black italic">VS</span> <span className="text-foreground font-bold">{duelStarted.nome}</span>
              {duelStarted.stakes > 0 && <> · <span className="text-amber-400 font-black">{fmt(duelStarted.stakes * 2)} em jogo</span></>}
            </p>
            {duelStarted.stakes > 0 && (
              <p className="text-[11px] text-emerald-400 font-semibold">💰 Apostas garantidas na carteira. O extrato das 9h decide — cada venda conta.</p>
            )}
            {duelStarted.hoje ? (
              <button
                onClick={() => {
                  setDuelStarted(null);
                  toast({ title: "🔥 É HOJE. É AGORA.", description: `${duelStarted.nome} já tá na rua. Cada venda te deixa na frente — VAI!` });
                  navigate("/defcon");
                }}
                className="w-full h-13 py-3.5 rounded-2xl font-black text-sm active:scale-[0.97] transition-transform"
                style={{ background: "linear-gradient(160deg,#7f1d1d,#450a0a)", color: "#fecaca", border: "1px solid rgba(239,68,68,.6)", boxShadow: "0 0 24px rgba(239,68,68,.5)", textShadow: "0 0 10px rgba(239,68,68,.8)" }}
              >
                🔥 IR PRO DEFCON E COMEÇAR A VENDER
              </button>
            ) : (
              <p className="text-[11px] font-bold text-amber-400">📅 O duelo é {dateBR(duelStarted.data)} — descansa hoje, amanhã é guerra.</p>
            )}
            <button onClick={() => setDuelStarted(null)} className="text-[11px] text-muted-foreground underline">fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
