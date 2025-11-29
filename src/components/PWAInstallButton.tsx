import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share2, Plus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        setShowIOSModal(true);
      } else {
        toast({
          title: "App já instalado",
          description: "O Orbis já está instalado no seu dispositivo.",
        });
      }
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast({
        title: "✅ Orbis instalado!",
        description: "Agora você pode acessar o app diretamente da sua tela inicial.",
      });
      setIsInstallable(false);
    }
    
    setDeferredPrompt(null);
  };

  // Don't show if not installable and not iOS
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <Button
        onClick={handleInstallClick}
        variant="outline"
        size="sm"
        className="border-white/20 hover:bg-white/5 backdrop-blur-sm"
      >
        <Download className="w-4 h-4 mr-2" />
        Instalar Orbis
      </Button>

      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="bg-gradient-to-br from-black via-black/95 to-purple-950/30 border-purple-500/20 backdrop-blur-xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              📲 Instalar o Orbis no seu iPhone
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <p className="text-gray-300 text-center text-sm">
              O iPhone não permite instalação automática de apps via navegador.
              Mas você pode instalar o Orbis facilmente na sua Tela Inicial:
            </p>

            <div className="space-y-4">
              <div className="flex gap-4 items-start p-4 bg-white/5 rounded-lg border border-purple-500/20">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white">
                  1
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Share2 className="w-5 h-5 text-blue-400" />
                    <p className="text-white font-semibold">Toque em Compartilhar</p>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Ícone de quadrado com seta para cima
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start p-4 bg-white/5 rounded-lg border border-purple-500/20">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white">
                  2
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Plus className="w-5 h-5 text-blue-400" />
                    <p className="text-white font-semibold">Adicionar à Tela Inicial</p>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Role a lista e selecione esta opção
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start p-4 bg-white/5 rounded-lg border border-purple-500/20">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center font-bold text-white">
                  3
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Check className="w-5 h-5 text-blue-400" />
                    <p className="text-white font-semibold">Confirme</p>
                  </div>
                  <p className="text-gray-400 text-sm">
                    Toque em "Adicionar" no canto superior direito
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-4">
              <p className="text-center text-white text-sm font-medium">
                ✨ Pronto! Agora o Orbis vai aparecer como um APP no seu iPhone,
                com ícone e abertura em tela cheia.
              </p>
            </div>

            <Button
              onClick={() => setShowIOSModal(false)}
              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold"
            >
              ENTENDI
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
