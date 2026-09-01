/* ============================================================
   NOVIDADES ORBIS 2.0 — o "relatório de lançamento".
   Aparece UMA vez por usuário, a partir de 01/09/2026, na primeira
   abertura do app: o que mudou hoje + o que vem em setembro.
   Card central (campo de visão), rolável, no design system.
   ============================================================ */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Check, Clock } from "lucide-react";
import { useReducedMotion } from "@/shared/motion";

const VERSAO = "2.0";               // muda isso → todo mundo vê de novo
const A_PARTIR_DE = "2026-09-01";   // dia do lançamento (Brasil)

const FEITO = [
  ["Visual novo", "Preto absoluto, dourado nas ações e movimento em todas as telas."],
  ["Dashboard", "Faturamento do mês com anel, sua diária ao lado, Hoje → Modo Foco, lucro verde e custos vermelho."],
  ["Relatório", "Herói dourado, \"Caiu no bolso\", gráfico dia a dia clicável, compartilhar resultado pro Instagram."],
  ["Calote e recebimento", "Registre o calote do dia e o dinheiro que caiu depois (dinheiro, pix ou cartão)."],
  ["Onboarding", "Quem chega agora monta o plano em 40 segundos e já sai com a meta do dia."],
  ["Cards de primeira vez", "Cada tela explica só o principal na primeira abertura — e nunca mais incomoda."],
  ["Hora combinada", "Marque que horas começa a vender; o Orbis te dá um toque se o dia começar sem você."],
  ["DEFCON 4 offline", "Sem sinal? Continua registrando — e sem internet nenhuma, um botão abre o DEFCON 4 offline — a mesma tela, tudo salvo no celular. Sobe sozinho quando o sinal volta."],
  ["Dias de folga", "Marque no planejamento os dias que você trabalha: folga não quebra sua constância."],
];

const VEM_AI = [
  ["Modo Foco 2.0", "Placar do dia na identidade nova, venda em 2 toques, fim do dia com cerimônia."],
  ["Pontes entre as telas", "Fechou o dia → veja onde ficou no ranking. Calote → o mentor te ajuda a cobrar."],
  ["Recap da semana", "Toda segunda, sua semana em arte pra postar."],
  ["Competição", "As guerras de vendas estão chegando."],
];

const chave = (uid: string) => `orbis_novidades_${VERSAO}_vista_${uid}`;

/** true = o card de novidades AINDA vai aparecer pra este usuário (os outros
 *  overlays — FirstTimeCard etc. — usam isso pra esperar a vez). */
export function novidadesPendentes(uid: string | undefined): boolean {
  if (!uid) return false;
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (hoje < A_PARTIR_DE) return false;
  try { return localStorage.getItem(chave(uid)) !== "1"; } catch { return false; }
}

export default function NovidadesOrbis2({ userId }: { userId?: string }) {
  const reduced = useReducedMotion();
  const [aberto, setAberto] = useState(false);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (!userId || !novidadesPendentes(userId)) return;
    const t = window.setTimeout(() => {
      setAberto(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setEntrando(true)));
    }, 900);
    return () => window.clearTimeout(t);
  }, [userId]);

  if (!aberto || !userId) return null;
  const mostrando = reduced || entrando;
  const fechar = () => {
    try {
      localStorage.setItem(chave(userId), "1");
      // Dia 1: depois das novidades, o dashboard abre o planejamento (metas + dias de folga)
      localStorage.setItem(`orbis_abrir_planejamento_${userId}`, "1");
    } catch { /* nada */ }
    if (reduced) { setAberto(false); return; }
    setEntrando(false);
    window.setTimeout(() => setAberto(false), 250);
  };

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Novidades do Orbis 2.0">
      <button type="button" aria-label="Fechar" onClick={fechar} className="absolute inset-0"
        style={{ background: "rgba(0,0,0,.82)", opacity: mostrando ? 1 : 0, transition: reduced ? undefined : "opacity 250ms cubic-bezier(0.2,0,0,1)" }} />
      <div className="relative w-full max-w-md mx-4 rounded-[22px] border flex flex-col"
        style={{
          maxHeight: "86dvh",
          background: "linear-gradient(160deg,#17130A 0%,#111 55%)",
          borderColor: "rgba(245,184,0,.30)",
          boxShadow: "0 24px 70px -24px rgba(245,184,0,.45)",
          transform: mostrando ? "translateY(0)" : "translateY(28px)",
          opacity: mostrando ? 1 : 0,
          transition: reduced ? undefined : "transform 250ms cubic-bezier(0.2,0,0,1), opacity 250ms cubic-bezier(0.2,0,0,1)",
        }}>
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <span className="flex-none w-11 h-11 rounded-[14px] flex items-center justify-center"
            style={{ background: "linear-gradient(180deg,#FFC63A,#F5B800)", color: "#1A1200", boxShadow: "0 3px 0 #B88700" }}>
            <Sparkles size={22} strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em]" style={{ color: "#F5B800" }}>Setembro · versão 2.0</p>
            <h2 className="font-display text-[19px] font-extrabold leading-tight">O Orbis mudou de pele</h2>
          </div>
        </div>

        <div className="px-5 overflow-y-auto min-h-0 flex-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          <p className="text-[13px] leading-[1.5]" style={{ color: "#F4F1EA" }}>
            Um mês de trabalho virou app hoje. Tudo que mudou — e o que vem antes do fim do mês.
          </p>

          <p className="orbis-section mt-4 mb-2">O que já está no ar</p>
          <div className="flex flex-col gap-2">
            {FEITO.map(([t, d]) => (
              <div key={t} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)" }}>
                <span className="flex-none w-5 h-5 rounded-full flex items-center justify-center mt-px" style={{ background: "rgba(61,214,140,.15)", color: "#3DD68C" }}><Check size={12} strokeWidth={3} /></span>
                <p className="text-[12.5px] leading-[1.45]"><b style={{ color: "#F4F1EA" }}>{t}.</b> <span style={{ color: "#B9B3A6" }}>{d}</span></p>
              </div>
            ))}
          </div>

          <p className="orbis-section mt-4 mb-2">O que vem em setembro</p>
          <div className="flex flex-col gap-2 pb-2">
            {VEM_AI.map(([t, d]) => (
              <div key={t} className="flex items-start gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "rgba(245,184,0,.06)", border: "1px solid rgba(245,184,0,.18)" }}>
                <span className="flex-none w-5 h-5 rounded-full flex items-center justify-center mt-px" style={{ background: "rgba(245,184,0,.15)", color: "#F5B800" }}><Clock size={12} strokeWidth={2.6} /></span>
                <p className="text-[12.5px] leading-[1.45]"><b style={{ color: "#F4F1EA" }}>{t}.</b> <span style={{ color: "#B9B3A6" }}>{d}</span></p>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pt-3 pb-5">
          <button type="button" onClick={fechar} className="orbis-cta w-full">BORA VER</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
