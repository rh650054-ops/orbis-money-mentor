import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/shared/lib/utils";

/**
 * Tour guiado por tela (onboarding natural).
 *
 * Como funciona:
 *  - 1º passo de cada tela: cartão central explicando a tela.
 *  - Passos com alvo (selector): NÃO movem a tela sozinhos. Mostram uma dica
 *    "role para baixo" e, quando o usuário chega no botão (ele entra na tela),
 *    a notificação aparece com o anel destacando exatamente onde tocar.
 *  - Cada cartão tem "Pular esta tela".
 *  - Só aparece pra contas novas (flag) ou admin (revisão). Uma vez por tela.
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

// A "/" (dashboard) fica de fora: já é explicada na intro de boas-vindas.
const SCREENS: Record<string, ScreenDef> = {
  "/daily-goals": {
    key: "foco",
    steps: [
      {
        selector: '[data-tour="defcon-banner"]',
        title: "DEFCON 4 — modo de guerra ⚡",
        text: "Esse é o modo foco pra vender na rua. Toque pra entrar — mas inicie só na hora que for realmente vender. Ele cronometra seu corre em blocos de 1 hora.",
      },
      {
        selector: '[data-tour="loadout-add"]',
        title: "Mercadoria de hoje 📦 (importante!)",
        text: "Toque em 'Adicionar produto' e coloque aqui o que você vai levar pra vender hoje. Cada venda que você registrar desconta DIRETO do seu estoque em Produtos & Estoque — você não precisa baixar nada na mão.",
      },
      {
        title: "Dentro do DEFCON você tem tudo",
        text: "Ao iniciar, aparecem os botões de registrar venda, contar abordagem e mandar mensagem no WhatsApp. E ao terminar cada hora, dá pra gerar uma imagem das suas vendas pra postar no Instagram.",
      },
    ],
  },
  "/defcon": {
    key: "defcon-iniciar",
    steps: [
      {
        selector: '[data-tour="defcon-iniciar"]',
        title: "Pronto pra começar? ⚡",
        text: "Antes de iniciar, dá pra ativar o modo economia de bateria. Quando estiver na hora de vender, toque em INICIAR — aí abrem os botões de registrar venda, contar abordagem e adicionar o nome do cliente.",
      },
    ],
  },
  "/products": {
    key: "produtos",
    steps: [
      {
        selector: '[data-tour="add-product"]',
        title: "Cadastre seu produto 📦",
        text: "Toque em 'Novo produto'. Dê um nome, o preço de venda e o custo. É com isso que você registra suas vendas rapidinho depois.",
      },
      {
        title: "Por unidade ou por lote? (exemplo na prática)",
        text: "Na hora de cadastrar você escolhe como conta o estoque. Exemplo: você vende brigadeiro. POR UNIDADE → cada brigadeiro vendido tira 1 do estoque. POR LOTE → você cadastra uma fôrma que rende 50, e o estoque baixa conforme o lote vai acabando. Escolha o que combina com o seu produto.",
      },
      {
        title: "Mercadoria e alertas 🔔",
        text: "Na aba 'Estoque' você acompanha tudo o que tem. O Orbis te avisa quando a mercadoria ou os insumos estão acabando, conforme o estoque mínimo que você definiu — assim você nunca fica na mão no meio da venda.",
      },
    ],
  },
  "/transactions": {
    key: "registrar-venda",
    steps: [
      {
        selector: '[data-tour="registrar-venda"]',
        title: "Registre sua venda 💰",
        text: "Aqui você lança o que vendeu: dinheiro, cartão e Pix. Entra na hora na sua meta do dia e no seu ranking.",
      },
    ],
  },
  "/bank-connections": {
    key: "vender",
    steps: [
      {
        selector: '[data-tour="conectar-banco"]',
        title: "Vender no automático 🏦",
        text: "Toque em 'Conectar Banco' (Open Finance, seguro e regulado). O Orbis detecta suas vendas sozinho — você só confirma o que é venda.",
      },
    ],
  },
  "/finances": {
    key: "financeiro",
    steps: [
      {
        title: "Financeiro 💵",
        text: "Acompanhe seu lucro do dia e do mês. Defina sua meta mensal e o Orbis divide o que entra por porcentagem — quanto guardar, quanto reinvestir.",
      },
      {
        selector: '[data-tour="nova-despesa"]',
        title: "Registre suas despesas 📊",
        text: "Toque em 'Nova Despesa' pra lançar seus gastos por categoria e enxergar exatamente pra onde está indo o seu dinheiro.",
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
        selector: '[data-tour="conversar-ia"]',
        title: "Orbis IA 🤖",
        text: "A IA lê seus dados e te dá dicas pra vender mais. Toque em 'Conversar com a IA' — você pode ESCREVER um texto ou mandar um ÁUDIO, como preferir. Ela responde do seu jeito.",
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
        selector: '[data-tour="ranking-share"]',
        title: "Compartilhe no Instagram 📲",
        text: "Toque em 'Compartilhar no Instagram': o Orbis gera uma imagem das suas vendas. Você pode baixar e postar nos seus stories, colocar num vídeo ou tirar print — do jeito que quiser mostrar o seu corre.",
      },
    ],
  },
  "/chat": {
    key: "comunidade",
    steps: [
      {
        title: "Comunidade Orbis 👥",
        text: "Aqui você troca ideia com vendedores do Brasil todo. O que você posta aparece pra TODA a comunidade no feed Global — e tem o feed Regional, com gente da sua cidade ou estado.",
      },
      {
        title: "Poste e aprenda junto",
        text: "Compartilhe suas vitórias, tire dúvidas e veja o que está dando certo pra quem vende na rua como você. Quanto mais a comunidade troca, mais todo mundo vende.",
      },
    ],
  },
  "/profile": {
    key: "perfil",
    steps: [
      {
        selector: '[data-tour="profile-comunidade"]',
        title: "Comunidade e ajustes 👤",
        text: "Aqui ficam seus dados e ajustes. Toque em 'Comunidade' pra falar com outros vendedores. E se quiser rever estes tutoriais, é só usar 'Refazer tour de boas-vindas' aqui embaixo.",
      },
    ],
  },
};

const SEEN_PREFIX = "orbis_screen_seen_";
const ENABLED_KEY = "orbis_screen_tours_enabled"; // contas novas
const OFF_KEY = "orbis_screen_tours_off"; // segurança (limpo no "refazer tour")
const PAD = 8;

interface Props {
  userId: string;
  /** Admin sempre vê (pra revisar), além das contas novas. */
  isAdmin?: boolean;
}

