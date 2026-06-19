import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/utils";

/**
 * Tour guiado por tela (onboarding natural).
 *
 * Quando um usuário NOVO entra numa tela principal pela primeira vez, roda um
 * mini-tour de 1-3 passos explicando aquela tela. Quando o passo aponta pra um
 * elemento real (selector), ele é destacado com um "furo" de luz — guiando onde
 * a pessoa toca. O fundo escuro bloqueia o toque, então ninguém troca de aba
 * sem querer durante a explicação.
 *
 * - "Pular esta tela": fecha o tour só desta tela.
 * - "Pular tutorial": desliga TODOS os tours de tela de uma vez.
 * - Só aparece pra contas novas (flag orbis_screen_tours_enabled, ligada quando
 *   a intro de boas-vindas é concluída). Quem já usava o app não é incomodado.
 * - Cada tela aparece só uma vez (guardado por usuário no localStorage).
 */
interface TourStep {
  /** Elemento real a destacar. Ausente = cartão central explicativo. */
  selector?: string;
  title: string;
  text: string;
}
interface ScreenDef {
  key: string;
  steps: TourStep[];
}

// Conteúdo de cada tela. A "/" (dashboard) fica de fora: já é explicada na intro.
const SCREENS: Record<string, ScreenDef> = {
  "/daily-goals": {
    key: "foco",
    steps: [
      {
        selector: '[data-tour="defcon-banner"]',
        title: "DEFCON 4 — modo de guerra ⚡",
        text: "Toque aqui pra entrar. Inicie só na hora que for vender de verdade — ele cronometra seu corre em blocos de 1 hora.",
      },
      {
        title: "Tudo na mão pra vender",
        text: "Dentro do DEFCON você registra cada venda, conta suas abordagens e ainda manda mensagem no WhatsApp pra fechar mais. O Orbis analisa em tempo real.",
      },
      {
        title: "O que você leva pra rua 📦",
        text: "Você escolhe os produtos que está levando e, conforme vende, eles vão sendo descontados do seu estoque automaticamente.",
      },
    ],
  },
  "/products": {
    key: "produtos",
    steps: [
      {
        selector: '[data-tour="add-product"]',
        title: "Cadastre o que você vende 📦",
        text: "Toque em 'Novo produto'. Coloque o nome, o preço e quantos você tem em estoque (e o estoque mínimo).",
      },
      {
        title: "Estoque que te avisa 🔔",
        text: "O Orbis avisa quando a mercadoria ou os insumos estão acabando, do jeito que você configurou. E cada venda vai descontando do estoque sozinha.",
      },
    ],
  },
  "/transactions": {
    key: "registrar-venda",
    steps: [
      {
        selector: '[data-tour="registrar-venda"]',
        title: "Registre sua venda 💰",
        text: "É aqui que você lança o que vendeu: dinheiro, cartão e Pix. O valor entra na hora na sua meta e no seu ranking.",
      },
    ],
  },
  "/bank-connections": {
    key: "vender",
    steps: [
      {
        title: "Vender no automático 🏦",
        text: "Conecte seu banco (Open Finance, seguro e regulado). O Orbis detecta suas vendas sozinho — você só confirma o que é venda.",
      },
    ],
  },
  "/finances": {
    key: "financeiro",
    steps: [
      {
        title: "Financeiro 💵",
        text: "Acompanhe seu lucro do dia e do mês, suas despesas por categoria e suas metas de reserva.",
      },
      {
        title: "Metas e divisão por % 📊",
        text: "Defina sua meta mensal e o Orbis te ajuda a dividir o que entra por porcentagem — quanto guardar, quanto reinvestir. A conta é feita pra você.",
      },
    ],
  },
  "/insights": {
    key: "relatorio",
    steps: [
      {
        title: "Seu relatório 📈",
        text: "Aqui ficam seus números: faturamento, ticket médio, conversão e suas melhores horas. Escolha o período lá no topo.",
      },
      {
        title: "Orbis IA 🤖",
        text: "A IA lê seus dados e te dá dicas práticas pra vender mais. Toque em 'Conversar com a IA' pra tirar dúvidas sobre o seu corre.",
      },
    ],
  },
  "/ranking": {
    key: "ranking",
    steps: [
      {
        title: "Ranking e patentes 🏅",
        text: "Dispute com outros vendedores por faturamento e por constância. Cada real vendido sobe sua posição e sua patente.",
      },
      {
        title: "Compartilhe no Instagram 📲",
        text: "Mostre seu resultado: toque em 'Compartilhar no Instagram' e poste seu corre. Ótimo pra marcar presença e atrair clientes.",
      },
    ],
  },
  "/profile": {
    key: "perfil",
    steps: [
      {
        title: "Seu perfil 👤",
        text: "Seus dados, ajustes e tema claro/escuro ficam aqui. Tem também o atalho pra Comunidade — onde você troca ideia com outros vendedores — e o botão pra refazer os tutoriais quando quiser.",
      },
    ],
  },
};

const SEEN_PREFIX = "orbis_screen_seen_";
const ENABLED_KEY = "orbis_screen_tours_enabled"; // ligado só pra contas novas
const OFF_KEY = "orbis_screen_tours_off"; // "pular tutorial" desliga tudo
const PAD = 8;

interface Props {
  userId: string;
}

