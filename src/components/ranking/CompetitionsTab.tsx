import { useMemo } from "react";
import { Trophy, Gift, Calendar, Users, Sparkles, CheckCircle2, AlertCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCompetitions, Competition } from "@/hooks/useCompetitions";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  const { competitions, myParticipations, myWins, loading, join, leave, acknowledgeWin } =
    useCompetitions(userId);

  const active = useMemo(() => competitions.filter((c) => c.status === "active"), [competitions]);
  const finished = useMemo(() => competitions.filter((c) => c.status === "finished"), [competitions]);

  const isJoined = (id: string) => myParticipations.some((p) => p.competition_id === id);

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
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-[12px] text-foreground/80 leading-snug">
          Apenas vendas pagas em <span className="font-bold text-primary">PIX</span> contam para
          competições e prêmios. Vendas em dinheiro continuam no seu relatório, mas não somam aqui.
        </p>
      </div>

      {/* Prêmios não resgatados */}
      {myWins.map((w) => (
        <Card key={w.id} className="border-2 border-primary bg-gradient-to-br from-primary/15 to-transparent">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <p className="text-sm font-black text-primary uppercase tracking-wider">
                Você ganhou!
              </p>
            </div>
            <p className="text-lg font-bold text-foreground">{w.prize_label}</p>
            {w.prize_value > 0 && (
              <p className="text-xl font-black text-primary">{formatCurrency(w.prize_value)}</p>
            )}
            <div className="rounded-lg bg-background/40 border border-primary/20 p-3 flex items-start gap-2">
              <Phone className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground/80 leading-snug">
                Nosso suporte entrará em contato pelo WhatsApp cadastrado para entregar seu prêmio.
                Se preferir, chame você mesmo o suporte.
              </p>
            </div>
            {!w.claimed && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
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
          <p className="text-[12px] text-foreground/80 leading-snug">
            Adicione seu WhatsApp no perfil para poder participar de competições e receber prêmios.
          </p>
        </div>
      )}

      {/* Ativas */}
      <div className="space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">
          Competições ativas
        </p>

        {loading && <Card className="bg-card/40 border-border/40"><CardContent className="p-6 text-center text-sm text-muted-foreground">Carregando…</CardContent></Card>}

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
          return (
            <Card
              key={c.id}
              className={cn(
                "relative overflow-hidden border bg-card",
                joined ? "border-primary/60 shadow-lg shadow-primary/10" : "border-border/50",
              )}
            >
              <div className="absolute -top-16 -right-16 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
              <CardContent className="relative p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {c.period_type === "weekly" ? "Semanal" : c.period_type === "monthly" ? "Mensal" : "Especial"}
                    </p>
                    <h3 className="text-lg font-black text-foreground leading-tight">{c.name}</h3>
                  </div>
                  <div className="shrink-0 rounded-lg bg-primary/15 border border-primary/30 px-2.5 py-1 flex items-center gap-1">
                    <Gift className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-bold text-primary">PRÊMIO</span>
                  </div>
                </div>

                {c.description && (
                  <p className="text-sm text-foreground/75 leading-snug">{c.description}</p>
                )}

                <div className="rounded-lg bg-primary/10 border border-primary/25 p-3">
                  <p className="text-[10px] uppercase tracking-widest text-primary/80 font-bold">
                    Prêmio
                  </p>
                  <p className="text-base font-black text-foreground mt-0.5">{c.prize_label}</p>
                  {c.prize_value > 0 && (
                    <p className="text-lg font-black text-primary">{formatCurrency(c.prize_value)}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded-lg bg-background/40 border border-border/40 p-2 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-foreground/80">
                      {formatDate(c.starts_at)} → {formatDate(c.ends_at)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-background/40 border border-border/40 p-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-foreground/80">{entryLabel(c)}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-background/40 border border-border/40 p-2 text-[11px] text-foreground/80">
                  <span className="text-muted-foreground">Critério: </span>
                  {metricLabel(c.metric)}
                </div>

                {c.entry_instructions && (
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {c.entry_instructions}
                  </p>
                )}

                {joined ? (
                  <div className="flex gap-2">
                    <div className="flex-1 rounded-lg bg-primary/15 border border-primary/40 px-3 py-2 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-primary">Você está dentro</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleLeave(c)}>
                      Sair
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
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
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-1">
            Encerradas
          </p>
          {finished.map((c) => (
            <Card key={c.id} className="bg-card/40 border-border/40">
              <CardContent className="p-3 flex items-center gap-3">
                <Trophy className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground">{c.prize_label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
