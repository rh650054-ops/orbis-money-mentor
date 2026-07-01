import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  const challenge = getActiveWeeklyChallenge();
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const isTeste = typeof window !== "undefined" && window.location.search.includes("bilhete-teste");
  // v2: reseta quem já "viu" durante os testes — assim TODO usuário (inclusive testers)
  // vê o bilhete uma vez no lançamento real.
  const seenKey = challenge ? `orbis_wc_seen2_${challenge.id}` : "";

  useEffect(() => {
    if (!challenge) return;
    // Abre sozinho só no 1º dia, A PARTIR DAS 5H (fuso BR), uma vez.
    // Em modo teste (?bilhete-teste), abre na hora e sempre (pra poder retestar).
    if (isTeste || (isFirstDay(challenge) && brazilHour() >= 5 && localStorage.getItem(seenKey) !== "1")) {
      setOpen(true);
    }
  }, [challenge?.id]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!challenge) return null;

  // Aceitar: marca visto, fecha o bilhete e abre a TELA DE SUCESSO (recrutamento) —
  // nunca joga pro ranking vazio; joga pro link de parceiro + gatilho de ação.
  const aceitar = () => {
    // Em teste não marca como visto, pra não "gastar" o 1º acesso real do usuário.
    if (!isTeste) localStorage.setItem(seenKey, "1");
    setOpen(false);
    setShowSuccess(true);
  };

  const contatoWpp = () => window.open(
    "https://wa.me/5511915054830?text=" + encodeURIComponent("Oi! Quero fazer meu link de afiliado do Orbis pra comecar a lucrar com as assinaturas."),
    "_blank",
  );

  return (
    <>
      {open && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "#030303", overflowY: "auto" }}>
          <GoldenTicket
            introTag={challenge.introTag}
            introTitulo={challenge.introTitulo}
            introSub={challenge.introSub}
            eventoLabel={challenge.eventoLabel}
            ticketTitulo={challenge.ticketTitulo}
            grandPrizeValue={challenge.grandPrizeValue}
            grandPrizeDesc={challenge.grandPrizeDesc}
            grandPrizeBadge={challenge.grandPrizeBadge}
            grandPrizeBadgeTone={challenge.grandPrizeBadgeTone}
            miniPrizes={challenge.miniPrizes}
            commissionTitle={challenge.regrasTitulo}
            commissionTiers={challenge.regras.map((r) => ({ nome: r.nome, val: r.val }))}
            commissionNote={challenge.regrasNota}
            commissionHighlight={challenge.regrasHighlight}
            commissionBadge={challenge.commissionBadge}
            commissionBadgeTone={challenge.commissionBadgeTone}
            whatsappLabel={challenge.whatsappLabel}
            onWhatsapp={contatoWpp}
            acceptLabel={challenge.acceptLabel}
            onAccept={aceitar}
          />
        </div>
      )}

      {showSuccess && (
        <div style={{ position: "fixed", inset: 0, zIndex: 101, background: "rgba(3,3,3,0.96)", display: "flex", alignItems: "center", justifyContent: "center", padding: 18, overflowY: "auto" }}>
          <div style={{ maxWidth: 380, width: "100%", background: "linear-gradient(135deg,#100B03,#1E1608)", border: "1px solid rgba(201,168,76,0.45)", borderRadius: 22, padding: 24, boxShadow: "0 0 60px rgba(201,168,76,0.22)", color: "#fff" }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 27, letterSpacing: 1, textAlign: "center", background: "linear-gradient(135deg,#C9A84C,#F5D78E,#C9A84C)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 12 }}>
              VOCÊ ESTÁ DENTRO DA ELITE 🏆
            </div>
            <p style={{ fontSize: 13, color: "#cfcfcf", lineHeight: 1.6, marginBottom: 12 }}>
              O <b style={{ color: "#fff" }}>Ranking de Vendas</b> pra disputar os R$100 semanais começa oficialmente na <b style={{ color: "#fff" }}>próxima segunda (06/07)</b>.
            </p>
            <p style={{ fontSize: 13, color: "#cfcfcf", lineHeight: 1.6, marginBottom: 16 }}>
              Mas a sua <b style={{ color: "#34D399" }}>Fase de Recrutamento começou AGORA</b>. As <b style={{ color: "#F5D78E" }}>3 primeiras assinaturas</b> que você trouxer esta semana já te garantem <b style={{ color: "#F5D78E" }}>R$50 no Pix</b> — antes mesmo da competição abrir.
            </p>
            <div style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.35)", borderRadius: 12, padding: "12px 14px", fontSize: 12.5, color: "#cfe9dd", lineHeight: 1.5, marginBottom: 12 }}>
              Ainda não tem seu <b style={{ color: "#5df0bd" }}>link de afiliado</b>? Fala com a gente e faça o seu pra começar a lucrar 👇
            </div>
            <button onClick={contatoWpp} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#25D366", color: "#000", fontWeight: 700, fontSize: 14, border: "none", marginBottom: 8, cursor: "pointer" }}>
              📲 Fazer meu link de afiliado
            </button>
            <button onClick={() => setShowSuccess(false)} style={{ width: "100%", padding: 14, borderRadius: 12, background: "linear-gradient(135deg,#C9A84C,#F5D78E)", color: "#000", fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer" }}>
              Monte seu esquadrão →
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ===== Barra "Continuar" do fluxo do desafio =====
// Depois de aceitar o bilhete, o cara cai no /ranking. Aqui aparece o botão pra
// seguir pra meta de julho (e de lá pro DEFCON, fechado no Index).
export function DesafioFluxoBar() {
  const location = useLocation();
  const navigate = useNavigate();
  if (location.pathname !== "/ranking") return null;
  if (sessionStorage.getItem("orbis_desafio_passo") !== "ranking") return null;
  return (
    <div
      style={{
        position: "fixed", left: 0, right: 0, zIndex: 60,
        bottom: "calc(env(safe-area-inset-bottom) + 76px)",
        padding: "0 16px", pointerEvents: "none",
      }}
    >
      <button
        onClick={() => {
          sessionStorage.setItem("orbis_desafio_passo", "meta");
          navigate("/");
        }}
        className="w-full max-w-md mx-auto block py-3.5 rounded-2xl font-bold text-black"
        style={{ background: "linear-gradient(135deg, #C9A84C, #F5D78E)", boxShadow: "0 0 30px rgba(201,168,76,0.45)", pointerEvents: "auto" }}
      >
        Continuar → definir minha meta de julho
      </button>
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
