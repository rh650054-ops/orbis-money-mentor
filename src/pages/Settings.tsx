import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Volume2, Shield, HelpCircle, Info, ChevronRight, Check, X, Gift, Receipt } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";
import { useToast } from "@/shared/hooks/use-toast";
import { celebrationSounds } from "@/shared/lib/celebration-sounds";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/useAdminAccess";

const STORAGE_KEYS = {
  sounds: "orbis_sounds_enabled",
  notifications: "orbis_notifications_enabled",
};

export default function Settings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { whitelisted, role } = useAdminAccess(user?.id);
  const isAdmin = whitelisted && role === "admin";

  const [soundsEnabled, setSoundsEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.sounds);
    return stored === null ? true : stored === "true";
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.notifications);
    return stored === "true" && Notification.permission === "granted";
  });

  useEffect(() => {
    celebrationSounds.setEnabled(soundsEnabled);
  }, [soundsEnabled]);

  const handleSoundsToggle = (value: boolean) => {
    setSoundsEnabled(value);
    localStorage.setItem(STORAGE_KEYS.sounds, String(value));
    celebrationSounds.setEnabled(value);
    if (value) celebrationSounds.playNotification();
  };

  const handleNotificationsToggle = async (value: boolean) => {
    if (value) {
      if (!("Notification" in window)) {
        toast({ title: "Não suportado", description: "Seu navegador não suporta notificações.", variant: "destructive" });
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        localStorage.setItem(STORAGE_KEYS.notifications, "true");
        toast({ title: "✅ Notificações ativadas", description: "Você receberá lembretes do Orbis." });
      } else {
        toast({ title: "Permissão negada", description: "Habilite as notificações nas configurações do navegador.", variant: "destructive" });
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem(STORAGE_KEYS.notifications, "false");
      toast({ title: "Notificações desativadas" });
    }
  };

  const handleSupport = () => {
    window.open("https://wa.me/5511915054830?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20Orbis", "_blank");
  };

  return (
    <div className="space-y-6 pb-4 md:pb-8 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/profile")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground">Preferências do app</p>
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Geral</p>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-primary">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Notificações</p>
              <p className="text-xs text-muted-foreground">
                {Notification.permission === "denied"
                  ? "Bloqueado pelo navegador — altere nas configurações"
                  : "Lembretes e alertas do app"}
              </p>
            </div>
            <Switch
              checked={notificationsEnabled}
              onCheckedChange={handleNotificationsToggle}
              disabled={Notification.permission === "denied"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-primary">
              <Volume2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Sons</p>
              <p className="text-xs text-muted-foreground">Efeitos sonoros de conquistas e alertas</p>
            </div>
            <Switch checked={soundsEnabled} onCheckedChange={handleSoundsToggle} />
          </CardContent>
        </Card>
      </div>

      {/* Info / Links */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Informações</p>

        <Card className="cursor-pointer hover:bg-muted/10 transition-colors" onClick={handleSupport}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-primary">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Ajuda e Suporte</p>
              <p className="text-xs text-muted-foreground">Fale com a equipe via WhatsApp</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-primary">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Privacidade</p>
              <p className="text-xs text-muted-foreground">Seus dados são protegidos pela LGPD</p>
            </div>
            <Check className="w-4 h-4 text-primary" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-primary">
              <Info className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-semibold">Sobre o Orbis</p>
              <p className="text-xs text-muted-foreground">Versão 1.0 · Plataforma para vendedores visionários</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Admin — só aparece pra administradores */}
      {isAdmin && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Admin</p>

          <Card className="cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => navigate("/admin/competitions")}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary">
                <Gift className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Competições</p>
                <p className="text-xs text-muted-foreground">Criar e gerenciar os desafios mensais e semanais</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
