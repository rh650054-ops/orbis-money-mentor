import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Wallet, Package, Settings as SettingsIcon, MessageCircle, ChevronRight, Target, Radar, Sun, Moon, Landmark } from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent } from "@/shared/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { EditPlanningModal } from "@/components/EditPlanningModal";

interface MenuItem {
  icon: React.ElementType;
  label: string;
  description: string;
  path?: string;
  action?: string;
  color: string;
}

const menuItems: MenuItem[] = [
  {
    icon: User,
    label: "Minha Conta",
    description: "Dados pessoais e assinatura",
    path: "/my-account",
    color: "text-primary",
  },
  {
    icon: Target,
    label: "Editar Planejamento",
    description: "Meta do mês, horas e dias por semana",
    action: "edit-planning",
    color: "text-primary",
  },
  {
    icon: Radar,
    label: "Caça-Sinal",
    description: "Melhores sinais e avenidas pra vender (IA + Maps)",
    path: "/spot-finder",
    color: "text-primary",
  },
  {
    icon: Wallet,
    label: "Financeiro",
    description: "Metas, contas e transações",
    path: "/finances",
    color: "text-primary",
  },
  {
    icon: Landmark,
    label: "Tributário",
    description: "Imposto do MEI: DAS, limite anual e declaração",
    path: "/tributario",
    color: "text-primary",
  },
  {
    icon: Package,
    label: "Produtos / Estoque",
    description: "Gerenciar seus produtos",
    path: "/products",
    color: "text-success",
  },
  {
    icon: SettingsIcon,
    label: "Configurações",
    description: "Preferências do app",
    path: "/settings",
    color: "text-warning",
  },
  {
    icon: MessageCircle,
    label: "Comunidade",
    description: "Chat global e regional",
    path: "/chat",
    color: "text-primary",
  },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [planningOpen, setPlanningOpen] = useState(false);
  const isLight = theme === "light";

  const handleItemClick = (item: MenuItem) => {
    if (item.action === "edit-planning") {
      setPlanningOpen(true);
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div className="space-y-6 pb-4 md:pb-8 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Perfil</h1>
          <p className="text-muted-foreground mt-1">Acesse e gerencie sua conta</p>
        </div>
        {/* tema: um toque troca (era um bloco "Aparência" inteiro — Rick, 27/10) */}
        <button type="button" onClick={() => setTheme(isLight ? "dark" : "light")}
          aria-label={isLight ? "Usar tema escuro" : "Usar tema claro"} title={isLight ? "Tema escuro" : "Tema claro"}
          className="mt-1 h-10 w-10 shrink-0 rounded-full border border-border bg-muted/40 grid place-items-center text-primary transition-transform duration-100 active:scale-[0.94]">
          {isLight ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
      </div>


      <div className="space-y-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              data-tour={item.label === "Comunidade" ? "profile-comunidade" : undefined}
              className="cursor-pointer hover:border-primary/30 transition-[colors,transform,opacity] hover:scale-[1.01]"
              onClick={() => handleItemClick(item)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-11 h-11 rounded-full bg-muted/40 flex items-center justify-center ${item.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {user && (
        <EditPlanningModal
          userId={user.id}
          isOpen={planningOpen}
          onClose={() => setPlanningOpen(false)}
        />
      )}
    </div>
  );
}
