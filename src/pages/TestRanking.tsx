import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";
import { formatCurrency } from "@/shared/lib/utils";
import { RankingPodium } from "@/components/ranking/RankingPodium";
import { RankingList } from "@/components/ranking/RankingList";
import type { LeaderboardEntry } from "@/hooks/useLeaderboard";

// Ranking de TESTE (só admin). Cópia do Semanal real (pódio verde + lista), com
// vendedores FAKE pra encher + a SUA conta DE VERDADE: cada venda do DEFCON e cada
// extrato que você sobe entra aqui, pra você conferir se contou. 100% isolado.

function entry(id: string, nome: string, fat: number): LeaderboardEntry {
  return {
    id, user_id: id, nome_usuario: nome, avatar_url: null, mes_referencia: "teste",
    faturamento_total_mes: fat, dias_trabalhados_mes: 0,
    constancia_maior_streak: 0, constancia_streak_atual: 0,
    posicao_faturamento: null, posicao_constancia: null, last_active_at: null,
  };
}

const FAKES: LeaderboardEntry[] = [
  entry("fake-1", "Zé do Açaí", 1480),
  entry("fake-2", "Lu Brigadeiro", 1170),
  entry("fake-3", "Carlos Doceiro", 920),
  entry("fake-4", "Rosa Tapioca", 740),
  entry("fake-5", "Bia Salgados", 560),
  entry("fake-6", "Pedro Caldo", 390),
  entry("fake-7", "Tonho Churros", 240),
];

// Segunda-feira desta semana (sem trava do dia 1 — pra dar pra testar hoje).
function mondayOf(todayISO: string): string {
  const d = new Date(`${todayISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function diaLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  const wd = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d.getUTCDay()];
  return `${wd} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface DiaBreak { dia: string; valor: number; fonte: "extrato" | "ao vivo"; temDado: boolean; }

export default function TestRanking() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { whitelisted, role, loading: adminLoading } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [myTotal, setMyTotal] = useState(0);
  const [breakdown, setBreakdown] = useState<DiaBreak[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const today = getBrazilDate();
      const weekStart = mondayOf(today);
      const [{ data: ds }, { data: ex }] = await Promise.all([
        supabase.from("daily_sales").select("date, card_sales, pix_sales").eq("user_id", user.id).gte("date", weekStart).lte("date", today),
        supabase.from("extrato_uploads" as any).select("dia, total_verificado").eq("user_id", user.id).gte("dia", weekStart).lte("dia", today),
      ]);
      const live: Record<string, number> = {};
      (ds as any[] | null)?.forEach((r) => {
        const day = String(r.date).slice(0, 10);
        live[day] = (live[day] ?? 0) + Number(r.card_sales || 0) + Number(r.pix_sales || 0);
      });
      const extrato: Record<string, number> = {};
      (ex as any[] | null)?.forEach((r) => {
        const day = String(r.dia).slice(0, 10);
        extrato[day] = (extrato[day] ?? 0) + Number(r.total_verificado || 0);
      });
      const days: string[] = [];
      const d = new Date(`${weekStart}T12:00:00Z`);
      const end = new Date(`${today}T12:00:00Z`);
      while (d.getTime() <= end.getTime()) { days.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
      const bd: DiaBreak[] = days.map((dia) => {
        const ext = extrato[dia] ?? 0;
        const lv = live[dia] ?? 0;
        const usaExtrato = ext > 0;
        return { dia, valor: usaExtrato ? ext : lv, fonte: usaExtrato ? "extrato" : "ao vivo", temDado: ext > 0 || lv > 0 };
      });
      setBreakdown(bd);
      setMyTotal(bd.reduce((s, b) => s + b.valor, 0));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  if (adminLoading) return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        <button onClick={() => navigate("/ranking")} className="text-primary underline">Voltar</button>
      </div>
    );
  }

  const meEntry = entry(user?.id ?? "me", "VOCÊ (teste)", myTotal);
  const all = [...FAKES, meEntry]
    .sort((a, b) => b.faturamento_total_mes - a.faturamento_total_mes)
    .map((e, i) => ({ ...e, posicao_faturamento: i + 1 }));
  const meRanked = all.find((e) => e.user_id === meEntry.user_id) ?? null;
  const [top1, top2, top3] = all;

  return (
    <div className="px-4 py-4 space-y-4 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/ranking")} className="flex items-center gap-1 text-xs text-muted-foreground">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>
        <span className="text-[11px] font-bold tracking-wider text-emerald-400">🧪 RANKING TESTE · SÓ VOCÊ VÊ</span>
      </div>

      {/* Painel: a SUA conta de verdade — o que contou */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold">Sua conta (real) · #{meRanked?.posicao_faturamento}</p>
            <p className="text-2xl font-black text-foreground">{formatCurrency(myTotal)}</p>
          </div>
          <button onClick={load} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 font-semibold active:scale-95 transition disabled:opacity-60">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </div>
        <div className="space-y-1 pt-1">
          {breakdown.filter((b) => b.temDado).length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma venda/extrato esta semana ainda. Faça uma venda no DEFCON ou suba um extrato e toque <b>Atualizar</b>.</p>
          ) : (
            breakdown.filter((b) => b.temDado).map((b) => (
              <div key={b.dia} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{diaLabel(b.dia)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-foreground font-semibold tabular-nums">{formatCurrency(b.valor)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${b.fonte === "extrato" ? "bg-emerald-500/20 text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                    {b.fonte === "extrato" ? "extrato ✓" : "ao vivo"}
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
        <p className="text-[10px] text-muted-foreground pt-1">Regra: o extrato do dia substitui o "ao vivo". Só cartão + pix verificado conta.</p>
      </div>

      <RankingPodium top1={top1} top2={top2} top3={top3} formatCurrency={formatCurrency} onOpenProfile={() => {}} variant="semanal" />
      <RankingList ranking={all} me={meRanked} formatCurrency={formatCurrency} onOpenProfile={() => {}} />
    </div>
  );
}
