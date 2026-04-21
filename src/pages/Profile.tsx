import { useNavigate } from "react-router-dom";
import { User, Wallet, Package, Settings as SettingsIcon, MessageCircle, ChevronRight, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface MenuItem {
  icon: React.ElementType;
  label: string;
  description: string;
  path: string;
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
  const { signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({ title: "Logout realizado", description: "Até logo!" });
    navigate("/auth");
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Perfil</h1>
        <p className="text-muted-foreground mt-1">Acesse e gerencie sua conta</p>
      </div>

      <div className="space-y-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.path}
              className="glass cursor-pointer hover:border-primary/30 transition-all hover:scale-[1.01]"
              onClick={() => navigate(item.path)}
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

      <Button
        variant="outline"
        onClick={handleSignOut}
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sair da conta
      </Button>
    </div>
  );
}