export default function ScreenCoach({ userId, isAdmin }: Props) {
  const location = useLocation();
  const [def, setDef] = useState<ScreenDef | null>(null);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [shown, setShown] = useState(false);
  const [entering, setEntering] = useState(false);
  const shownRef = useRef(false);
  const startedAt = useRef(0);

  const reveal = (v: boolean) => {
    shownRef.current = v;
    setShown(v);
  };

  // Decide se mostra o tour ao entrar na tela.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(ENABLED_KEY) !== "1" && !isAdmin) return;
    if (localStorage.getItem(OFF_KEY) === "1") return;
    const d = SCREENS[location.pathname];
    if (!d) {
      setDef(null);
      return;
    }
    if (localStorage.getItem(`${SEEN_PREFIX}${userId}_${d.key}`) === "1") {
      setDef(null);
      return;
    }
    const t = window.setTimeout(() => {
      setStep(0);
      setDef(d);
    }, 650);
    return () => window.clearTimeout(t);
  }, [location.pathname, userId, isAdmin]);

  const current = def?.steps[step] ?? null;

  // Ao entrar num passo: passo central aparece na hora; passo com alvo espera
  // o usuário rolar até o elemento (sem mover a tela sozinho).
  useEffect(() => {
    if (!def) return;
    const s = def.steps[step];
    if (!s) return;
    startedAt.current = Date.now();
    setRect(null);
    reveal(!s.selector);
  }, [def, step]);

  // Mede o alvo e revela quando ele entra na viewport (sem auto-scroll).
  useEffect(() => {
    if (!def) return;
    const s = def.steps[step];
    if (!s?.selector) return;
    const sel = s.selector;
    const inView = (r: DOMRect) =>
      r.width > 0 && r.top < window.innerHeight - 72 && r.bottom > 72;

    const tick = () => {
      const el = document.querySelector(sel);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect(r);
        if (!shownRef.current && inView(r)) reveal(true);
      } else if (!shownRef.current && Date.now() - startedAt.current > 1600) {
        // Elemento não está nesta tela (ex.: aba diferente): cai pro cartão central.
        setRect(null);
        reveal(true);
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    window.addEventListener("scroll", tick, true);
    window.addEventListener("resize", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("scroll", tick, true);
      window.removeEventListener("resize", tick);
    };
  }, [def, step]);

  // Animação de entrada do balão quando revela.
  useEffect(() => {
    if (!shown) return;
    setEntering(false);
    const t = window.setTimeout(() => setEntering(true), 100);
    return () => window.clearTimeout(t);
  }, [step, shown]);

  if (!def || !current) return null;

  const markSeen = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`${SEEN_PREFIX}${userId}_${def.key}`, "1");
    }
  };
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

  const total = def.steps.length;
  const isLast = step === total - 1;
  const hasTarget = !!current.selector;

  // FASE DE ESPERA: passo com alvo ainda não alcançado pelo usuário.
  // Não escurece nem bloqueia (pra ele conseguir rolar e ver a tela).
  if (hasTarget && !shown) {
    return (
      <div className="fixed inset-0 z-[9990] pointer-events-none">
        <div
          className="fixed left-1/2 -translate-x-1/2 z-[10000] pointer-events-auto flex flex-col items-center gap-1 rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-xl px-5 py-3 shadow-[0_16px_44px_-12px_hsl(var(--primary)/0.55)]"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }}
        >
          <span className="text-sm font-bold text-foreground">👇 Role a tela para baixo</span>
          <span className="text-xs text-muted-foreground">vou te mostrar o próximo passo</span>
          <button
            onClick={skipScreen}
            className="mt-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Pular esta tela
          </button>
        </div>
      </div>
    );
  }

  // FASE REVELADA: escurece, destaca o alvo (se houver) e mostra a explicação.
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
      {/* Overlay escuro com furo no alvo — bloqueia o toque (não troca de aba) */}
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

      {/* Balão do coachmark */}
      <div
        className={cn(
          "fixed left-4 right-4 z-[10000] pointer-events-auto max-w-sm mx-auto transition-all duration-300 ease-out",
          entering ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
        )}
        style={
          rect
            ? {
                top: tooltipBelow ? Math.min(rect.bottom + 20, window.innerHeight - 260) : undefined,
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
