import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Wallet, Package, Settings as SettingsIcon, MessageCircle, ChevronRight, LogOut, Target, Radar, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/shared/hooks/use-toast";
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
    color: "text-secondary",
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
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [planningOpen, setPlanningOpen] = useState(false);
  const isLight = theme === "light";

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Logout realizado", description: "Até logo!" });
    navigate("/auth");
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.action === "edit-planning") {
      setPlanningOpen(true);
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <div className="space-y-6 pb-4 md:pb-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Perfil</h1>
        <p className="text-muted-foreground mt-1">Acesse e gerencie sua conta</p>
      </div>

      <div className="space-y-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
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

      {/* Aparência — tema claro/escuro */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-muted/40 flex items-center justify-center text-primary">
              {isLight ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">Aparência</p>
              <p className="text-xs text-muted-foreground truncate">Escolha como você quer usar o app</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant={isLight ? "outline" : "default"}
              onClick={() => setTheme("dark")}
              className="justify-center gap-2"
            >
              <Moon className="w-4 h-4" /> Escuro
            </Button>
            <Button
              variant={isLight ? "default" : "outline"}
              onClick={() => setTheme("light")}
              className="justify-center gap-2"
            >
              <Sun className="w-4 h-4" /> Claro
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        onClick={handleSignOut}
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sair da conta
      </Button>

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
