import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { toast } from "@/shared/hooks/use-toast";
import PublicProfileModal from "@/components/PublicProfileModal";
import { CompetitionArena } from "@/components/competitions/CompetitionArena";
import { GoldenTicket } from "@/components/competitions/GoldenTicket";
import { X1Andamento } from "@/components/competitions/X1Andamento";
import X1InvitePopup from "@/components/competitions/X1InvitePopup";
import { ArrowLeft, ChevronRight, Calendar, Lock, CheckCircle2, Swords, Plus } from "lucide-react";

interface Comp {
  id: string;
  name: string;
  description: string | null;
  prize_label: string;
  prize_value: number;
  period_type: string;
  starts_at: string;
  ends_at: string;
  metric: string;
  entry_rule: string;
  entry_fee: number | null;
  entry_instructions: string | null;
  status: string;
  winner_user_id: string | null;
  bilhete_config?: BilheteCfg | null;
}

interface BilheteCfg {
  introSub?: string | null;
  grandPrizeLabel?: string | null;
  grandPrizeDesc?: string | null;
  miniPrizes?: { valor: string; label: string }[];
  commissionTitle?: string | null;
  commissionTiers?: { nome: string; val: string }[];
  commissionNote?: string | null;
}

interface Part {
  id: string;
  competition_id: string;
  user_id: string;
  score: number | null;
  approved_score: number | null;
  score_approved: boolean | null;
  paid: boolean | null;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const dateBR = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
};
const metricLabel = (m: string) =>
  m === "pix_revenue" ? "Faturamento" : m === "pix_sales_count" ? "Nº de vendas" : m === "streak" ? "Ofensiva (dias)" : m;
const partValue = (p: Part) => (p.score_approved ? p.approved_score ?? 0 : p.score ?? 0);

