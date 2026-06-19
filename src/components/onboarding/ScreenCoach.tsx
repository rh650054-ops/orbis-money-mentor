import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Coach por tela (onboarding natural).
 * Quando o usuário entra numa tela principal pela PRIMEIRA vez, mostra um cartão
 * curto explicando aquela tela. Cada tela aparece só uma vez (guardado no
 * localStorage por usuário). Funciona depois da intro da Missão de Boas-Vindas.
 *
 * O fundo escuro bloqueia o toque, então o usuário não troca de aba sem querer
 * enquanto lê a dica — basta tocar em "Entendi" (ou no fundo) pra fechar.
 */
interface ScreenInfo {
  key: string;
  title: string;
  text: string;
}

// Explicação de cada tela. A "/" (dashboard) fica de fora porque já é explicada
// na intro (configuração de metas).
const SCREENS: Record<string, ScreenInfo> = {
  "/daily-goals": {
    key: "foco",
    title: "Foco ⚡",
    text: "Aqui você acompanha seu dia hora a hora e ativa o DEFCON 4 — o modo de guerra pra vender na rua, com blocos de foco, contador de abordagens e análise na hora.",
  },
  "/bank-connections": {
    key: "vender",
    title: "Vender 💰",
    text: "É aqui que você registra o que vendeu no dia — dinheiro, cartão e Pix. O Orbis soma tudo e atualiza sua meta e seu ranking automaticamente.",
  },
  "/insights": {
    key: "relatorio",
    title: "Relatório 📈",
    text: "Seus números num lugar só: faturamento, conversão e evolução ao longo do tempo. Use pra entender o que está funcionando e vender mais.",
  },
  "/ranking": {
    key: "ranking",
    title: "Ranking e patentes 🏅",
    text: "Dispute com outros vendedores. Cada real vendido sobe sua posição e sua patente. Quanto mais você vende, mais alto você chega.",
  },
  "/products": {
    key: "produtos",
    title: "Seus produtos 📦",
    text: "Cadastre o que você vende e a quantidade em estoque. O Orbis usa esses valores pra agilizar o registro das suas vendas.",
  },
  "/profile": {
    key: "perfil",
    title: "Seu perfil 👤",
    text: "Seus dados, sua conta e seus ajustes ficam aqui. Você também pode refazer este tutorial quando quiser.",
  },
};

const PREFIX = "orbis_screen_seen_";

interface Props {
  userId: string;
}

export default function ScreenCoach({ userId }: Props) {
  const location = useLocation();
  const [active, setActive] = useState<ScreenInfo | null>(null);

  useEffect(() => {
    const info = SCREENS[location.pathname];
    if (!info) {
      setActive(null);
      return;
    }
    if (typeof window !== "undefined" && localStorage.getItem(`${PREFIX}${userId}_${info.key}`) === "1") {
      setActive(null);
      return;
    }
    // Espera a tela pintar antes de mostrar a dica (sensação mais natural).
    const t = window.setTimeout(() => setActive(info), 650);
    return () => window.clearTimeout(t);
  }, [location.pathname, userId]);

  if (!active) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`${PREFIX}${userId}_${active.key}`, "1");
    }
    setActive(null);
  };

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={active.title}
    >
      {/* Fundo escuro: bloqueia toques pra não trocar de aba sem querer */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={dismiss} />
      <div
        className="relative w-full max-w-sm bg-card border border-primary/30 rounded-2xl p-5 shadow-2xl animate-fade-in"
        style={{ marginBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <h3 className="text-lg font-bold text-foreground mb-1.5">{active.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{active.text}</p>
        <button
          onClick={dismiss}
          className="w-full py-2.5 rounded-xl font-semibold text-sm text-primary-foreground bg-gradient-to-r from-primary to-secondary active:scale-[0.97] transition-transform"
        >
          Entendi 👍
        </button>
      </div>
    </div>
  );
}
