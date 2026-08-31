/* ============================================================
   CAMPO "QUE HORAS VOCÊ COMEÇA A VENDER AMANHÃ?" — drop-in.
   O modal Editar Planejamento FICA COMO ERA (decisão do Rick);
   este campo entra no FINAL dele, antes dos botões Cancelar/Salvar.
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
    <div className="mt-3">
      <p className="text-[10.5px] font-extrabold uppercase tracking-[.16em]" style={{ color: "var(--orbis-fg-3, #7E7869)" }}>
        Que horas você começa a vender amanhã?
      </p>
      <div className="mt-1.5 flex gap-1.5">
        {[7, 8, 9, 10].map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => escolher(h)}
            className="orbis-press orbis-num flex-1 h-11 rounded-[13px] flex items-center justify-center text-[15px] font-extrabold"
            style={hora === h
              ? { background: "linear-gradient(180deg,var(--orbis-gold-light,#FFC63A),var(--orbis-gold,#F5B800))", color: "#1A1200", boxShadow: "0 4px 0 var(--orbis-gold-deep,#B88700)" }
              : { background: "#101010", border: "1px solid var(--orbis-line, rgba(255,255,255,.09))", color: "var(--orbis-fg-2, #B9B3A6)" }}
          >
            {h}h
          </button>
        ))}
      </div>
      <p className="text-[11px] mt-1" style={{ color: "var(--orbis-fg-3, #7E7869)" }}>
        {hora != null ? `Combinado: às ${hora}h a gente te espera.` : "Sem hora marcada, o Orbis não cobra."}
      </p>
    </div>
  );
}
