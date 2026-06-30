import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { toast } from "@/shared/hooks/use-toast";
import PublicProfileModal from "@/components/PublicProfileModal";
import { ArrowLeft, Swords, Plus, Trophy, Check, X, Search, Copy } from "lucide-react";

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
  pending: "Aguardando aceite",
  accepted: "Aceito",
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
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"list" | "new">("list");
  const [profileUid, setProfileUid] = useState<string | null>(null);

  // novo desafio
  const [ranking, setRanking] = useState<RankUser[]>([]);
  const [search, setSearch] = useState("");
  const [opp, setOpp] = useState<RankUser | null>(null);
  const [schedDate, setSchedDate] = useState(getBrazilDate());
  const [goal, setGoal] = useState("");
  const [stakes, setStakes] = useState("0");
  const [saving, setSaving] = useState(false);

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
    const ids = Array.from(new Set(challenges.flatMap((c) => [c.challenger_id, c.opponent_id])));
    if (ids.length) {
      const { data: profs } = await supabase.from("public_profiles").select("user_id, nickname, avatar_url").in("user_id", ids);
      const map: Record<string, RankUser> = {};
      ((profs as any[]) || []).forEach((p) => (map[p.user_id] = { user_id: p.user_id, nome_usuario: p.nickname, avatar_url: p.avatar_url }));
      setProfiles(map);
    }
    const { data: st } = await supabase.from("x1_settings" as any).select("pix_account, fee_flat").eq("id", 1).maybeSingle();
    setSettings((st as any) || { pix_account: null, fee_flat: 0 });
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    setSchedDate(getBrazilDate());
    setMode("new");
    loadRanking();
  };

  const createX1 = async () => {
    if (!user || !opp) return;
    setSaving(true);
    const s = Number(stakes) || 0;
    const fee = s > 0 ? settings?.fee_flat ?? 0 : 0;
    const prize = s > 0 ? Math.max(0, s * 2 - fee) : 0;
    const { error } = await supabase.from("x1_challenges" as any).insert({
      challenger_id: user.id,
      opponent_id: opp.user_id,
      scheduled_date: schedDate || null,
      goal_amount: Number(goal) || null,
      stakes_amount: s,
      fee_amount: fee,
      prize_amount: prize,
      pix_account: settings?.pix_account ?? null,
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

  const respond = (id: string, accept: boolean) =>
    rpc("x1_respond", { p_id: id, p_accept: accept }, accept ? "Desafio aceito! ⚔️" : "Desafio recusado");
  const markPaid = (id: string) => rpc("x1_mark_paid", { p_id: id }, "Marcado como pago — admin vai confirmar");
  const cancelX1 = (id: string) => rpc("x1_cancel", { p_id: id }, "Desafio cancelado");
  const setWinner = (c: X1, winner: string) =>
    rpc(
      "x1_admin_set_result",
      { p_id: c.id, p_winner: winner, p_challenger_score: null, p_opponent_score: null, p_prize: c.prize_amount, p_fee: c.fee_amount, p_notes: "" },
      "Resultado salvo! 🏆",
    );

  const name = (uid: string) => profiles[uid]?.nome_usuario || "Vendedor";
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
            <p className="text-sm text-muted-foreground">Escolha quem você quer desafiar no ranking:</p>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar vendedor…"
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-card border border-border text-sm text-foreground"
              />
            </div>
            <div className="space-y-1.5 max-h-[55vh] overflow-y-auto">
              {filteredRanking.map((r) => (
                <button
                  key={r.user_id}
                  onClick={() => setOpp(r)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#0e0e10] active:scale-[0.99] transition-transform"
                >
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover border-2 border-border" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                      {(r.nome_usuario ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-sm text-white truncate">{r.nome_usuario || "Vendedor"}</span>
                </button>
              ))}
              {filteredRanking.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Ninguém encontrado.</p>}
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3">
              {opp.avatar_url ? (
                <img src={opp.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold">{(opp.nome_usuario ?? "?").slice(0, 2).toUpperCase()}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground truncate">vs {opp.nome_usuario || "Vendedor"}</p>
                <button onClick={() => setOpp(null)} className="text-xs text-amber-400 underline">trocar</button>
              </div>
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
                  Prêmio do vencedor ≈ {fmt(Math.max(0, Number(stakes) * 2 - (settings?.fee_flat ?? 0)))} (taxa Orbis {fmt(settings?.fee_flat ?? 0)}). O dinheiro vai pro Pix do admin e fica seguro até o resultado.
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
                    <p className="text-[11px] text-muted-foreground">
                      {statusLabel[c.status] || c.status} · {dateBR(c.scheduled_date)}
                      {c.goal_amount ? ` · meta ${fmt(c.goal_amount)}` : ""}
                    </p>
                  </div>
                  {c.winner_user_id && (
                    <span className="text-[10px] font-black px-2 py-1 rounded" style={{ background: c.winner_user_id === user?.id ? "#16331f" : "#2a2a2e", color: c.winner_user_id === user?.id ? "#22c55e" : "#9ca3af" }}>
                      {c.winner_user_id === user?.id ? "VOCÊ VENCEU 🏆" : "Encerrado"}
                    </span>
                  )}
                </div>

                {c.stakes_amount > 0 && (
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-2.5 text-[11px] text-muted-foreground">
                    <p>Aposta: {fmt(c.stakes_amount)} cada · Prêmio: <span className="text-amber-400 font-bold">{fmt(c.prize_amount)}</span></p>
                    <p className="mt-0.5">{moneyLabel[c.money_status] || c.money_status}</p>
                    {c.money_status === "awaiting_payment" && c.pix_account && (
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(c.pix_account || "").then(() => toast({ title: "Chave Pix copiada" }), () => {});
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-amber-400 font-semibold"
                      >
                        <Copy className="w-3 h-3" /> Pix do admin: {c.pix_account}
                      </button>
                    )}
                  </div>
                )}

                {/* Ações do participante */}
                <div className="flex flex-wrap gap-2">
                  {c.status === "pending" && !iAmChallenger && (
                    <>
                      <button onClick={() => respond(c.id, true)} className="flex-1 h-9 rounded-lg bg-green-600 text-white text-xs font-bold flex items-center justify-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Aceitar
                      </button>
                      <button onClick={() => respond(c.id, false)} className="flex-1 h-9 rounded-lg bg-card border border-border text-muted-foreground text-xs font-bold flex items-center justify-center gap-1">
                        <X className="w-3.5 h-3.5" /> Recusar
                      </button>
                    </>
                  )}
                  {c.status === "pending" && iAmChallenger && (
                    <button onClick={() => cancelX1(c.id)} className="flex-1 h-9 rounded-lg bg-card border border-border text-muted-foreground text-xs font-bold">
                      Cancelar desafio
                    </button>
                  )}
                  {c.status === "accepted" && c.stakes_amount > 0 && !iPaid && (
                    <button onClick={() => markPaid(c.id)} className="flex-1 h-9 rounded-lg bg-amber-500 text-black text-xs font-bold">
                      Já enviei meu Pix
                    </button>
                  )}
                  {c.status === "accepted" && c.stakes_amount > 0 && iPaid && (
                    <span className="text-[11px] text-green-400 font-semibold">Você marcou como pago ✓ {!(iAmChallenger ? c.opponent_paid : c.challenger_paid) && "· aguardando o outro"}</span>
                  )}
                </div>

                {/* Ações do admin */}
                {isAdmin && (c.status === "accepted" || c.status === "awaiting_result") && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary">Admin · definir vencedor</p>
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
