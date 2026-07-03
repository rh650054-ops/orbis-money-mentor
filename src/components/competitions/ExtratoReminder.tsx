import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getBrazilDate, getExtratoDia } from "@/shared/lib/date-utils";

// ============================================================================
// LEMBRETE DE EXTRATO — modelo semanal (semana = domingo → sábado):
//  · Durante a semana o ranking roda AO VIVO pelo DEFCON — NINGUÉM é cobrado.
//  · DOMINGO é o dia do extrato: banner pra quem tem dia da semana passada
//    vendido e ainda sem comprovar (1 envio, a IA separa por dia).
//  · Exceção: dia de X1 marcado — banner urgente NO DIA (o duelo paga às 9h05
//    do dia seguinte e só vale com o extrato do próprio dia).
// Dispensável por dia (sessionStorage).
// ============================================================================
export function ExtratoReminder({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [show, setShow] = useState(false);
  const [modo, setModo] = useState<"x1" | "domingo">("domingo");
  const [diasFaltando, setDiasFaltando] = useState(0);
  const hoje = getBrazilDate();
  const diaExtrato = getExtratoDia(); // dia que "conta" agora (ontem até as 9h)
  const diaLabel = `${diaExtrato.slice(8, 10)}/${diaExtrato.slice(5, 7)}`;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    try {
      if (sessionStorage.getItem(`orbis_extrato_reminder_${hoje}`) === "1") return;
    } catch { /* noop */ }

    (async () => {
      // ---- Exceção X1: duelo marcado pro "dia do extrato" exige envio no prazo ----
      const { data: x1s } = await supabase
        .from("x1_challenges" as any)
        .select("id")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .eq("scheduled_date", diaExtrato)
        .in("status", ["accepted", "active"]);
      if (((x1s as any[]) || []).length > 0) {
        // Só cobra se ainda não subiu o extrato desse dia.
        const { data: ext } = await supabase
          .from("extrato_uploads")
          .select("tipo")
          .eq("user_id", userId)
          .eq("dia", diaExtrato);
        if ((!ext || ext.length === 0) && alive) {
          setModo("x1");
          setShow(true);
        }
        return;
      }

      // ---- Domingo: cobra a SEMANA PASSADA (domingo→sábado que acabou de fechar) ----
      const d = new Date(`${hoje}T12:00:00Z`);
      if (d.getUTCDay() !== 0) return; // só domingo
      const ini = new Date(d); ini.setUTCDate(ini.getUTCDate() - 7); // domingo passado
      const fim = new Date(d); fim.setUTCDate(fim.getUTCDate() - 1); // sábado (ontem)
      const iniISO = ini.toISOString().slice(0, 10);
      const fimISO = fim.toISOString().slice(0, 10);

      const [{ data: vendas }, { data: exts }] = await Promise.all([
        supabase.from("daily_sales").select("date").eq("user_id", userId).gte("date", iniISO).lte("date", fimISO),
        supabase.from("extrato_uploads").select("dia").eq("user_id", userId).gte("dia", iniISO).lte("dia", fimISO),
      ]);
      const vendidos = new Set(((vendas as any[]) || []).map((r) => String(r.date).slice(0, 10)));
      const comprovados = new Set(((exts as any[]) || []).map((r) => String(r.dia).slice(0, 10)));
      const faltam = [...vendidos].filter((dd) => !comprovados.has(dd)).length;
      if (faltam > 0 && alive) {
        setDiasFaltando(faltam);
        setModo("domingo");
        setShow(true);
      }
    })().catch(() => { /* best-effort */ });

    return () => { alive = false; };
  }, [userId, hoje, diaExtrato]);

  if (!show) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(`orbis_extrato_reminder_${hoje}`, "1"); } catch { /* noop */ }
    setShow(false);
  };

  return (
    <div className="mb-4 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-card to-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
        {modo === "x1" ? <Clock className="w-5 h-5" /> : <span className="text-lg">📅</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">
          {modo === "x1" ? "⚔️ X1: sobe teu extrato!" : "Domingo é dia de extrato! 📅"}
        </p>
        <p className="text-xs text-muted-foreground">
          {modo === "x1"
            ? `Extrato do dia do duelo (${diaLabel}) até as 9h — sem ele, conta R$ 0 na liquidação.`
            : `Falta comprovar ${diasFaltando} dia(s) da semana passada. Manda o extrato da semana — 1 envio e a IA separa por dia.`}
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
