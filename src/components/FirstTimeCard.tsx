/* ============================================================
   FIRST TIME CARD — o "direcionamento inicial" (pedido do Rick).
   Na PRIMEIRA vez que o usuário abre cada tela, sobe um cartão
   explicando SÓ O PRINCIPAL daquela função. Aparece UMA vez por
   tela, por usuário, e nunca mais. Substitui o ScreenCoach antigo
   pras contas novas, com a roupa do design system Orbis 2.0.

   Uso (uma linha no fim de cada tela):
     <FirstTimeCard tela="dashboard" userId={user?.id} />

   Regras:
   - Máximo 3 linhas de explicação — quem quiser mais, viva o app.
   - 1 CTA só ("Entendi") — sem tour, sem setinha, sem 7 passos.
   - Memória: localStorage por usuário+tela (barato e suficiente:
     se trocar de celular e ver de novo uma vez, não machuca).
   - Entra deslizando de baixo (250ms, curva do Orbis); com
     "reduzir movimento" ligado, aparece parado.
   - Novas telas: é só adicionar uma entrada em TELAS_INTRO.
   ============================================================ */
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Home, Zap, Trophy, Wallet, BarChart3, Package } from "lucide-react";
import { useReducedMotion } from "@/shared/motion";
import { novidadesPendentes } from "@/components/NovidadesOrbis2";

export type TelaIntro = "dashboard" | "foco" | "defcon" | "ranking" | "financas" | "relatorio" | "catalogo";

interface IntroConteudo {
  icone: ReactNode;
  titulo: string;
  frase: string;          // 1 frase de abertura, direta
  pontos: [string, string] | [string, string, string]; // 2–3 bullets, SÓ o principal
}

const TELAS_INTRO: Record<TelaIntro, IntroConteudo> = {
  dashboard: {
    icone: <Home size={22} strokeWidth={2.4} />,
    titulo: "Esse é o seu negócio",
    frase: "Aqui você vê o mês inteiro de uma olhada só.",
    pontos: [
      "O anel mostra quanto da meta do mês você já bateu.",
      "Lucro em verde é o que sobra pra você. Custos em vermelho.",
      "O botão dourado abre o Modo Foco — seu dia começa lá.",
    ],
  },
  foco: {
    icone: <Zap size={22} strokeWidth={2.4} />,
    titulo: "Modo Foco: o placar do seu dia",
    frase: "Uma meta pro dia, e cada venda que você registra enche o placar.",
    pontos: [
      "Registrar venda leva 10 segundos — é só o valor.",
      "Bateu a meta do dia? O app comemora com você.",
      "Sem sinal? Continua registrando — sobe sozinho quando a internet voltar.",
    ],
  },
  defcon: {
    icone: <Zap size={22} strokeWidth={2.4} />,
    titulo: "DEFCON 4 começou",
    frase: "Uma hora de cada vez. Cada venda enche o bloco e o placar do dia.",
    pontos: [
      "Venda: toca no valor → confirma. Abordagem: um toque.",
      "Caiu o sinal? Pode continuar — as vendas ficam no celular e sobem sozinhas depois.",
      "Fechou o dia? Encerra o DEFCON e vê seu resumo.",
    ],
  },
  ranking: {
    icone: <Trophy size={22} strokeWidth={2.4} />,
    titulo: "Sua patente no jogo",
    frase: "Cada venda registrada vira ponto — e ponto vira patente.",
    pontos: [
      "Você sobe de patente vendendo e mantendo constância.",
      "O card do ranking pisca quando você sobe — fica de olho.",
    ],
  },
  financas: {
    icone: <Wallet size={22} strokeWidth={2.4} />,
    titulo: "Onde o dinheiro fala a verdade",
    frase: "Vender muito não é lucrar muito — aqui você vê a diferença.",
    pontos: [
      "Registra seus custos (mercadoria, transporte, comida).",
      "O app mostra quanto REALMENTE sobra no seu bolso.",
    ],
  },
  relatorio: {
    icone: <BarChart3 size={22} strokeWidth={2.4} />,
    titulo: "Seu histórico de guerra",
    frase: "Tudo que você vendeu, dia a dia, semana a semana.",
    pontos: [
      "Toque em qualquer dia pra ver como ele foi.",
      "Dá pra registrar calote e o dinheiro que caiu depois.",
      "O botão de compartilhar gera uma arte pro seu Instagram.",
    ],
  },
  catalogo: {
    icone: <Package size={22} strokeWidth={2.4} />,
    titulo: "Seus produtos",
    frase: "Cadastra o que você vende com preço de custo e de venda.",
    pontos: [
      "Com os produtos cadastrados, o lucro sai sozinho.",
      "Você descobre qual produto te dá mais dinheiro.",
    ],
  },
};

const chave = (userId: string, tela: string) => `orbis_intro_vista_${userId}_${tela}`;

export function introJaVista(userId: string | undefined, tela: TelaIntro): boolean {
  if (!userId) return true; // sem usuário identificado, não mostra nada
  try { return localStorage.getItem(chave(userId, tela)) === "1"; } catch { return true; }
}