export default function ScreenCoach({ userId }: Props) {
  const location = useLocation();
  const [def, setDef] = useState<ScreenDef | null>(null);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [entering, setEntering] = useState(true);

  // Decide se mostra o tour ao entrar na tela.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(ENABLED_KEY) !== "1") return; // só contas novas
    if (localStorage.getItem(OFF_KEY) === "1") return; // pulou tudo
    const d = SCREENS[location.pathname];
    if (!d) {
      setDef(null);
      return;
    }
    if (localStorage.getItem(`${SEEN_PREFIX}${userId}_${d.key}`) === "1") {
      setDef(null);
      return;
    }
    // Espera a tela pintar antes de abrir (sensação natural).
    const t = window.setTimeout(() => {
      setStep(0);
      setDef(d);
    }, 650);
    return () => window.clearTimeout(t);
  }, [location.pathname, userId]);

  const current = def?.steps[step] ?? null;

  // Mede o alvo destacado (com scroll suave até ele).
  const measure = useCallback(() => {
    if (!current?.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(current.selector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setRect(el.getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [current]);

  useEffect(() => {
    if (!def) return;
    const t1 = window.setTimeout(measure, 220);
    const t2 = window.setTimeout(measure, 720);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [measure, def, step]);

  // Animação de entrada do balão a cada passo.
  useEffect(() => {
    setEntering(false);
    const t = window.setTimeout(() => setEntering(true), 120);
    return () => window.clearTimeout(t);
  }, [step, def]);

  const markSeen = useCallback(() => {
    if (def && typeof window !== "undefined") {
      localStorage.setItem(`${SEEN_PREFIX}${userId}_${def.key}`, "1");
    }
  }, [def, userId]);

  if (!def || !current) return null;

  const handleNext = () => {
    if (step < def.steps.length - 1) {
      setStep(step + 1);
    } else {
      markSeen();
      setDef(null);
    }
  };
  const skipScreen = () => {
    markSeen();
    setDef(null);
  };
  const skipAll = () => {
    if (typeof window !== "undefined") localStorage.setItem(OFF_KEY, "1");
    markSeen();
    setDef(null);
  };

  const total = def.steps.length;
  const isLast = step === total - 1;
  const hole = rect
    ? {
        top: Math.max(rect.top - PAD, 0),
        left: Math.max(rect.left - PAD, 0),
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
      }
    : null;
  const tooltipBelow = rect ? rect.bottom + 240 < window.innerHeight : true;

  return (
    <div className="fixed inset-0 z-[9990]" role="dialog" aria-modal="true" aria-label={current.title}>
      {/* Overlay escuro com furo no alvo — bloqueia TODO toque (não troca de aba) */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="screencoach-mask">
            <rect width="100%" height="100%" fill="white" />
            {hole && (
              <rect x={hole.left} y={hole.top} width={hole.width} height={hole.height} rx={12} fill="black" />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.78)"
          mask="url(#screencoach-mask)"
          style={{ pointerEvents: "all" }}
          onClick={(e) => e.stopPropagation()}
        />
      </svg>

      {/* Anel pulsante no alvo */}
      {hole && (
        <div
          className="absolute rounded-xl border-2 border-primary pointer-events-none animate-pulse"
          style={{
            top: hole.top,
            left: hole.left,
            width: hole.width,
            height: hole.height,
            boxShadow: "0 0 0 4px hsl(var(--primary) / 0.18), 0 0 24px hsl(var(--primary) / 0.35)",
          }}
        />
      )}

      {/* Botão PULAR TUTORIAL (desliga tudo) — destaque no rodapé */}
      <button
        onClick={skipAll}
        className="group fixed left-1/2 -translate-x-1/2 z-[10002] pointer-events-auto flex items-center gap-2 text-sm font-extrabold tracking-wide text-foreground active:scale-95 transition-all px-7 py-3.5 rounded-full border border-primary/50 bg-card/95 backdrop-blur-xl shadow-[0_16px_44px_-12px_hsl(var(--primary)/0.55)] hover:border-primary"
        style={{
          bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
          backgroundImage: "linear-gradient(180deg, hsl(var(--primary) / 0.18), hsl(var(--primary) / 0.04))",
        }}
      >
        Pular tutorial
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary group-hover:translate-x-0.5 transition-transform">
          <polyline points="13 17 18 12 13 7" />
          <polyline points="6 17 11 12 6 7" />
        </svg>
      </button>

      {/* Balão do coachmark */}
      <div
        className={cn(
          "fixed left-4 right-4 z-[10000] pointer-events-auto max-w-sm mx-auto transition-all duration-300 ease-out",
          entering ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
        )}
        style={
          rect
            ? {
                top: tooltipBelow ? Math.min(rect.bottom + 20, window.innerHeight - 240) : undefined,
                bottom: !tooltipBelow ? window.innerHeight - rect.top + 20 : undefined,
              }
            : { top: "50%", transform: "translateY(-50%)" }
        }
      >
        <div className="bg-card border border-primary/30 rounded-2xl p-5 shadow-2xl">
          {total > 1 && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary/80 mb-1">
              Passo {step + 1} de {total}
            </p>
          )}
          <h3 className="text-base font-bold text-foreground mb-1.5">{current.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">{current.text}</p>
          <button
            onClick={handleNext}
            className="w-full py-2.5 rounded-xl font-semibold text-sm text-primary-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform"
          >
            {isLast ? "Entendi 👍" : "Próximo →"}
          </button>
          <button
            onClick={skipScreen}
            className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular esta tela
          </button>
        </div>
      </div>
    </div>
  );
}
