import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { toast } from "@/shared/hooks/use-toast";
import { ArrowLeft, ShieldAlert, Loader2, EyeOff, ChevronDown, ChevronUp } from "lucide-react";

interface Suspect {
  user_id: string;
  nome: string;
  dia: string;
  valor_hoje: number;
  base_media: number;
  ratio: number;
  worked_min: number;
  ritmo: number;
}
interface HistRow {
  dia: string;
  valor: number;
  qtd: number;
  worked_min: number;
  ritmo: number;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const dMM = (iso: string) => {
  try {
    return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  } catch {
    return iso;
  }
};

// Tela de admin: caça-trapaça. Lista quem fez um dia MUITO acima da própria média
// (com ritmo/tempo do dia), deixa ver o histórico e ocultar do ranking.
export default function AdminAntiCheat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { whitelisted, role, loading: adminLoading } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [ratio, setRatio] = useState("1.8");
  const [list, setList] = useState<Suspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [hist, setHist] = useState<Record<string, HistRow[]>>({});
  const [hiding, setHiding] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const r = Number(String(ratio).replace(",", ".")) || 1.8;
    const { data, error } = await supabase.rpc("defcon_anomaly_suspects" as any, { p_lookback: 21, p_min_ratio: r });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setList(((data as any[]) || []) as Suspect[]);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const openHist = async (uid: string) => {
    if (openUid === uid) {
      setOpenUid(null);
      return;
    }
    setOpenUid(uid);
    if (!hist[uid]) {
      const { data } = await supabase.rpc("defcon_user_history" as any, { p_user_id: uid, p_days: 30 });
      setHist((h) => ({ ...h, [uid]: ((data as any[]) || []) as HistRow[] }));
    }
  };

  const hide = async (uid: string, nome: string) => {
    if (!window.confirm(`Ocultar ${nome || "esse usuário"} do ranking? Dá pra devolver depois em Assinaturas.`)) return;
    setHiding(uid);
    try {
      const { error } = await supabase.from("profiles").update({ ranking_hidden: true } as any).eq("user_id", uid);
      if (error) throw error;
      await supabase.from("leaderboard_stats").delete().eq("user_id", uid);
      const now = new Date();
      const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      await supabase.rpc("recalculate_ranking_positions", { target_month: mes });
      toast({ title: "🚫 Removido do ranking", description: `${nome || "Usuário"} foi ocultado.` });
      setList((l) => l.filter((s) => s.user_id !== uid));
    } catch (e: any) {
      toast({ title: "Erro ao ocultar", description: e?.message, variant: "destructive" });
    } finally {
      setHiding(null);
    }
  };

  if (adminLoading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin)
    return (
      <div className="p-8 text-center">
        <p className="text-lg font-bold">Acesso restrito</p>
        <button onClick={() => navigate("/")} className="mt-3 text-primary underline">Voltar</button>
      </div>
    );

  return (
    <div className="pb-24 px-4 pt-4 max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/40 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" /> Anti-trapaça
          </h1>
          <p className="text-sm text-muted-foreground">Quem fez um dia muito acima da própria média</p>
        </div>
      </div>

      <div className="flex items-end gap-2 rounded-xl border border-border bg-card/40 p-3">
        <div className="flex-1">
          <label className="text-[11px] text-muted-foreground">Sensibilidade (quantas vezes a média do próprio usuário)</label>
          <input
            value={ratio}
            onChange={(e) => setRatio(e.target.value)}
            inputMode="decimal"
            className="mt-1 w-full h-10 px-3 rounded-lg bg-card border border-border text-sm text-foreground"
          />
        </div>
        <button onClick={load} className="h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Aplicar</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          Ninguém suspeito no momento.
          <br />
          <span className="text-xs">(Precisa de alguns dias de histórico pra ter uma média de comparação.)</span>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((s) => (
            <div key={s.user_id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{s.nome || "Vendedor"}</p>
                    <p className="text-[11px] text-muted-foreground">dia {dMM(s.dia)}</p>
                  </div>
                  <span className="shrink-0 text-sm font-black px-2 py-1 rounded-lg bg-red-500/15 text-red-400">
                    {s.ratio ? `${s.ratio}×` : "—"} a média
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div className="rounded-lg bg-card border border-border/60 py-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Hoje</p>
                    <p className="text-sm font-black text-foreground">{fmt(s.valor_hoje)}</p>
                  </div>
                  <div className="rounded-lg bg-card border border-border/60 py-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Média dele</p>
                    <p className="text-sm font-black text-foreground">{fmt(s.base_media)}</p>
                  </div>
                  <div className="rounded-lg bg-card border border-border/60 py-1.5">
                    <p className="text-[9px] uppercase text-muted-foreground">Ritmo</p>
                    <p className="text-sm font-black text-foreground">{s.ritmo != null ? `${s.ritmo}min` : "—"}</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Trabalhou {s.worked_min != null ? `${Math.round(s.worked_min)}min` : "—"} nesse dia · ritmo = minutos por venda
                </p>
                <div className="flex gap-2 mt-2.5">
                  <button onClick={() => openHist(s.user_id)} className="flex-1 h-9 rounded-lg bg-card border border-border text-xs font-bold inline-flex items-center justify-center gap-1">
                    {openUid === s.user_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />} Histórico
                  </button>
                  <button
                    onClick={() => hide(s.user_id, s.nome)}
                    disabled={hiding === s.user_id}
                    className="flex-1 h-9 rounded-lg bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold inline-flex items-center justify-center gap-1 disabled:opacity-60"
                  >
                    {hiding === s.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />} Ocultar do ranking
                  </button>
                </div>
              </div>

              {openUid === s.user_id && (
                <div className="border-t border-border/60 bg-card/40 p-3">
                  {!hist[s.user_id] ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Carregando histórico…</p>
                  ) : hist[s.user_id].length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Sem histórico.</p>
                  ) : (
                    <div className="space-y-1">
                      <div className="grid grid-cols-4 gap-1 text-[9px] uppercase text-muted-foreground px-1">
                        <span>Dia</span>
                        <span className="text-right">Valor</span>
                        <span className="text-right">Vendas</span>
                        <span className="text-right">Ritmo</span>
                      </div>
                      {hist[s.user_id].map((h) => (
                        <div key={h.dia} className="grid grid-cols-4 gap-1 text-[11px] px-1 py-1 rounded bg-card/60">
                          <span className="text-muted-foreground">{dMM(h.dia)}</span>
                          <span className="text-right font-semibold text-foreground">{fmt(h.valor)}</span>
                          <span className="text-right text-muted-foreground">{h.qtd}</span>
                          <span className="text-right text-muted-foreground">{h.ritmo != null ? `${h.ritmo}min` : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
