import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/shared/lib/utils";
import { presenceInfo } from "@/shared/lib/presence";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Instagram, MessageCircle, MapPin, Package, Store, Loader2, Trophy, Flame, X, Swords, Medal, ShieldAlert, Phone, Mail, CalendarDays, CreditCard, Ban } from "lucide-react";
import { useToast } from "@/shared/hooks/use-toast";

const EXCLUSIVE_EMOJIS = ["🦁", "🐺", "🦅", "🔥", "⚡", "💎", "🚀", "👑", "🎯", "💪", "🏆", "⭐", "🐉", "🦈", "🐯", "🦊"];
const isEmojiAvatar = (a: string | null) => !!a && EXCLUSIVE_EMOJIS.includes(a);

interface PublicProfile {
  user_id: string;
  nickname: string | null;
  avatar_url: string | null;
  bio: string | null;
  what_i_sell: string | null;
  where_i_sell: string | null;
  city: string | null;
  state: string | null;
  instagram: string | null;
  whatsapp_public: string | null;
}

interface Stats {
  faturamento_total_mes: number;
  dias_trabalhados_mes: number;
  constancia_streak_atual: number;
  posicao_faturamento: number | null;
  posicao_constancia: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
}

export default function PublicProfileModal({ open, onOpenChange, userId }: Props) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastActive, setLastActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { user: viewer } = useAuth();
  const navigate = useNavigate();
  const { whitelisted, role } = useAdminAccess(viewer?.id);
  const canSeeWinnings = !!userId && (viewer?.id === userId || (whitelisted && role === "admin"));
  const [winTotal, setWinTotal] = useState<number | null>(null);
  const [x1Hist, setX1Hist] = useState<Array<{ id: string; otherName: string; won: boolean; prize: number }>>([]);
  const [compWins, setCompWins] = useState<Array<{ id: string; label: string; value: number }>>([]);

  /* ---- MODERAÇÃO (admin supremo) — pedido do Rick, 01/09 ----
     Tocou no usuário no ranking → vê a ficha (sem CPF) → zera e exclui.
     A verdade fica no banco: as RPCs recusam quem não é super admin. */
  const { toast } = useToast();
  const [supremo, setSupremo] = useState(false);
  const [ficha, setFicha] = useState<any | null>(null);
  const [fichaLoading, setFichaLoading] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    if (!viewer?.id) { setSupremo(false); return; }
    let vivo = true;
    (supabase as any).rpc("is_orbis_super_admin").then((r: any) => { if (vivo) setSupremo(r?.data === true); }).catch(() => {});
    return () => { vivo = false; };
  }, [viewer?.id]);

  useEffect(() => {
    if (!open || !userId || !supremo || viewer?.id === userId) { setFicha(null); setConfirmarExclusao(false); return; }
    let vivo = true;
    setFichaLoading(true);
    (supabase as any).rpc("admin_ficha_usuario", { target: userId })
      .then((r: any) => { if (vivo) setFicha(r?.error ? null : r?.data); })
      .catch(() => { if (vivo) setFicha(null); })
      .finally(() => { if (vivo) setFichaLoading(false); });
    return () => { vivo = false; };
  }, [open, userId, supremo, viewer?.id]);

  const excluirDoRanking = async () => {
    if (!userId) return;
    setExcluindo(true);
    try {
      const { data, error } = await (supabase as any).rpc("admin_excluir_do_ranking", { target: userId, motivo: "nome/valor impróprio — moderação no ranking" });
      if (error) throw error;
      toast({ title: "Excluído do ranking", description: `Zerado: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(data?.faturamento_zerado || 0))}. Ele não volta sozinho.` });
      setFicha((f: any) => (f ? { ...f, ranking_hidden: true, ranking: null } : f));
      setConfirmarExclusao(false);
    } catch (e: any) {
      toast({ title: "Não deu", description: e?.message || "Tenta de novo.", variant: "destructive" });
    } finally {
      setExcluindo(false);
    }
  };

  useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    setLoading(true);
    setProfile(null);
    setStats(null);
    setLastActive(null);

    (async () => {
      const [{ data: prof }, { data: lb }, { data: pres }] = await Promise.all([
        supabase.from("public_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("leaderboard_stats")
          .select("faturamento_total_mes, dias_trabalhados_mes, constancia_streak_atual, posicao_faturamento, posicao_constancia")
          .eq("user_id", userId)
          .eq("mes_referencia", new Date().toISOString().slice(0, 7))
          .maybeSingle(),
        supabase.from("user_presence").select("last_active_at").eq("user_id", userId).maybeSingle(),
      ]);
      if (!active) return;
      setProfile(prof as PublicProfile);
      setStats(lb as Stats);
      setLastActive((pres as { last_active_at?: string } | null)?.last_active_at ?? null);
      setLoading(false);
    })();

    return () => { active = false; };
  }, [open, userId]);

  // Ganhos (total + histórico) — só pro dono do perfil ou admin (RLS exige isso).
  useEffect(() => {
    if (!open || !userId || !canSeeWinnings) {
      setWinTotal(null);
      setX1Hist([]);
      setCompWins([]);
      return;
    }
    let active = true;
    (async () => {
      const [{ data: w }, { data: x1s }, { data: cw }] = await Promise.all([
        (supabase as any).rpc("get_user_winnings", { p_user: userId }),
        supabase
          .from("x1_challenges" as any)
          .select("id, challenger_id, opponent_id, winner_user_id, prize_amount, created_at")
          .eq("status", "finished")
          .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("competition_winners" as any)
          .select("id, prize_label, prize_value, awarded_at")
          .eq("user_id", userId)
          .order("awarded_at", { ascending: false })
          .limit(20),
      ]);
      if (!active) return;
      setWinTotal(typeof (w as any)?.total === "number" ? (w as any).total : 0);
      const raw = ((x1s as any[]) || []).map((r) => ({
        id: r.id as string,
        other: (r.challenger_id === userId ? r.opponent_id : r.challenger_id) as string,
        won: r.winner_user_id === userId,
        prize: (r.prize_amount as number) || 0,
      }));
      const otherIds = Array.from(new Set(raw.map((h) => h.other)));
      let nameMap = new Map<string, string>();
      if (otherIds.length) {
        const { data: ps } = await supabase.from("public_profiles").select("user_id, nickname").in("user_id", otherIds);
        nameMap = new Map(((ps as any[]) || []).map((p) => [p.user_id, p.nickname || "Vendedor"]));
      }
      if (!active) return;
      setX1Hist(raw.map((h) => ({ id: h.id, otherName: nameMap.get(h.other) || "Vendedor", won: h.won, prize: h.prize })));
      setCompWins(((cw as any[]) || []).map((r) => ({ id: r.id, label: r.prize_label, value: r.prize_value || 0 })));
    })().catch(() => {});
    return () => {
      active = false;
    };
  }, [open, userId, canSeeWinnings]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const renderAvatar = () => {
    const a = profile?.avatar_url;
    const name = profile?.nickname;
    if (isEmojiAvatar(a ?? null)) {
      return (
        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/50 flex items-center justify-center text-5xl shadow-2xl shadow-primary/30">
          {a}
        </div>
      );
    }
    if (a && a.startsWith("http")) {
      return <img src={a} alt={name || ""} className="w-24 h-24 rounded-full object-cover border-2 border-primary/50 shadow-2xl shadow-primary/30" />;
    }
    return (
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border-2 border-primary/50 flex items-center justify-center text-3xl font-bold text-primary shadow-2xl shadow-primary/30">
        {(name || "U").charAt(0).toUpperCase()}
      </div>
    );
  };

  const igHandle = profile?.instagram?.replace(/^@/, "").trim();
  const waNumber = profile?.whatsapp_public?.replace(/\D/g, "");
  const cityState = [profile?.city, profile?.state].filter(Boolean).join(" / ");
  const pres = presenceInfo(lastActive);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 max-w-[420px] w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-hidden border border-primary/30 bg-background rounded-2xl [&>button]:hidden"
      >
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-3 right-3 z-50 w-8 h-8 rounded-full bg-card/80 border border-border/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative overflow-y-auto max-h-[92dvh]">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          )}

          {!loading && profile && (
            <>
              {/* Header */}
              <div className="relative px-5 pt-8 pb-5 text-center">
                <div className="flex justify-center mb-3">
                  <div className="relative">
                    {renderAvatar()}
                    {/* Bolinha de presença (verde = no DEFCON agora, cinza = offline). */}
                    <span
                      className="absolute bottom-1 right-1 h-5 w-5 rounded-full border-2 border-background"
                      style={{ background: pres.online ? "#22c55e" : "#6b7280" }}
                    />
                  </div>
                </div>
                <h2 className="text-xl font-black text-foreground tracking-tight">
                  {profile.nickname || "Usuário Orbis"}
                </h2>
                {pres.label && (
                  <div className="flex items-center justify-center gap-1.5 mt-1.5 text-xs font-semibold" style={{ color: pres.online ? "#22c55e" : "#9ca3af" }}>
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: pres.online ? "#22c55e" : "#6b7280" }} />
                    <span>{pres.online ? "No DEFCON agora" : pres.label}</span>
                  </div>
                )}
                {cityState && (
                  <div className="flex items-center justify-center gap-1 mt-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    <span>{cityState}</span>
                  </div>
                )}
                {profile.bio && (
                  <p className="text-sm text-foreground/80 mt-3 italic max-w-[300px] mx-auto">
                    "{profile.bio}"
                  </p>
                )}
              </div>

              {/* Chamar pra X1 — livre pra qualquer usuário (menos você mesmo) */}
              {viewer && userId && viewer.id !== userId && (
                <div className="px-5 mt-3">
                  <button
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/x1?desafiar=${userId}`);
                    }}
                    className="w-full h-11 rounded-xl bg-amber-500 text-black font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  >
                    <Swords className="w-4 h-4" /> Chamar pra X1
                  </button>
                </div>
              )}

              {/* Stats from ranking */}
              {stats && (
                <div className="px-5">
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-card/60 border border-border/50">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                        <Trophy className="w-3 h-3" />
                        <span className="text-xs font-bold uppercase tracking-wider">Mês</span>
                      </div>
                      <p className="text-sm font-black text-foreground leading-tight">
                        {formatCurrency(stats.faturamento_total_mes)}
                      </p>
                      {stats.posicao_faturamento && (
                        <p className="text-xs text-muted-foreground mt-0.5">#{stats.posicao_faturamento}</p>
                      )}
                    </div>
                    <div className="text-center border-x border-border/50">
                      <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                        <Flame className="w-3 h-3" />
                        <span className="text-xs font-bold uppercase tracking-wider">Dias</span>
                      </div>
                      <p className="text-sm font-black text-foreground leading-tight">{stats.dias_trabalhados_mes}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">trabalhados</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                        <Flame className="w-3 h-3" />
                        <span className="text-xs font-bold uppercase tracking-wider">Streak</span>
                      </div>
                      <p className="text-sm font-black text-foreground leading-tight">{stats.constancia_streak_atual}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">seguidos</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ganhos em competições / X1 (dono e admins) */}
              {canSeeWinnings && winTotal !== null && (
                <div className="px-5 mt-4">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <Medal className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-wider">Total ganho</span>
                      </div>
                      <span className="text-lg font-black text-amber-400">{formatCurrency(winTotal)}</span>
                    </div>
                    {x1Hist.length > 0 || compWins.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {compWins.map((c) => (
                          <div key={c.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Trophy className="w-3 h-3 text-amber-400" />
                              {c.label || "Competição"}
                            </span>
                            <span className="text-foreground font-semibold">{formatCurrency(c.value)}</span>
                          </div>
                        ))}
                        {x1Hist.map((h) => (
                          <div key={h.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground flex items-center gap-1">
                              <Swords className="w-3 h-3" />
                              X1 vs {h.otherName}
                            </span>
                            <span className={h.won ? "text-green-400 font-semibold" : "text-muted-foreground"}>
                              {h.won ? `+${formatCurrency(h.prize)}` : "perdeu"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-1">Sem vitórias ainda.</p>
                    )}
                  </div>
                </div>
              )}

              {/* What/Where I sell */}
              {(profile.what_i_sell || profile.where_i_sell) && (
                <div className="px-5 mt-4 space-y-2">
                  {profile.what_i_sell && (
                    <div className="rounded-xl border border-border/50 bg-card/40 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-1">
                        <Package className="w-3 h-3" />
                        O que vendo
                      </div>
                      <p className="text-sm text-foreground/90">{profile.what_i_sell}</p>
                    </div>
                  )}
                  {profile.where_i_sell && (
                    <div className="rounded-xl border border-border/50 bg-card/40 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary mb-1">
                        <Store className="w-3 h-3" />
                        Onde vendo
                      </div>
                      <p className="text-sm text-foreground/90">{profile.where_i_sell}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Social */}
              {(igHandle || waNumber) && (
                <div className="px-5 mt-4 mb-5 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-center">
                    Encontre nas redes
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {igHandle && (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full h-11 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                      >
                        <a
                          href={`https://instagram.com/${igHandle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2"
                        >
                          <Instagram className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">@{igHandle}</span>
                        </a>
                      </Button>
                    )}
                    {waNumber && (
                      <Button
                        asChild
                        variant="outline"
                        className="w-full h-11 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                      >
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">Conversar no WhatsApp</span>
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* ---- painel do admin supremo: ficha sem CPF + zerar/excluir ---- */}
              {supremo && viewer?.id !== userId && (
                <div className="px-5 mt-4">
                  <div className="rounded-xl border p-3" style={{ borderColor: "rgba(229,115,127,.35)", background: "rgba(229,115,127,.06)" }}>
                    <div className="flex items-center gap-1.5" style={{ color: "#E5737F" }}>
                      <ShieldAlert className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Admin supremo</span>
                      {fichaLoading && <Loader2 className="w-3 h-3 animate-spin ml-auto" />}
                    </div>

                    {ficha && (
                      <div className="mt-2.5 space-y-1.5 text-xs">
                        <Linha icone={<Mail className="w-3 h-3" />} rot="E-mail" val={ficha.email} copiar />
                        <Linha icone={<Phone className="w-3 h-3" />} rot="Telefone" val={ficha.phone || ficha.whatsapp_public} copiar />
                        <Linha icone={<MapPin className="w-3 h-3" />} rot="Cidade" val={[ficha.city, ficha.state].filter(Boolean).join(" / ")} />
                        <Linha icone={<CalendarDays className="w-3 h-3" />} rot="Cadastro" val={ficha.cadastro_em ? new Date(ficha.cadastro_em).toLocaleDateString("pt-BR") : null} />
                        <Linha icone={<CreditCard className="w-3 h-3" />} rot="Assinatura"
                          val={ficha.assinatura?.status
                            ? `${ficha.assinatura.status}${ficha.assinatura.fim_periodo ? " · até " + new Date(ficha.assinatura.fim_periodo).toLocaleDateString("pt-BR") : ""}`
                            : ficha.is_trial_active ? `trial${ficha.trial_end ? " · até " + new Date(ficha.trial_end).toLocaleDateString("pt-BR") : ""}` : (ficha.plan_status || "sem assinatura")}
                          destaque={ficha.assinatura?.status === "active" ? "ok" : "warn"} />
                        <Linha icone={<Trophy className="w-3 h-3" />} rot="Ranking"
                          val={ficha.ranking_hidden ? "EXCLUÍDO" : ficha.ranking ? `#${ficha.ranking.posicao ?? "—"} · ${formatCurrency(Number(ficha.ranking.faturamento_mes || 0))} · ${ficha.ranking.dias_mes} dias` : "fora este mês"}
                          destaque={ficha.ranking_hidden ? "warn" : undefined} />
                        <Linha icone={<Flame className="w-3 h-3" />} rot="Vendas DEFCON (mês)" val={String(ficha.vendas_defcon_mes ?? 0)} />
                        {ficha.origem_ref && <Linha icone={<Store className="w-3 h-3" />} rot="Origem" val={ficha.origem_ref} />}
                        {Array.isArray(ficha.moderacoes) && ficha.moderacoes.length > 0 && (
                          <p className="text-[11px] pt-1" style={{ color: "#E5737F" }}>
                            Já moderado {ficha.moderacoes.length}× · última: {new Date(ficha.moderacoes[0].em).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                      </div>
                    )}

                    {ficha && !ficha.ranking_hidden && (
                      confirmarExclusao ? (
                        <div className="mt-3 rounded-lg p-2.5" style={{ background: "rgba(229,115,127,.12)" }}>
                          <p className="text-xs font-semibold text-foreground">Zerar {formatCurrency(Number(ficha.ranking?.faturamento_mes || 0))} e tirar do ranking pra sempre?</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">Ele continua usando o app; só some do ranking. Pra devolver: Admin → Assinaturas.</p>
                          <div className="flex gap-2 mt-2">
                            <Button onClick={excluirDoRanking} disabled={excluindo} className="flex-1 h-9 text-xs font-bold" style={{ background: "#E5737F", color: "#1A0A0C" }}>
                              {excluindo ? <Loader2 className="w-3 h-3 animate-spin" /> : "SIM, EXCLUIR"}
                            </Button>
                            <Button onClick={() => setConfirmarExclusao(false)} variant="ghost" className="h-9 text-xs">Voltar</Button>
                          </div>
                        </div>
                      ) : (
                        <Button onClick={() => setConfirmarExclusao(true)} variant="outline" className="w-full h-9 mt-3 text-xs font-bold" style={{ borderColor: "rgba(229,115,127,.5)", color: "#E5737F" }}>
                          <Ban className="w-3.5 h-3.5 mr-1.5" /> Zerar e excluir do ranking
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )}

              {!profile.what_i_sell && !profile.where_i_sell && !profile.bio && !igHandle && !waNumber && (
                <div className="px-5 py-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Este usuário ainda não preencheu o perfil público.
                  </p>
                </div>
              )}

              <div className="px-5 pb-5">
                <Button
                  onClick={() => onOpenChange(false)}
                  variant="ghost"
                  className="w-full h-10 text-xs text-muted-foreground"
                >
                  Fechar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Linha da ficha do admin: rótulo à esquerda, valor à direita, toque copia. */
function Linha({ icone, rot, val, copiar, destaque }: { icone: ReactNode; rot: string; val: string | null | undefined; copiar?: boolean; destaque?: "ok" | "warn" }) {
  const v = val && String(val).trim() ? String(val) : "—";
  const cor = destaque === "ok" ? "#3DD68C" : destaque === "warn" ? "#E5737F" : undefined;
  return (
    <button
      type="button"
      onClick={() => { if (copiar && v !== "—") { try { void navigator.clipboard.writeText(v); } catch { /* sem clipboard */ } } }}
      className="w-full flex items-center gap-2 text-left"
    >
      <span className="text-muted-foreground flex items-center gap-1 w-[118px] shrink-0">{icone}{rot}</span>
      <span className="font-semibold truncate flex-1" style={cor ? { color: cor } : undefined}>{v}</span>
    </button>
  );
}
