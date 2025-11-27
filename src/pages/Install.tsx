import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Smartphone, Monitor, ArrowDown, Share2, Plus, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Install() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Detecta iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Verifica se já está instalado (modo standalone)
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsStandalone(standalone);

    // Captura o evento de instalação (Chrome/Edge Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  if (isStandalone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="glass max-w-md w-full p-8 text-center space-y-4">
          <div className="w-16 h-16 mx-auto bg-primary/20 rounded-full flex items-center justify-center">
            <Smartphone className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold gradient-text">App Já Instalado! ✓</h1>
          <p className="text-muted-foreground">
            O Orbis já está instalado no seu dispositivo. Você pode acessá-lo diretamente pela tela inicial.
          </p>
          <Button onClick={() => navigate("/")} className="w-full">
            Voltar ao Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-20 h-20 mx-auto mb-4">
            <img src="/pwa-192x192.png" alt="Orbis Logo" className="w-full h-full rounded-2xl" />
          </div>
          <h1 className="text-3xl font-bold gradient-text">Instale o App Orbis</h1>
          <p className="text-muted-foreground">
            Tenha acesso rápido, notificações e trabalhe offline
          </p>
        </div>

        {/* Botão de instalação automática (Android Chrome) */}
        {isInstallable && (
          <Card className="glass p-6 space-y-4 glow-primary">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
                <ArrowDown className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Instalação Rápida</h3>
                <p className="text-sm text-muted-foreground">
                  Clique no botão abaixo para instalar agora
                </p>
              </div>
            </div>
            <Button onClick={handleInstallClick} className="w-full" size="lg">
              Instalar Agora
            </Button>
          </Card>
        )}

        {/* Instruções iOS Safari */}
        {isIOS && (
          <Card className="glass p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Como Instalar no iPhone/iPad</h3>
            </div>
            
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-1">Abra o menu de compartilhamento</p>
                  <p className="text-muted-foreground">
                    Toque no botão <Share2 className="inline w-4 h-4 mx-1" /> no navegador Safari
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-1">Adicionar à Tela de Início</p>
                  <p className="text-muted-foreground">
                    Role e toque em "Adicionar à Tela de Início" <Plus className="inline w-4 h-4 mx-1" />
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-1">Confirme a instalação</p>
                  <p className="text-muted-foreground">
                    Toque em "Adicionar" no canto superior direito
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Instruções Android Chrome */}
        {!isIOS && !isInstallable && (
          <Card className="glass p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <Monitor className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Como Instalar no Android</h3>
            </div>
            
            <div className="space-y-4 text-sm">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">1</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-1">Abra o menu do navegador</p>
                  <p className="text-muted-foreground">
                    Toque nos três pontos <MoreVertical className="inline w-4 h-4 mx-1" /> no canto superior direito
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">2</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-1">Instalar aplicativo</p>
                  <p className="text-muted-foreground">
                    Selecione "Instalar app" ou "Adicionar à tela inicial"
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold">3</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium mb-1">Confirme a instalação</p>
                  <p className="text-muted-foreground">
                    Toque em "Instalar" na caixa de diálogo
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Benefícios */}
        <Card className="glass p-6">
          <h3 className="font-semibold text-lg mb-4">Por que instalar?</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">Acesso instantâneo:</span> Abra direto da tela inicial
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">Funciona offline:</span> Acesse seus dados sem internet
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">Mais rápido:</span> Carregamento instantâneo
              </p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
              <p className="text-muted-foreground">
                <span className="text-foreground font-medium">Notificações:</span> Receba lembretes de metas
              </p>
            </div>
          </div>
        </Card>

        {/* Botão voltar */}
        <Button 
          variant="outline" 
          onClick={() => navigate("/")}
          className="w-full"
        >
          Continuar no Navegador
        </Button>
      </div>
    </div>
  );
}
