/* ============================================================
   SEUS PRIMEIROS PASSOS — checklist do dashboard (estilo Strava).
   Aparece pra conta NOVA logo depois do onboarding. Trilha
   definida pelo Rick (31/08):
     1. Criar sua conta               (sempre ✓ — ele já está aqui)
     2. Definir sua meta mensal e diária  (página de metas JÁ EXISTE;
        se o plano do onboarding gravou a meta, marca sozinho)
     3. Iniciar um DEFCON 4 de teste  (sentir o placar funcionando)
     4. Conhecer o ranking            (ver e entender as posições)
   Quando fecha os 4 → card "TOUR CONCLUÍDO" com pulso de vitória
   e "agora bora vender" — aparece UMA vez e o checklist some.
   Componente de APRESENTAÇÃO: quem sabe se cada passo foi feito
   é o Index (tem os hooks de metas/defcon/ranking) e passa por props.
   ============================================================ */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

export interface PassoItem {
  id: string;
  titulo: string;
  dica?: string;
  feito: boolean;
  onIr?: () => void; // abre a tela onde o passo acontece
}

const chaveDispensado = (userId: string) => `orbis_primeiros_passos_ok_${userId}`;
const chaveCelebrado = (userId: string) => `orbis_tour_celebrado_${userId}`;

export function primeirosPassosDispensado(userId: string): boolean {
  try { return localStorage.getItem(chaveDispensado(userId)) === "1"; } catch { return false; }
}

/* --- Card de vitória: "TOUR CONCLUÍDO — agora bora vender" ---
   Aparece UMA vez, no CENTRO da tela (campo de visão — regra do Rick),
   com o pulso de vitória dourado. Depois disso o checklist some pra sempre. */
function TourConcluido({ onFechar }: { onFechar: () => void }) {
  const [aberto, setAberto] = useState(true); // fecha sozinho mesmo sem re-render do pai
  if (!aberto) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.8)" }} />
      <div className="orbis-victory relative w-full max-w-md mx-6 rounded-[22px] border p-6 text-center"
        style={{
          "--win-color": "rgba(245,184,0,.55)",
          background: "linear-gradient(160deg,#1C1608 0%,var(--orbis-surface) 60%)",
          borderColor: "rgba(245,184,0,.4)",
          boxShadow: "0 24px 70px -24px rgba(245,184,0,.5)",
        } as React.CSSProperties}>
        <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(180deg,var(--orbis-gold-light),var(--orbis-gold))", boxShadow: "0 4px 0 var(--orbis-gold-deep)" }}>
          <Check size={28} strokeWidth={3.2} color="#1A1200" />
        </div>
        <p className="mt-4 text-[10.5px] font-extrabold uppercase tracking-[.18em]" style={{ color: "var(--orbis-gold)" }}>
          Tour concluído com sucesso
        </p>
        <h2 className="font-display text-[22px] font-extrabold mt-1.5 leading-[1.3]">
          Você já conhece o jogo.<br />
          <span style={{ color: "var(--orbis-gold)" }}>Agora bora vender.</span>
        </h2>
        <button type="button" onClick={() => { setAberto(false); onFechar(); }} className="orbis-cta w-full mt-5">
          BORA VENDER
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default function PrimeirosPassos({ userId, passos, onDispensar }: {
  userId: string;
  passos: PassoItem[];
  onDispensar?: () => void;
}) {
  const feitos = passos.filter((p) => p.feito).length;
  const completo = feitos >= passos.length;

  // Tudo feito → celebra UMA vez, depois some pra sempre
  if (completo || primeirosPassosDispensado(userId)) {
    let celebrado = true;
    try { celebrado = localStorage.getItem(chaveCelebrado(userId)) === "1"; } catch { /* nada */ }
    if (completo && !celebrado) {
      return (
        <TourConcluido onFechar={() => {
          try {
            localStorage.setItem(chaveCelebrado(userId), "1");
            localStorage.setItem(chaveDispensado(userId), "1");
          } catch { /* nada */ }
          onDispensar?.();
        }} />
      );
    }
    if (completo) { try { localStorage.setItem(chaveDispensado(userId), "1"); } catch { /* nada */ } }
    return null;
  }

  // O PRÓXIMO passo pendente ganha o botão "Fazer" (um CTA por vez —
  // regra de foco: nunca dois botões dourados brigando na mesma tela)
  const proximoId = passos.find((p) => !p.feito)?.id;

  return (
    <div className="orbis-card-in rounded-[18px] border p-4"
      style={{ background: "var(--orbis-surface)", borderColor: "rgba(245,184,0,.22)" }}>
      <div className="flex items-baseline justify-between">
        <b className="font-display text-[16px] font-extrabold">Seus primeiros passos</b>
        <span className="orbis-num text-[12px] font-extrabold" style={{ color: "var(--orbis-gold)" }}>
          {feitos} de {passos.length}
        </span>
      </div>

      {/* barra segmentada — um tijolo dourado por passo feito */}
      <div className="flex gap-[5px] mt-[11px] mb-[6px]">
        {passos.map((p, i) => (
          <i key={p.id} className="flex-1 h-[5px] rounded-full"
            style={{ background: i < feitos ? "var(--orbis-gold)" : "rgba(255,255,255,.09)" }} />
        ))}
      </div>

      {passos.map((p) => (
        <div key={p.id} className="flex items-center gap-3 py-2.5"
          style={{ borderTop: "1px solid rgba(255,255,255,.07)" }}>
          {p.feito ? (
            <span className="flex-none w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: "var(--orbis-gold)", color: "#1A1200" }}>
              <Check size={13} strokeWidth={3.4} />
            </span>
          ) : (
            <span className="flex-none w-6 h-6 rounded-full" style={{ border: "2px solid rgba(255,255,255,.18)" }} />
          )}
          <div className="flex-1 min-w-0 text-left">
            <b className="block text-[14px] font-bold"
              style={p.feito ? { color: "var(--orbis-fg-3)", textDecoration: "line-through" } : undefined}>
              {p.titulo}
            </b>
            {!p.feito && p.dica && (
              <small className="block text-[12px] mt-px" style={{ color: "var(--orbis-fg-2)" }}>{p.dica}</small>
            )}
          </div>
          {!p.feito && p.id === proximoId && p.onIr && (
            <button type="button" onClick={p.onIr}
              className="orbis-press flex-none rounded-full px-[13px] py-[7px] text-[12px] font-extrabold"
              style={{ background: "var(--orbis-gold)", color: "#1A1200", boxShadow: "0 3px 0 var(--orbis-gold-deep)" }}>
              Fazer
            </button>
          )}
        </div>
      ))}

      {onDispensar && (
        <button type="button"
          onClick={() => { try { localStorage.setItem(chaveDispensado(userId), "1"); } catch { /* nada */ } onDispensar(); }}
          className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold"
          style={{ color: "var(--orbis-fg-3)" }}>
          <X size={12} /> esconder isso
        </button>
      )}
    </div>
  );
}
