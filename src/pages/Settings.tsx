import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Volume2, Shield, HelpCircle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const navigate = useNavigate();

  const items = [
    { icon: Bell, label: "Notificações", description: "Lembretes e alertas" },
    { icon: Volume2, label: "Áudio e Voz", description: "Entrada e saída de áudio" },
    { icon: Shield, label: "Privacidade", description: "Dados e permissões" },
    { icon: HelpCircle, label: "Ajuda e Suporte", description: "FAQ e contato" },
    { icon: Info, label: "Sobre o Orbis", description: "Versão e informações" },
  ];

  return (
    <div className="space-y-6 pb-4 md:pb-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold gradient-text">Configurações</h1>
          <p className="text-sm text-muted-foreground">Preferências do app</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="glass">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-primary">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">Orbis v1.0</p>
    </div>
  );
}
