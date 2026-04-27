import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Instagram, MessageCircle, MapPin, Package, Store, Loader2, Trophy, Flame, X } from "lucide-react";

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    let active = true;
    setLoading(true);
    setProfile(null);
    setStats(null);

    (async () => {
      const [{ data: prof }, { data: lb }] = await Promise.all([
        supabase.from("public_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase
          .from("leaderboard_stats")
          .select("faturamento_total_mes, dias_trabalhados_mes, constancia_streak_atual, posicao_faturamento, posicao_constancia")
          .eq("user_id", userId)
          .eq("mes_referencia", new Date().toISOString().slice(0, 7))
          .maybeSingle(),
      ]);
      if (!active) return;
      setProfile(prof as PublicProfile);
      setStats(lb as Stats);
      setLoading(false);
    })();

    return () => { active = false; };
  }, [open, userId]);

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
                <div className="flex justify-center mb-3">{renderAvatar()}</div>
                <h2 className="text-xl font-black text-foreground tracking-tight">
                  {profile.nickname || "Usuário Orbis"}
                </h2>
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

              {/* Stats from ranking */}
              {stats && (
                <div className="px-5">
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-card/60 border border-border/50">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                        <Trophy className="w-3 h-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Mês</span>
                      </div>
                      <p className="text-sm font-black text-foreground leading-tight">
                        {formatCurrency(stats.faturamento_total_mes)}
                      </p>
                      {stats.posicao_faturamento && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">#{stats.posicao_faturamento}</p>
                      )}
                    </div>
                    <div className="text-center border-x border-border/50">
                      <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                        <Flame className="w-3 h-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Dias</span>
                      </div>
                      <p className="text-sm font-black text-foreground leading-tight">{stats.dias_trabalhados_mes}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">trabalhados</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-primary mb-0.5">
                        <Flame className="w-3 h-3" />
                        <span className="text-[9px] font-bold uppercase tracking-wider">Streak</span>
                      </div>
                      <p className="text-sm font-black text-foreground leading-tight">{stats.constancia_streak_atual}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">seguidos</p>
                    </div>
                  </div>
                </div>
              )}

              {/* What/Where I sell */}
              {(profile.what_i_sell || profile.where_i_sell) && (
                <div className="px-5 mt-4 space-y-2">
                  {profile.what_i_sell && (
                    <div className="rounded-xl border border-border/50 bg-card/40 p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
                        <Package className="w-3 h-3" />
                        O que vendo
                      </div>
                      <p className="text-sm text-foreground/90">{profile.what_i_sell}</p>
                    </div>
                  )}
                  {profile.where_i_sell && (
                    <div className="rounded-xl border border-border/50 bg-card/40 p-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">
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
