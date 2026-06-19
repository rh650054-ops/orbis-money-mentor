import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { CreditCard } from "lucide-react";
import { getCheckoutUrl } from "@/shared/lib/checkout";

interface CardRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CardRegistrationModal({ isOpen, onClose }: CardRegistrationModalProps) {
  // "Trava anti-toque-fantasma": o MESMO toque que abre o modal no celular pode
  // cair no botão "Assinar agora" (que aparece no mesmo lugar do dedo) e ir
  // direto pro checkout. Só liberamos os botões ~350ms depois de abrir.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!isOpen) {
      setArmed(false);
      return;
    }
    setArmed(false);
    const t = setTimeout(() => setArmed(true), 350);
    return () => clearTimeout(t);
  }, [isOpen]);

  const handleRegister = () => {
    if (!armed) return;
    onClose();
    window.open(getCheckoutUrl(), "_blank");
  };

  const handleSkip = () => {
    if (!armed) return;
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] rounded-3xl border-primary/30 p-0 overflow-hidden">
        {/* Topo com brilho */}
        <div className="relative px-6 pt-8 pb-5 text-center bg-gradient-to-b from-primary/15 to-transparent">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.25),transparent_65%)]" />
          <div className="relative flex flex-col items-center">
            <div className="mb-4 w-16 h-16 rounded-2xl flex items-center justify-center text-3xl bg-primary/20 border border-primary/40 shadow-[0_0_30px_-6px_hsl(var(--primary)/0.6)]">
              🚀
            </div>
            <span className="mb-3 text-[11px] font-black uppercase tracking-widest text-primary px-3 py-1 rounded-full bg-primary/15 border border-primary/30">
              3 dias grátis
            </span>
            <DialogTitle className="text-xl font-bold leading-tight">
              Garanta seu acesso ao Orbis
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
              Teste tudo por 3 dias, sem pagar nada. Depois, mantém seus números, o mentor de rua (IA) e seu lugar no ranking.
            </DialogDescription>
          </div>
        </div>

        {/* Preço em destaque */}
        <div className="px-6">
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-3 flex items-baseline justify-center gap-1.5">
            <span className="text-3xl font-black text-foreground">R$0,99</span>
            <span className="text-sm text-muted-foreground">/ dia</span>
            <span className="text-xs text-muted-foreground ml-1">(R$29,99/mês)</span>
          </div>
        </div>

        {/* Ações */}
        <div className="px-6 pb-6 pt-4 space-y-2.5">
          <Button
            onClick={handleRegister}
            disabled={!armed}
            className="w-full h-12 text-base rounded-xl bg-gradient-to-r from-primary to-secondary"
            size="lg"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Assinar agora
          </Button>
          <Button onClick={handleSkip} disabled={!armed} variant="ghost" className="w-full rounded-xl">
            Agora não — usar meus 3 dias grátis
          </Button>
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            Você pode assinar a qualquer momento nas configurações.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
