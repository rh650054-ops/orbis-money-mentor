import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GoldenTicket } from "@/components/competitions/GoldenTicket";
import { getActiveWeeklyChallenge, isFirstDay } from "@/shared/lib/weeklyChallenge";

// Evento pra o ícone dourado (no DEFCON) reabrir o bilhete que mora no Layout.
const OPEN_EVENT = "orbis:open-weekly-ticket";

// Hora atual no fuso do Brasil (0–23).
function brazilHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
}

// ===== Overlay do bilhete (vive no Layout, tela cheia, por cima do menu) =====
// Abre sozinho no 1º dia (uma vez, até aceitar). Depois só reabre pelo ícone.
export function WeeklyChallengeTicket() {
  const navigate = useNavigate();
  const challenge = getActiveWeeklyChallenge();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!challenge) return;
    const seenKey = `orbis_wc_seen_${challenge.id}`;
    // Abre sozinho só no 1º dia, A PARTIR DAS 5H (fuso BR), uma vez (até aceitar).
    if (isFirstDay(challenge) && brazilHour() >= 5 && localStorage.getItem(seenKey) !== "1") {
      setOpen(true);
    }
  }, [challenge?.id]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!challenge || !open) return null;

  // Aceitar: marca visto, fecha o bilhete e começa o fluxo guiado → ranking.
  const aceitar = () => {
    localStorage.setItem(`orbis_wc_seen_${challenge.id}`, "1");
    sessionStorage.setItem("orbis_desafio_passo", "ranking");
    setOpen(false);
    navigate("/ranking");
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#030303", overflowY: "auto" }}>
      <GoldenTicket
        introTag={challenge.introTag}
        introTitulo={challenge.introTitulo}
        introSub={challenge.introSub}
        eventoLabel={challenge.eventoLabel}
        ticketTitulo={challenge.ticketTitulo}
        grandPrizeValue={challenge.grandPrizeValue}
        grandPrizeDesc={challenge.grandPrizeDesc}
        miniPrizes={challenge.miniPrizes}
        commissionTitle={challenge.regrasTitulo}
        commissionTiers={challenge.regras.map((r) => ({ nome: r.nome, val: r.val }))}
        commissionNote={challenge.regrasNota}
        acceptLabel={challenge.acceptLabel}
        onAccept={aceitar}
      />
    </div>
  );
}

// ===== Ícone dourado fixo (abaixo do DEFCON) — reabre o bilhete a semana toda ===
export function WeeklyChallengeIcon() {
  const challenge = getActiveWeeklyChallenge();
  if (!challenge) return null;
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="w-full flex items-center gap-3 rounded-xl px-4 py-3 active:scale-[0.98] transition-transform text-left"
      style={{
        background: "linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.05))",
        border: "1px solid rgba(201,168,76,0.45)",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>🎟️</span>
      <div className="flex-1 min-w-0">
        <div style={{ color: "#F5D78E", fontWeight: 700, fontSize: 14 }}>
          Desafio da Semana · {challenge.grandPrizeValue}
        </div>
        <div style={{ color: "#9a9a9a", fontSize: 12, marginTop: 1 }}>Toca pra abrir o bilhete</div>
      </div>
      <span style={{ color: "#C9A84C", fontSize: 18 }}>→</span>
    </button>
  );
}

// ===== Lembrete no fim do DEFCON — manda o extrato pra contar no ranking =====
export function WeeklyChallengeExtratoNudge() {
  const navigate = useNavigate();
  const challenge = getActiveWeeklyChallenge();
  if (!challenge) return null;
  return (
    <button
      onClick={() => navigate("/meu-extrato")}
      className="w-full flex items-center gap-3 rounded-2xl px-4 py-3.5 active:scale-[0.98] transition-transform text-left"
      style={{
        background: "linear-gradient(135deg, rgba(201,168,76,0.18), rgba(201,168,76,0.05))",
        border: "1px solid rgba(201,168,76,0.45)",
      }}
    >
      <span style={{ fontSize: 24, lineHeight: 1 }}>🎟️</span>
      <div className="flex-1 min-w-0">
        <div style={{ color: "#F5D78E", fontWeight: 700, fontSize: 13 }}>
          Desafio da Semana · {challenge.grandPrizeValue}
        </div>
        <div style={{ color: "#bdbdbd", fontSize: 12, marginTop: 2 }}>
          Pra esse resultado contar no ranking, manda teu extrato até as 9h.
        </div>
      </div>
      <span style={{ color: "#C9A84C", fontSize: 18 }}>→</span>
    </button>
  );
}
