/* ============================================================
   OFFLINE GATE — "sem internet? um botão e o placar abre".
   Aparece quando o celular está SEM SINAL (fora da tela /offline):
   um painel central com "ATIVAR MODO OFFLINE" → /offline.
   Some sozinho quando o sinal volta. "Só olhar" fecha o painel
   por esta queda de sinal (volta a aparecer numa próxima).
   Fica no router, fora do Layout — cobre TODAS as telas.
   ============================================================ */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { CloudOff, Zap } from "lucide-react";
import { useOnlineStatus } from "@/shared/hooks/use-online-status";
import { useAuth } from "@/hooks/useAuth";
import { diasOfflinePendentes } from "@/shared/lib/offline-day";

export default function OfflineGate() {
  const online = useOnlineStatus();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [dispensado, setDispensado] = useState(false);

  // lembra o id do usuário pra o placar funcionar num boot sem sessão
  useEffect(() => {
    if (user?.id) { try { localStorage.setItem("orbis_ultimo_user_id", user.id); } catch { /* nada */ } }
  }, [user?.id]);

  // voltou o sinal → reseta o "só olhar" pra próxima queda
  useEffect(() => { if (online) setDispensado(false); }, [online]);

  const naTelaOffline = location.pathname.startsWith("/offline");
  const naAuth = location.pathname.startsWith("/auth");
  if (online || naTelaOffline || naAuth || dispensado) return null;

  const uid = (() => { try { return user?.id ?? localStorage.getItem("orbis_ultimo_user_id"); } catch { return user?.id ?? null; } })();
  const pendentes = uid ? diasOfflinePendentes(uid).length : 0;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.84)" }} />
      <div className="orbis-card-in relative w-full max-w-md mx-5 rounded-[22px] border p-6 text-center"
        style={{ background: "linear-gradient(160deg,#17130A 0%,#111 55%)", borderColor: "rgba(245,184,0,.30)", boxShadow: "0 24px 70px -24px rgba(245,184,0,.4)" }}>
        <span className="mx-auto w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)" }}>
          <CloudOff size={26} style={{ color: "#B9B3A6" }} />
        </span>
        <p className="mt-4 text-[10.5px] font-extrabold uppercase tracking-[.16em]" style={{ color: "var(--orbis-gold,#F5B800)" }}>Sem internet</p>
        <h2 className="font-display text-[21px] font-extrabold mt-1.5 leading-[1.3]">
          O corre não para.<br /><span style={{ color: "var(--orbis-gold,#F5B800)" }}>O DEFCON 4 funciona offline.</span>
        </h2>
        <p className="text-[13px] mt-2.5 leading-[1.5]" style={{ color: "#B9B3A6" }}>
          A mesma tela do DEFCON: venda, abordagem, gorjeta, pausa e encerrar. Tudo fica salvo no celular e sobe sozinho quando o sinal voltar.
          {pendentes > 0 && <> Você tem <b style={{ color: "#F4F1EA" }}>{pendentes} {pendentes === 1 ? "dia" : "dias"}</b> esperando pra sincronizar.</>}
        </p>
        <button type="button" onClick={() => navigate("/offline")} className="orbis-cta w-full mt-5">
          <Zap size={17} strokeWidth={2.6} /> ABRIR DEFCON 4 OFFLINE
        </button>
        <button type="button" onClick={() => setDispensado(true)} className="mt-3 text-[13px] font-semibold" style={{ color: "#7E7869" }}>
          só olhar o app
        </button>
      </div>
    </div>,
    document.body,
  );
}