export default function Competitions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { whitelisted, role } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";
  const [comps, setComps] = useState<Comp[]>([]);
  const [joined, setJoined] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Comp | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: c } = await supabase
      .from("competitions" as any)
      .select("*")
      .in("status", ["active", "finished"])
      .order("created_at", { ascending: false });
    const all = ((c as any[]) || []) as Comp[];
    // Ativas primeiro, encerradas depois.
    all.sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1));
    setComps(all);
    if (user) {
      const { data: mine } = await supabase
        .from("competition_participants" as any)
        .select("competition_id")
        .eq("user_id", user.id);
      setJoined(new Set(((mine as any[]) || []).map((r) => r.competition_id)));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const join = async (c: Comp) => {
    if (!user) return;
    setJoining(c.id);
    const { error } = await supabase
      .from("competition_participants" as any)
      .insert({ competition_id: c.id, user_id: user.id });
    setJoining(null);
    if (error) {
      toast({ title: "Não deu pra entrar", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Você entrou! 🏆",
      description:
        c.entry_rule === "paid" && c.entry_instructions
          ? c.entry_instructions
          : "Suba o extrato no fim do DEFCON pra valer no ranking.",
    });
    setJoined((s) => new Set(s).add(c.id));
  };

  if (selected) {
    return (
      <CompetitionDetail
        comp={selected}
        me={user?.id}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="pb-24 px-4 pt-4 max-w-2xl mx-auto space-y-4">
      {user && <X1InvitePopup userId={user.id} />}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex-1 min-w-0 truncate">Competições</h1>
        {isAdmin && (
          <button
            onClick={() => navigate("/admin/competitions")}
            className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary/15 border border-primary/40 text-primary text-sm font-bold whitespace-nowrap active:scale-[0.97] transition-transform"
          >
            <Plus className="w-4 h-4" /> Criar
          </button>
        )}
        <button
          onClick={() => navigate("/x1")}
          className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 text-sm font-bold whitespace-nowrap active:scale-[0.97] transition-transform"
        >
          <Swords className="w-4 h-4" /> X1
        </button>
      </div>

      {/* X1 em andamento dos usuários (espectador) — junto das competições dos admins */}
      <X1Andamento onOpen={() => navigate("/x1")} />

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-card/40 border border-border/50 animate-pulse" />
          ))}
        </div>
      ) : comps.length === 0 ? (
        <div className="text-center py-16 px-6">
          <p className="text-5xl mb-3">🏆</p>
          <p className="text-foreground font-bold">Nenhuma competição no momento</p>
          <p className="text-sm text-muted-foreground mt-1">Logo logo tem disputa nova por aqui.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comps.map((c) => {
            const isJoined = joined.has(c.id);
            return (
              <div key={c.id} className="rounded-2xl border border-border/60 bg-card/40 overflow-hidden">
                <button
                  onClick={() => setSelected(c)}
                  className="w-full text-left p-4 active:scale-[0.99] transition-transform"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className="text-[11px] uppercase tracking-widest font-bold"
                        style={{ color: c.status === "active" ? "#22c55e" : "#9ca3af" }}
                      >
                        {c.status === "active" ? "Ativa" : "Encerrada"} · {metricLabel(c.metric)}
                      </p>
                      <h3 className="font-bold text-foreground truncate">{c.name}</h3>
                      {c.prize_label && (
                        <p className="text-xs text-amber-400 font-semibold mt-0.5">
                          🏆 {c.prize_label}
                          {c.prize_value ? ` · ${fmt(c.prize_value)}` : ""}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0 mt-1" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {dateBR(c.starts_at)}–{dateBR(c.ends_at)}
                    </span>
                    {c.entry_rule === "paid" && (
                      <span className="inline-flex items-center gap-1 text-amber-400">
                        <Lock className="w-3 h-3" />
                        Entrada {fmt(c.entry_fee || 0)}
                      </span>
                    )}
                    {c.entry_rule === "invite" && (
                      <span className="inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        Por convite
                      </span>
                    )}
                  </div>
                </button>
                <div className="px-4 pb-4">
                  {isJoined ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      Você está participando
                    </div>
                  ) : c.status === "active" ? (
                    <button
                      onClick={() => join(c)}
                      disabled={joining === c.id}
                      className="w-full h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
                    >
                      {joining === c.id ? "Entrando…" : "Participar"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CompetitionDetail({ comp, me, onBack }: { comp: Comp; me?: string; onBack: () => void }) {
  const [rows, setRows] = useState<Array<Part & { nickname: string | null; avatar_url: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    const { data: parts } = await supabase
      .from("competition_participants" as any)
      .select("*")
      .eq("competition_id", comp.id);
    const list = ((parts as any[]) || []) as Part[];
    const ids = Array.from(new Set(list.map((p) => p.user_id)));
    let profMap = new Map<string, any>();
    if (ids.length) {
      const { data: profs } = await supabase
        .from("public_profiles")
        .select("user_id, nickname, avatar_url")
        .in("user_id", ids);
      profMap = new Map(((profs as any[]) || []).map((p) => [p.user_id, p]));
    }
    const merged = list.map((p) => ({
      ...p,
      nickname: profMap.get(p.user_id)?.nickname ?? null,
      avatar_url: profMap.get(p.user_id)?.avatar_url ?? null,
    }));
    merged.sort((a, b) => partValue(b) - partValue(a));
    setRows(merged);
    setLoading(false);
  }, [comp.id]);

  // Carrega + escuta em tempo real: quando o placar muda (DEFCON/extrato), recarrega na hora.
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`comp-rank-${comp.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_participants", filter: `competition_id=eq.${comp.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [comp.id, load]);

  const joinComp = async () => {
    if (!me || joining) return;
    setJoining(true);
    const { error } = await supabase
      .from("competition_participants" as any)
      .insert({ competition_id: comp.id, user_id: me });
    setJoining(false);
    if (error) {
      toast({ title: "Não deu pra entrar", description: error.message, variant: "destructive" });
      return;
    }
    await load();
  };

  const joined = !!me && rows.some((r) => r.user_id === me);
  const cfg = (comp.bilhete_config || {}) as BilheteCfg;

  // Convidado que ainda NÃO entrou: bilhete dourado em tela cheia (overlay sobre o app).
  if (!loading && !joined) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#030303", overflowY: "auto" }}>
        <button
          onClick={onBack}
          className="fixed top-3 left-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-amber-500/20 flex items-center justify-center text-amber-200/70 hover:text-amber-100 active:scale-95 transition-transform"
          style={{ zIndex: 120 }}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <GoldenTicket
          introTitulo={comp.name}
          introSub={cfg.introSub || undefined}
          grandPrizeLabel={cfg.grandPrizeLabel || "🏆 Grande Prêmio"}
          grandPrizeValue={comp.prize_label || "Prêmio"}
          grandPrizeDesc={cfg.grandPrizeDesc || (comp.prize_value ? fmt(comp.prize_value) : undefined)}
          miniPrizes={cfg.miniPrizes || []}
          commissionTitle={cfg.commissionTitle || undefined}
          commissionTiers={cfg.commissionTiers || []}
          commissionNote={cfg.commissionNote || undefined}
          onAccept={joinComp}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={onBack}
        className="absolute top-3 left-3 z-30 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-transform"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {loading ? (
        <div className="px-4 pt-16 space-y-1.5 max-w-md mx-auto">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-card/40 border border-border/40 animate-pulse" />
          ))}
        </div>
      ) : (
        <CompetitionArena
          title={comp.name}
          sealText={comp.entry_rule === "paid" ? "Competição Paga" : "Competição Premium"}
          prizeLabel={comp.prize_label || "Prêmio"}
          prizeValue={comp.prize_value || 0}
          datesStatus={`${dateBR(comp.starts_at)} a ${dateBR(comp.ends_at)} · ${comp.status === "active" ? "Em andamento" : "Encerrada"}`}
          rows={rows.map((r) => ({ user_id: r.user_id, nickname: r.nickname, avatar_url: r.avatar_url, value: partValue(r) }))}
          me={me}
          isCount={comp.metric === "pix_sales_count"}
          formatCurrency={fmt}
          onOpenProfile={setProfileUid}
        />
      )}

      <PublicProfileModal open={!!profileUid} onOpenChange={(v) => !v && setProfileUid(null)} userId={profileUid} />
    </div>
  );
}
