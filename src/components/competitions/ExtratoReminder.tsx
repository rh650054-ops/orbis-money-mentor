import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getExtratoDia } from "@/shared/lib/date-utils";

// Banner: lembra quem está em competição ativa (e vendeu no dia) de subir o extrato
// antes das 9h, pra não zerar no ranking. Dispensável por dia (sessionStorage).
export function ExtratoReminder({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [ctx, setCtx] = useState<"comp" | "x1" | "both" | "geral">("comp"); // competição, X1, os dois, ou geral
  const dia = getExtratoDia();
  const diaLabel = `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(`orbis_extrato_reminder_${dia}`) === "1";
    } catch {
      /* noop */
    }
    if (dismissed) return;
    (async () => {
      // 1) Competições ativas que cobrem o dia.
      const { data: parts } = await supabase
        .from("competition_participants" as any)
        .select("competition_id")
        .eq("user_id", userId);
      const ids = Array.from(new Set(((parts as any[]) || []).map((p) => p.competition_id))).filter(Boolean);
      let cobreDia = false;
      if (ids.length > 0) {
        const { data: comps } = await supabase
          .from("competitions" as any)
          .select("starts_at, ends_at")
          .in("id", ids)
          .eq("status", "active");
        cobreDia = ((comps as any[]) || []).some((c) => {
          const s = String(c.starts_at).slice(0, 10);
          const e = String(c.ends_at).slice(0, 10);
          return dia >= s && dia <= e;
        });
      }
      // 1b) X1 marcado JUSTAMENTE pra esse dia (a data do duelo é combinada na proposta).
      const { data: x1s } = await supabase
        .from("x1_challenges" as any)
        .select("id")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .eq("scheduled_date", dia)
        .in("status", ["accepted", "active"]);
      const temX1 = ((x1s as any[]) || []).length > 0;
      // Agora vale pra TODOS (o extrato conta no ranking de todo mundo) — não trava mais
      // por competição/X1. Só precisa ter vendido no dia e ainda não ter subido o extrato.

      // 2) Vendeu nesse dia? (sem venda, não há o que comprovar)
      const { data: sale } = await supabase
        .from("daily_sales")
        .select("id")
        .eq("user_id", userId)
        .eq("date", dia)
        .limit(1);
      if (!sale || sale.length === 0) return;
      // 3) Já subiu o extrato desse dia?
      const { data: ext } = await supabase
        .from("extrato_uploads")
        .select("tipo")
        .eq("user_id", userId)
        .eq("dia", dia);
      if (ext && ext.length > 0) return;
      if (alive) {
        setCtx(cobreDia && temX1 ? "both" : temX1 ? "x1" : cobreDia ? "comp" : "geral");
        setShow(true);
      }
    })().catch(() => {
      /* best-effort */
    });
    return () => {
      alive = false;
    };
  }, [userId, dia]);

  if (!show) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(`orbis_extrato_reminder_${dia}`, "1");
    } catch {
      /* noop */
    }
    setShow(false);
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-card to-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
        <Clock className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">
          {ctx === "both" ? "Competição + X1: " : ctx === "x1" ? "X1: " : ctx === "comp" ? "Competição: " : ""}Sobe teu extrato! ⏰
        </p>
        <p className="text-xs text-muted-foreground">
          {ctx === "x1"
            ? `Extrato do seu duelo (${diaLabel}) pra valer — envie até as 9h.`
            : ctx === "both"
              ? `Extrato de ${diaLabel} vale pro ranking E pro seu X1 — até as 9h.`
              : `Extrato de ${diaLabel} pra valer no ranking — você tem até as 9h.`}
        </p>
      </div>
      <button
        onClick={() => navigate("/meu-extrato")}
        className="shrink-0 h-9 px-3.5 rounded-xl bg-amber-500 text-black text-sm font-bold active:scale-95 transition-transform"
      >
        Enviar
      </button>
      <button onClick={dismiss} aria-label="Dispensar" className="shrink-0 text-muted-foreground/60 hover:text-muted-foreground">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