export default function FirstTimeCard({ tela, userId }: { tela: TelaIntro; userId?: string }) {
  const reduced = useReducedMotion();
  const [aberto, setAberto] = useState(false);
  const [entrando, setEntrando] = useState(false);

  useEffect(() => {
    if (!userId || introJaVista(userId, tela)) return;
    // FILA DE UM SÓ: este cartão NUNCA sobe em cima de outro diálogo
    // (Novidades 2.0, modal Editar Planejamento do Radix, Placar Offline…).
    // O Radix põe pointer-events:none no <body> enquanto está aberto — foi o
    // bug do "Entendi" que não clicava. Então a gente espera a vez: sonda a
    // cada 400ms e só abre quando a tela está limpa.
    let aberto = false;
    const livre = () => {
      if (document.querySelector('[role="dialog"]')) return false;      // qualquer outro diálogo no ar
      if (document.body.style.pointerEvents === "none") return false;  // Radix ainda segurando o body
      try {
        if (localStorage.getItem(`orbis_abrir_planejamento_${userId}`) === "1") return false; // planejamento vai abrir
        if (novidadesPendentes(userId)) return false;                   // novidades ainda vão aparecer
      } catch { /* nada */ }
      return true;
    };
    let ok = 0; // precisa achar a tela livre 2 vezes seguidas (~meio segundo de respiro)
    const id = window.setInterval(() => {
      if (aberto) return;
      ok = livre() ? ok + 1 : 0;
      if (ok < 2) return;
      aberto = true;
      window.clearInterval(id);
      setAberto(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setEntrando(true)));
    }, 400);
    return () => window.clearInterval(id);
  }, [userId, tela]);

  if (!aberto || !userId) return null;
  const c = TELAS_INTRO[tela];
  if (!c) return null;

  const fechar = () => {
    try { localStorage.setItem(chave(userId, tela), "1"); } catch { /* nada */ }
    if (reduced) { setAberto(false); return; }
    setEntrando(false);
    window.setTimeout(() => setAberto(false), 250);
  };

  const mostrando = reduced || entrando;

  // PORTAL no <body>: overlay "fixed" dentro de uma página com transform fica
  // preso à página (foi o bug do card no fundo da tela). No body ele é livre.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ pointerEvents: "auto" }} // cinto de segurança: clicável mesmo se algo travar o <body>
      role="dialog" aria-modal="true" aria-label={c.titulo}>
      {/* véu escuro — fecha no toque (não prendemos ninguém) */}
      <button type="button" aria-label="Fechar" onClick={fechar}
        className="absolute inset-0"
        style={{
          background: "rgba(0,0,0,.78)",
          opacity: mostrando ? 1 : 0,
          transition: reduced ? undefined : "opacity 250ms cubic-bezier(0.2,0,0,1)",
        }} />

      {/* o cartão: NO CENTRO do campo de visão (pedido do Rick — nada de
          informação escondida no rodapé), com uma subida curta de entrada */}
      <div className="relative w-full max-w-md mx-4 rounded-[22px] border p-5 text-left"
        style={{
          background: "linear-gradient(160deg,#17130A 0%,var(--orbis-surface, #111) 55%)",
          borderColor: "rgba(245,184,0,.30)",
          boxShadow: "0 24px 70px -24px rgba(245,184,0,.4)",
          transform: mostrando ? "translateY(0)" : "translateY(28px)",
          opacity: mostrando ? 1 : 0,
          transition: reduced ? undefined : "transform 250ms cubic-bezier(0.2,0,0,1), opacity 250ms cubic-bezier(0.2,0,0,1)",
        }}>
        <div className="flex items-center gap-3">
          <span className="flex-none w-11 h-11 rounded-[14px] flex items-center justify-center"
            style={{
              background: "linear-gradient(180deg,var(--orbis-gold-light,#FFC63A),var(--orbis-gold,#F5B800))",
              color: "#1A1200", boxShadow: "0 3px 0 var(--orbis-gold-deep,#B88700)",
            }}>
            {c.icone}
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em]" style={{ color: "var(--orbis-gold,#F5B800)" }}>
              Primeira vez aqui
            </p>
            <h2 className="font-display text-[18px] font-extrabold leading-tight">{c.titulo}</h2>
          </div>
        </div>

        <p className="text-[13.5px] mt-3 leading-[1.5]" style={{ color: "var(--orbis-fg, #F4F1EA)" }}>{c.frase}</p>

        <div className="mt-3 flex flex-col gap-2">
          {c.pontos.map((p, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="flex-none mt-[7px] w-[5px] h-[5px] rounded-full" style={{ background: "var(--orbis-gold,#F5B800)" }} />
              <p className="text-[13px] leading-[1.45]" style={{ color: "var(--orbis-fg-2,#B9B3A6)" }}>{p}</p>
            </div>
          ))}
        </div>

        <button type="button" onClick={fechar} className="orbis-cta w-full mt-4">
          Entendi
        </button>
      </div>
    </div>,
    document.body,
  );
}
