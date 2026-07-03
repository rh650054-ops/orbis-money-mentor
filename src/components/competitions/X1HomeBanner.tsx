import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate } from "@/shared/lib/date-utils";

// Banner do X1 na HOME: mostra o que importa AGORA —
//  1) alguém te desafiou (responder)  2) duelo ativo HOJE (arena ao vivo)
//  3) senão, CTA pra chamar alguém. Sempre 1 toque até a ação.
const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function X1HomeBanner({ userId }: { userId: string | undefined }) {
  const navigate = useNavigate();
  const [estado, setEstado] = useState<
    | { tipo: "convite"; nome: string; stakes: number }
    | { tipo: "ativo"; nome: string; my: number; opp: number; stakes: number }
    | { tipo: "cta" }
    | null
  >(null);

  useEffect(() => {
    if (!userId) return;
    let vivo = true;
    (async () => {
      const hoje = getBrazilDate();
      const { data } = await supabase
        .from("x1_challenges" as any)
        .select("id, challenger_id, opponent_id, status, scheduled_date, stakes_amount, last_proposed_by")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .in("status", ["pending", "active"])
        .order("created_at", { ascending: false })
        .limit(10);
      const rows = ((data as any[]) || []);
      const ativo = rows.find((c) => c.status === "active" && c.scheduled_date === hoje);
      const convite = rows.find((c) => c.status === "pending" && c.last_proposed_by !== userId);
      const outroId = (c: any) => (c.challenger_id === userId ? c.opponent_id : c.challenger_id);
      const nomeDe = async (uid: string) => {
        const { data: p } = await supabase.from("public_profiles").select("nickname").eq("user_id", uid).maybeSingle();
        return ((p as any)?.nickname as string) || "Vendedor";
      };
      if (!vivo) return;
      if (ativo) {
        const [nome, { data: pl }] = await Promise.all([
          nomeDe(outroId(ativo)),
          (supabase as any).rpc("x1_placar", { p_id: ativo.id }),
        ]);
        const row = ((pl as any[]) || [])[0];
        const iAmCh = ativo.challenger_id === userId;
        if (vivo)
          setEstado({
            tipo: "ativo",
            nome,
            stakes: Number(ativo.stakes_amount) || 0,
            my: row ? Number(iAmCh ? row.challenger_total : row.opponent_total) || 0 : 0,
            opp: row ? Number(iAmCh ? row.opponent_total : row.challenger_total) || 0 : 0,
          });
      } else if (convite) {
        const nome = await nomeDe(outroId(convite));
        if (vivo) setEstado({ tipo: "convite", nome, stakes: Number(convite.stakes_amount) || 0 });
      } else {
        setEstado({ tipo: "cta" });
      }
    })().catch(() => setEstado({ tipo: "cta" }));
    return () => {
      vivo = false;
    };
  }, [userId]);

  if (!estado) return null;

  if (estado.tipo === "convite") {
    return (
      <button
        onClick={() => navigate("/x1")}
        className="w-full rounded-2xl p-3.5 text-left active:scale-[0.98] transition-transform border border-red-500/50 animate-pulse"
        style={{ background: "linear-gradient(100deg,#2a0a0a,#1a0f05)" }}
      >
        <p className="text-[10px] font-black uppercase tracking-widest text-red-400">⚔️ Você foi desafiado!</p>
        <p className="text-sm font-black text-white mt-0.5">
          {estado.nome} te chamou pro X1{estado.stakes > 0 ? ` valendo ${fmt(estado.stakes * 2)}` : ""} — responder agora →
        </p>
      </button>
    );
  }

  if (estado.tipo === "ativo") {
    const naFrente = estado.my >= estado.opp;
    return (
      <button
        onClick={() => navigate("/x1")}
        className="w-full rounded-2xl p-3.5 text-left active:scale-[0.98] transition-transform border border-amber-500/50"
        style={{ background: "linear-gradient(100deg,#1a1206,#0c0c0f)" }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400">
              🔴 X1 AO VIVO {estado.stakes > 0 ? `· ${fmt(estado.stakes * 2)} em jogo` : ""}
            </p>
            <p className="text-sm font-black text-white mt-0.5 truncate">
              Você {fmt(estado.my)} <span className="text-amber-400 italic">VS</span> {fmt(estado.opp)} {estado.nome}
            </p>
          </div>
          <span className="text-2xl shrink-0">{naFrente ? "🔥" : "⚠️"}</span>
        </div>
        <p className="text-[10px] font-bold mt-1" style={{ color: naFrente ? "#22c55e" : "#ff9b9b" }}>
          {naFrente ? "Você está na frente — não para!" : `${estado.nome} está na frente — cada venda conta!`} Abrir arena →
        </p>
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate("/x1")}
      className="w-full rounded-2xl p-3 text-left active:scale-[0.98] transition-transform border border-border/60 bg-card/40 flex items-center gap-3"
    >
      <span className="w-9 h-9 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0">
        <Swords className="w-4.5 h-4.5 text-amber-400" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-black text-foreground">Duvida que vende mais que alguém? ⚔️</span>
        <span className="block text-[10px] text-muted-foreground">Chama pro X1 valendo dinheiro — o extrato decide.</span>
      </span>
    </button>
  );
}
