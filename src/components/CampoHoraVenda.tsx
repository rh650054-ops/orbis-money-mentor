/* ============================================================
   CAMPO "QUE HORAS VOCÊ COSTUMA COMEÇAR A VENDER?" — drop-in.
   07/10/2026 (Rick): antes só tinha 7h, 8h, 9h e 10h; tem vendedor que começa
   à 1 da tarde, às 3. Agora os atalhos da manhã ficam e "outro horário" abre
   todas as horas de 5h às 22h.
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
import { avisar } from "@/shared/lib/avisar";

const ATALHOS = [7, 8, 9, 10];
const TODAS = Array.from({ length: 18 }, (_, i) => i + 5); // 5h … 22h

function Chip({ h, ativo, pequeno, onClick }: { h: number; ativo: boolean; pequeno?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`orbis-press orbis-num ${pequeno ? "h-9 text-[13px]" : "h-11 text-[15px]"} rounded-[12px] flex items-center justify-center font-extrabold`}
      style={ativo
        ? { background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1A1200", boxShadow: "0 4px 0 #B88700" }
        : { background: "#1E1E1E", border: "1px solid rgba(255,255,255,.10)", color: "#B9B3A6" }}>
      {h}h
    </button>
  );
}

export default function CampoHoraVenda({ userId }: { userId?: string }) {
  const [hora, setHora] = useState<number | null>(null);
  const [abrirTodas, setAbrirTodas] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void carregarPlano(userId).then((p) => setHora(p?.horaInicio ?? null));
  }, [userId]);

  const escolher = (h: number) => {
    const nova = hora === h ? null : h; // tocar de novo desmarca
    setHora(nova);
    setAbrirTodas(false);
    if (!userId) return;
    if (nova != null) {
      void salvarHoraInicio(userId, nova);
    } else {
      // desmarcou: limpa no banco (e no local) — sem hora, sem cobrança
      void supabase.from("onboarding_planos").update({ hora_inicio: null }).eq("user_id", userId)
        .then(({ error }) => { if (error) avisar.usuario("Não consegui salvar a hora de início. Tenta de novo.", error, "CampoHoraVenda: limpar hora"); });
      try {
        const raw = localStorage.getItem(`orbis_plano_corre_${userId}`);
        if (raw) {
          const p = JSON.parse(raw);
          p.horaInicio = null;
          localStorage.setItem(`orbis_plano_corre_${userId}`, JSON.stringify(p));
        }
      } catch (e) { avisar.silencioso("CampoHoraVenda: plano local", e); }
    }
  };

  return (
    <div className="relative rounded-2xl px-3 pt-3 pb-2.5" style={{ border: "1.5px dashed rgba(245,184,0,.5)" }}>
      <span className="absolute -top-2 left-3 rounded-full px-2 py-[2px] text-[8.5px] font-extrabold tracking-[.08em]"
        style={{ background: "#F5B800", color: "#1A1200" }}>
        NOVO
      </span>
      <p className="flex items-center gap-1.5 text-sm font-bold leading-snug">
        <span aria-hidden>⏰</span> Que horas você costuma começar a vender?
      </p>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {[7, 8, 9, 10].map((h) => (
          <Chip key={h} h={h} ativo={hora === h} onClick={() => escolher(h)} />
        ))}
        {hora != null && !ATALHOS.includes(hora) ? (
          <Chip h={hora} ativo onClick={() => setAbrirTodas((v) => !v)} />
        ) : (
          <button type="button" onClick={() => setAbrirTodas((v) => !v)}
            className="orbis-press h-11 rounded-[14px] text-[11.5px] font-extrabold leading-tight"
            style={abrirTodas
              ? { background: "#2a2418", border: "1px solid rgba(245,184,0,.5)", color: "#F5B800" }
              : { background: "#1E1E1E", border: "1px solid rgba(255,255,255,.10)", color: "#B9B3A6" }}>
            outro<br />horário
          </button>
        )}
      </div>
      {abrirTodas && (
        <div className="mt-2 grid grid-cols-6 gap-1.5">
          {TODAS.map((h) => (
            <Chip key={h} h={h} ativo={hora === h} pequeno onClick={() => escolher(h)} />
          ))}
        </div>
      )}
      <p className="text-[11px] mt-1.5" style={{ color: "#7E7869" }}>
        {hora != null
          ? `Combinado: às ${hora}h a gente te espera. (tocar de novo desmarca — sem hora, sem cobrança)`
          : "Sem hora marcada, a Vant não cobra."}
      </p>
    </div>
  );
}
