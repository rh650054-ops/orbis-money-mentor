/* ============================================================
   CAMPO "QUE HORAS VOCÊ COMEÇA A VENDER AMANHÃ?" — drop-in.
   O modal Editar Planejamento FICA COMO ERA (decisão do Rick);
   este campo entra no FINAL dele, antes dos botões Cancelar/Salvar,
   com a cara do mock aprovado (bloco tracejado dourado + selo NOVO).
   Ele se vira sozinho: carrega a hora atual ao montar e grava ao
   tocar (salvarHoraInicio). Tocar de novo no mesmo chip desmarca
   — e sem hora marcada, a CobrancaDoCorre não cobra nada.

   Uso (uma linha no modal existente, antes dos botões):
     <CampoHoraVenda userId={user?.id} />
   ============================================================ */
import { useEffect, useState } from "react";
import { carregarPlano, salvarHoraInicio } from "@/shared/onboarding/plano";
import { supabase } from "@/integrations/supabase/client";

export default function CampoHoraVenda({ userId }: { userId?: string }) {
  const [hora, setHora] = useState<number | null>(null);

  useEffect(() => {
    if (!userId) return;
    void carregarPlano(userId).then((p) => setHora(p?.horaInicio ?? null));
  }, [userId]);

  const escolher = (h: number) => {
    const nova = hora === h ? null : h; // tocar de novo desmarca
    setHora(nova);
    if (!userId) return;
    if (nova != null) {
      void salvarHoraInicio(userId, nova);
    } else {
      // desmarcou: limpa no banco (e no local) — sem hora, sem cobrança
      void supabase.from("onboarding_planos").update({ hora_inicio: null }).eq("user_id", userId);
      try {
        const raw = localStorage.getItem(`orbis_plano_corre_${userId}`);
        if (raw) {
          const p = JSON.parse(raw);
          p.horaInicio = null;
          localStorage.setItem(`orbis_plano_corre_${userId}`, JSON.stringify(p));
        }
      } catch { /* nada */ }
    }
  };

  return (
    <div className="relative rounded-2xl px-3 pt-3 pb-2.5" style={{ border: "1.5px dashed rgba(245,184,0,.5)" }}>
      <span className="absolute -top-2 left-3 rounded-full px-2 py-[2px] text-[8.5px] font-extrabold tracking-[.08em]"
        style={{ background: "#F5B800", color: "#1A1200" }}>
        NOVO
      </span>
      <p className="flex items-center gap-1.5 text-sm font-bold leading-snug">
        <span aria-hidden>⏰</span> Que horas você começa a vender amanhã?
      </p>
      <div className="mt-2 flex gap-1.5">
        {[7, 8, 9, 10].map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => escolher(h)}
            className="orbis-press orbis-num flex-1 h-11 rounded-[14px] flex items-center justify-center text-[15px] font-extrabold"
            style={hora === h
              ? { background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1A1200", boxShadow: "0 4px 0 #B88700" }
              : { background: "#1E1E1E", border: "1px solid rgba(255,255,255,.10)", color: "#B9B3A6" }}
          >
            {h}h
          </button>
        ))}
      </div>
      <p className="text-[11px] mt-1.5" style={{ color: "#7E7869" }}>
        {hora != null
          ? `Combinado: às ${hora}h a gente te espera. (tocar de novo desmarca — sem hora, sem cobrança)`
          : "Sem hora marcada, o Orbis não cobra."}
      </p>
    </div>
  );
}
