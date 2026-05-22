import { useMemo, useEffect, useRef } from "react";
import { Trophy, Gift, Calendar, Users, Sparkles, CheckCircle2, AlertCircle, Phone, MapPin, Lock, TrendingUp, Crown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompetitions, Competition } from "@/hooks/useCompetitions";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import CompetitionLeaderboard from "./CompetitionLeaderboard";

interface Props {
  userId: string | undefined;
  hasPhone: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function metricLabel(m: Competition["metric"]) {
  if (m === "pix_revenue") return "Maior faturamento em PIX";
  if (m === "pix_sales_count") return "Mais vendas em PIX";
  return "Maior ofensiva (dias seguidos)";
}

function entryLabel(c: Competition) {
  if (c.entry_rule === "free") return "Entrada livre";
  if (c.entry_rule === "paid") return `Inscrição: ${formatCurrency(c.entry_fee || 0)}`;
  return "Apenas convidados";
}

export default function CompetitionsTab({ userId, hasPhone }: Props) {
  const { competitions, myParticipations, participantsByComp, myWins, loading, join, leave, acknowledgeWin, getMyPosition } =
    useCompetitions(userId);

  const active = useMemo(() => competitions.filter((c) => c.status === "active"), [competitions]);
  const finished = useMemo(() => competitions.filter((c) => c.status === "finished"), [competitions]);

  const isJoined = (id: string) => myParticipations.some((p) => p.competition_id === id);

  // Notificação de posição: dispara uma única vez por sessão por competição
  const notifiedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    active.forEach((c) => {
      if (!isJoined(c.id) || notifiedRef.current.has(c.id)) return;
      const pos = getMyPosition(c.id);
      if (!pos) return;
      notifiedRef.current.add(c.id);
      const msg =
        pos.position === 1
          ? `🏆 Você está em 1º em "${c.name}"! Segura o topo.`
          : pos.position <= 3
          ? `🔥 Top ${pos.position} em "${c.name}"! Bora pro pódio.`
          : `Você está em #${pos.position}/${pos.total} em "${c.name}". Vai pra cima!`;
      toast({ title: "Sua posição na competição", description: msg });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.length, participantsByComp]);

  const handleJoin = async (c: Competition) => {
    if (!hasPhone) {
      toast({
        title: "Telefone necessário",
        description: "Cadastre seu WhatsApp no perfil para participar e receber prêmios.",
        variant: "destructive",
      });
      return;
    }
    if (c.entry_rule === "paid") {
      toast({
        title: "Inscrição paga",
        description: `Entre em contato com o suporte para confirmar sua inscrição (${formatCurrency(
          c.entry_fee || 0,
        )}).`,
      });
    }
    const { error } = await join(c.id);
    if (error) {
      toast({ title: "Erro ao entrar", description: error.toString(), variant: "destructive" });
    } else {
      toast({ title: "Você entrou na competição! 🏆" });
    }
  };

  const handleLeave = async (c: Competition) => {
    const { error } = await leave(c.id);
    if (error) toast({ title: "Erro", description: error.toString(), variant: "destructive" });
  };

  return (
    <div className="space-y-5">
      {/* Aviso PIX */}
      <div className="rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[12px] text-foreground/85 leading-snug">
          Apenas vendas em <span className="font-black text-primary">PIX</span> contam para
          competições e prêmios. Dinheiro continua no seu relatório, mas não soma aqui.
        </p>
      </div>

      {/* Prêmios não resgatados */}
      {myWins.map((w) => (
        <Card
          key={w.id}
          className="relative overflow-hidden border-2 border-primary bg-gradient-to-br from-primary/20 via-primary/5 to-transparent"
          style={{ boxShadow: "0 10px 40px -10px hsl(var(--primary) / 0.4)" }}
        >
          <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="absolute -top-1/2 -left-1/4 h-[200%] w-1/3 animate-shine-sweep"
              style={{ background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.25), transparent)" }}
            />
          </div>
          <CardContent className="relative p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
              <p className="text-sm font-black text-primary uppercase tracking-widest">
                Você ganhou!
              </p>
            </div>
            <p className="text-lg font-bold text-foreground">{w.prize_label}</p>
            {w.prize_value > 0 && (
              <p className="text-2xl font-black text-primary">{formatCurrency(w.prize_value)}</p>
            )}
            <div className="rounded-lg bg-background/50 border border-primary/25 p-3 flex items-start gap-2">
              <Phone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/85 leading-snug">
                Nosso suporte vai te chamar no WhatsApp cadastrado para entregar seu prêmio.
              </p>
            </div>
            {!w.claimed && (
              <Button
                size="sm"
                variant="outline"
                className="w-full border-primary/40 text-primary hover:bg-primary/10"
                onClick={() => acknowledgeWin(w.id)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar como visto
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {!hasPhone && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-[12px] text-foreground/85 leading-snug">
            Adicione seu WhatsApp no perfil para participar de competições e receber prêmios.
          </p>
        </div>
      )}

      {/* Ativas */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1 h-3.5 bg-primary rounded-full" />
          <p className="text-[11px] font-black uppercase tracking-widest text-foreground/90">
            Competições ativas
          </p>
        </div>

        {loading && (
          <Card className="bg-card/40 border-border/40">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">Carregando…</CardContent>
          </Card>
        )}

        {!loading && active.length === 0 && (
          <Card className="border border-dashed border-border/50 bg-card/30">
            <CardContent className="p-6 text-center space-y-2">
              <Trophy className="w-10 h-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Nenhuma competição rolando agora. Fique de olho — em breve!
              </p>
            </CardContent>
          </Card>
        )}

        {active.map((c) => {
          const joined = isJoined(c.id);
          const myPos = joined ? getMyPosition(c.id) : null;
          const partsList = participantsByComp[c.id] || [];
          const audienceBadge =
            c.audience_type === "city" && c.audience_cities.length
              ? { icon: MapPin, label: c.audience_cities.join(", ") }
              : c.audience_type === "invite"
              ? { icon: Lock, label: "Apenas convidados" }
              : null;

          return (
            <Card
              key={c.id}
              className={cn(
                "relative overflow-hidden border bg-card transition-all",
                joined
                  ? "border-primary/60 shadow-lg shadow-primary/15"
                  : "border-border/50 hover:border-primary/30",
              )}
            >
              <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              <CardContent className="relative p-4 space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
                      {c.period_type === "weekly" ? "Semanal" : c.period_type === "monthly" ? "Mensal" : "Especial"}
                    </p>
                    <h3 className="text-lg font-black text-foreground leading-tight">{c.name}</h3>
                  </div>
                  {joined && (
                    <div className="shrink-0 rounded-full bg-primary/15 border border-primary/40 px-2 py-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                      <span className="text-[10px] font-black text-primary uppercase tracking-wider">Dentro</span>
                    </div>
                  )}
                </div>

                {c.description && (
                  <p className="text-sm text-foreground/75 leading-snug">{c.description}</p>
                )}

                {/* Posição do usuário */}
                {joined && myPos && (
                  <div
                    className="relative overflow-hidden rounded-xl border border-primary/50 bg-gradient-to-r from-primary/25 via-primary/10 to-transparent p-3 flex items-center gap-3"
                    style={{ boxShadow: "0 4px 18px -8px hsl(var(--primary) / 0.5)" }}
                  >
                    <div className="w-11 h-11 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                      {myPos.position === 1 ? (
                        <Crown className="w-5 h-5 text-primary" />
                      ) : (
                        <TrendingUp className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/80 font-black">
                        Sua posição
                      </p>
                      <p className="text-lg font-black text-foreground leading-tight">
                        #{myPos.position}{" "}
                        <span className="text-xs font-bold text-muted-foreground">
                          de {myPos.total}
                        </span>
                      </p>
                    </div>
                    {myPos.position > 1 && (
                      <p className="text-[10px] text-primary font-bold uppercase tracking-wider shrink-0 text-right leading-tight">
                        Vai pra<br />cima 🔥
                      </p>
                    )}
                  </div>
                )}

                {/* Bloco prêmio dourado */}
                <div
                  className="relative overflow-hidden rounded-xl border border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-3.5"
                  style={{ boxShadow: "inset 0 1px 0 0 hsl(var(--primary) / 0.2)" }}
                >
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
                  <div className="relative flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0">
                      <Gift className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-widest text-primary/80 font-black">
                        Prêmio
                      </p>
                      <p className="text-base font-black text-foreground leading-tight">{c.prize_label}</p>
                      {c.prize_value > 0 && (
                        <p className="text-lg font-black text-primary leading-tight">{formatCurrency(c.prize_value)}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-background/50 border border-border/40 px-2.5 py-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                    <span className="text-foreground/85 truncate font-semibold">
                      {formatDate(c.starts_at)} → {formatDate(c.ends_at)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-background/50 border border-border/40 px-2.5 py-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary/80 shrink-0" />
                    <span className="text-foreground/85 truncate font-semibold">{entryLabel(c)}</span>
                  </div>
                </div>

                {audienceBadge && (
                  <div className="rounded-lg bg-primary/10 border border-primary/30 px-2.5 py-2 flex items-center gap-1.5 text-[11px]">
                    <audienceBadge.icon className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-foreground/90 font-bold truncate">
                      Restrita: {audienceBadge.label}
                    </span>
                  </div>
                )}

                <div className="rounded-lg bg-background/40 border border-border/40 px-2.5 py-2 text-[11px] text-foreground/80">
                  <span className="text-muted-foreground font-semibold">Critério: </span>
                  <span className="font-bold text-foreground/90">{metricLabel(c.metric)}</span>
                </div>

                {c.entry_instructions && (
                  <p className="text-[11px] text-muted-foreground leading-snug px-0.5">
                    {c.entry_instructions}
                  </p>
                )}

                {/* Placar ao vivo */}
                {(joined || partsList.length > 0) && (
                  <div className="pt-1">
                    <CompetitionLeaderboard
                      competition={c}
                      participants={partsList}
                      currentUserId={userId}
                    />
                  </div>
                )}

                {joined ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full border-border/50 text-muted-foreground hover:text-foreground"
                    onClick={() => handleLeave(c)}
                  >
                    Sair da competição
                  </Button>
                ) : (
                  <Button
                    className="w-full h-11 font-black tracking-wide bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => handleJoin(c)}
                    disabled={c.entry_rule === "invite"}
                  >
                    {c.entry_rule === "invite" ? "Apenas convidados" : "Participar"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Finalizadas */}
      {finished.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-3.5 bg-muted-foreground/40 rounded-full" />
            <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">
              Encerradas
            </p>
          </div>
          {finished.map((c) => (
            <Card key={c.id} className="bg-card/40 border-border/30">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground/90 truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{c.prize_label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
