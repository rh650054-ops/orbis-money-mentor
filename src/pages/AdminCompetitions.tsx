import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { toast } from "@/shared/hooks/use-toast";
import { Trophy, Plus, Trash2, CheckCircle2, ArrowLeft } from "lucide-react";

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
  status: string;
  winner_user_id: string | null;
}

interface Participant {
  id: string;
  competition_id: string;
  user_id: string;
  score: number;
  paid: boolean;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const inDaysIso = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

export default function AdminCompetitions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { whitelisted, role, loading } = useAdminAccess(user?.id);
  const [comps, setComps] = useState<Comp[]>([]);
  const [parts, setParts] = useState<Record<string, Participant[]>>({});
  const [profileMap, setProfileMap] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    description: "",
    prize_label: "",
    prize_value: "0",
    period_type: "weekly",
    starts_at: todayIso(),
    ends_at: inDaysIso(7),
    metric: "pix_revenue",
    entry_rule: "free",
    entry_fee: "0",
    entry_instructions: "",
    audience_type: "open", // open | invite | city
    audience_cities: "", // comma-separated
    invited_cpfs: "", // comma or newline separated
  });

  const isAdmin = whitelisted && role === "admin";

  const load = async () => {
    const { data: c } = await supabase
      .from("competitions" as any)
      .select("*")
      .order("created_at", { ascending: false });
    setComps((c as any) || []);
    const { data: p } = await supabase.from("competition_participants" as any).select("*");
    const grouped: Record<string, Participant[]> = {};
    (p as any[] | null)?.forEach((row) => {
      (grouped[row.competition_id] ||= []).push(row);
    });
    setParts(grouped);

    const userIds = Array.from(new Set((p as any[] | null)?.map((r) => r.user_id) || []));
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,nickname")
        .in("user_id", userIds);
      const map: Record<string, string> = {};
      profs?.forEach((pr: any) => (map[pr.user_id] = pr.nickname || pr.user_id.slice(0, 6)));
      setProfileMap(map);
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        <Button onClick={() => navigate("/ranking")}>Voltar</Button>
      </div>
    );
  }

  const create = async () => {
    if (!user) return;
    if (!form.name || !form.prize_label) {
      toast({ title: "Preencha nome e prêmio", variant: "destructive" });
      return;
    }

    // Resolve invited CPFs -> user_ids
    let invited_user_ids: string[] = [];
    if (form.audience_type === "invite" && form.invited_cpfs.trim()) {
      const cpfs = form.invited_cpfs
        .split(/[,\n]/)
        .map((s) => s.replace(/\D/g, ""))
        .filter((s) => s.length === 11);
      if (cpfs.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,cpf")
          .in("cpf", cpfs);
        invited_user_ids = (profs || []).map((p: any) => p.user_id);
        if (invited_user_ids.length < cpfs.length) {
          toast({
            title: "Alguns CPFs não foram encontrados",
            description: `${invited_user_ids.length}/${cpfs.length} cadastrados serão convidados.`,
          });
        }
      }
    }

    const audience_cities =
      form.audience_type === "city"
        ? form.audience_cities
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    const { error } = await supabase.from("competitions" as any).insert({
      name: form.name,
      description: form.description || null,
      prize_label: form.prize_label,
      prize_value: Number(form.prize_value) || 0,
      period_type: form.period_type,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      metric: form.metric,
      entry_rule: form.entry_rule,
      entry_fee: form.entry_rule === "paid" ? Number(form.entry_fee) || 0 : null,
      entry_instructions: form.entry_instructions || null,
      status: "active",
      created_by: user.id,
      audience_type: form.audience_type,
      audience_cities,
      invited_user_ids,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Competição criada!" });
      setForm({
        ...form,
        name: "",
        description: "",
        prize_label: "",
        prize_value: "0",
        entry_instructions: "",
        audience_cities: "",
        invited_cpfs: "",
      });
      load();
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir competição?")) return;
    await supabase.from("competitions" as any).delete().eq("id", id);
    load();
  };

  const finish = async (c: Comp, winnerUserId: string) => {
    if (!confirm(`Finalizar competição e premiar ${profileMap[winnerUserId] || winnerUserId}?`)) return;
    await supabase
      .from("competitions" as any)
      .update({ status: "finished", winner_user_id: winnerUserId })
      .eq("id", c.id);
    await supabase.from("competition_winners" as any).insert({
      competition_id: c.id,
      user_id: winnerUserId,
      prize_label: c.prize_label,
      prize_value: c.prize_value,
    });
    toast({ title: "Vencedor registrado! 🏆" });
    load();
  };

  return (
    <div className="pb-8 space-y-5 px-4 pt-4 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/ranking")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Admin · Competições</h1>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold uppercase tracking-wider text-primary">Nova competição</p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prêmio (texto)</Label>
                <Input
                  placeholder="iPhone, R$500 PIX..."
                  value={form.prize_label}
                  onChange={(e) => setForm({ ...form, prize_label: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor R$</Label>
                <Input
                  type="number"
                  value={form.prize_value}
                  onChange={(e) => setForm({ ...form, prize_value: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Período</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={form.period_type}
                  onChange={(e) => setForm({ ...form, period_type: e.target.value })}
                >
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="custom">Personalizado</option>
                </select>
              </div>
              <div>
                <Label>Métrica</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={form.metric}
                  onChange={(e) => setForm({ ...form, metric: e.target.value })}
                >
                  <option value="pix_revenue">Faturamento PIX</option>
                  <option value="pix_sales_count">Nº vendas PIX</option>
                  <option value="streak">Ofensiva (dias)</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input
                  type="date"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                />
              </div>
              <div>
                <Label>Fim</Label>
                <Input
                  type="date"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entrada</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={form.entry_rule}
                  onChange={(e) => setForm({ ...form, entry_rule: e.target.value })}
                >
                  <option value="free">Livre</option>
                  <option value="paid">Paga</option>
                  <option value="invite">Convite</option>
                </select>
              </div>
              {form.entry_rule === "paid" && (
                <div>
                  <Label>Taxa R$</Label>
                  <Input
                    type="number"
                    value={form.entry_fee}
                    onChange={(e) => setForm({ ...form, entry_fee: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div>
              <Label>Instruções de entrada (opcional)</Label>
              <Textarea
                value={form.entry_instructions}
                onChange={(e) => setForm({ ...form, entry_instructions: e.target.value })}
                rows={2}
                placeholder="Ex: envie PIX para X e avise no WhatsApp..."
              />
            </div>

            {/* Quem pode participar */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
              <p className="text-xs font-black uppercase tracking-wider text-primary">
                Quem pode participar
              </p>
              <div>
                <Label>Público</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  value={form.audience_type}
                  onChange={(e) => setForm({ ...form, audience_type: e.target.value })}
                >
                  <option value="open">Aberto a todos</option>
                  <option value="city">Restrito a cidades</option>
                  <option value="invite">Apenas convidados (por CPF)</option>
                </select>
              </div>
              {form.audience_type === "city" && (
                <div>
                  <Label>Cidades permitidas (separadas por vírgula)</Label>
                  <Input
                    placeholder="São Paulo, Rio de Janeiro"
                    value={form.audience_cities}
                    onChange={(e) => setForm({ ...form, audience_cities: e.target.value })}
                  />
                </div>
              )}
              {form.audience_type === "invite" && (
                <div>
                  <Label>CPFs convidados (vírgula ou uma linha cada)</Label>
                  <Textarea
                    rows={3}
                    placeholder="12345678900, 98765432100"
                    value={form.invited_cpfs}
                    onChange={(e) => setForm({ ...form, invited_cpfs: e.target.value })}
                  />
                </div>
              )}
            </div>

            <Button onClick={create}>Criar competição</Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div className="space-y-3">
        {comps.map((c) => (
          <Card key={c.id} className="border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-widest text-primary font-bold">
                    {c.status} · {c.period_type}
                  </p>
                  <h3 className="font-bold text-foreground">{c.name}</h3>
                  <p className="text-xs text-muted-foreground">{c.prize_label}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Participantes ({(parts[c.id] || []).length})
                </p>
                <div className="space-y-1">
                  {(parts[c.id] || []).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-background/40 border border-border/40 px-2 py-1.5"
                    >
                      <span className="text-xs text-foreground">{profileMap[p.user_id] || p.user_id.slice(0, 8)}</span>
                      {c.status === "active" && (
                        <Button size="sm" variant="outline" onClick={() => finish(c, p.user_id)}>
                          <Trophy className="w-3.5 h-3.5 mr-1" />
                          Premiar
                        </Button>
                      )}
                      {c.winner_user_id === p.user_id && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  ))}
                  {(parts[c.id] || []).length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Sem participantes ainda.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
