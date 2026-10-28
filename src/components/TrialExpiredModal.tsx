import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { LogOut, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/shared/hooks/use-toast";
import { useState } from "react";

import { EscolhaPlano } from "@/components/jornada/EscolhaPlano";
import { useJornada } from "@/components/jornada/useJornada";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useVoltaDoCheckout } from "@/hooks/useVoltaDoCheckout";
import { verificarAcessoPago } from "@/shared/lib/verificar-acesso";
import { assinaPeloSite } from "@/shared/lib/cobranca-loja";
import { TelaAssinarPeloSite } from "@/shared/components/assinatura-loja";
import { PixVencido, RenovarPix, useRenovacaoPixQuery, useRenovacaoVencidaQuery } from "@/features/renovacao";

interface TrialExpiredModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export default function TrialExpiredModal({ isOpen }: TrialExpiredModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  const { vendidoNoTeste: vendido } = useJornada();
  // quem já pagou e não renovou vê "seu plano encerrou", não "seu teste acabou" (22/10/2026)
  const { user } = useAuth();
  const { status: assinatura } = useSubscription(user?.id);
  const exAssinante = ["expired", "canceled", "cancelled", "past_due"].includes(String(assinatura.status));
  // Pix da renovação em aberto (Hotmart): renovar vem antes de "assinar de novo" (23/10/2026)
  const qRenovacao = useRenovacaoPixQuery(user?.id);
  const renovacao = qRenovacao.data ?? null;
  // Pix venceu e a Hotmart não mandou outro: "Gerar novo Pix" na área do cliente (23/10/2026)
  const vencida = useRenovacaoVencidaQuery(user?.id, qRenovacao.isSuccess && !renovacao).data ?? null;
  // voltou da Hotmart: confere sozinho e libera sem precisar do "Já paguei"
  useVoltaDoCheckout({ ativo: isOpen, verificar: verificarAcessoPago, aoLiberar: () => window.location.reload() });

  const handleCheckAccess = async () => {
    setIsChecking(true);
    try {
      // mesma regra do useSubscription (shared/lib/assinatura)
      if (await verificarAcessoPago()) {
        toast({
          title: "✅ Acesso liberado!",
          description: "Seu plano foi ativado com sucesso.",
        });
        window.location.reload();
      } else {
        toast({
          title: "Pagamento não confirmado",
          description: "Aguarde alguns minutos. Se já pagou, em breve será liberado.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Erro ao verificar",
        description: "Não foi possível verificar seu acesso. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="p-0 gap-0 max-w-[420px] w-[calc(100vw-1.5rem)] max-h-[92dvh] overflow-hidden border border-primary/30 bg-background rounded-2xl [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Glow decorations */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative overflow-y-auto max-h-[92dvh] px-5 py-6 sm:px-7 sm:py-7 text-[#F4F1EA]" style={{ background: "#000" }}>
          {/* App da loja (modelo Néctar, 23/10/2026): sem preço; Assinar abre o site */}
          {assinaPeloSite() ? (
            <TelaAssinarPeloSite
              titulo={exAssinante ? "Assinatura inválida" : "Seu teste acabou"}
              texto={exAssinante
                ? <>Sua assinatura não está ativa ou expirou.<br />Para continuar na VANT você precisa de uma assinatura ativa.</>
                : <>Seus 3 dias de teste terminaram.<br />Pra continuar vendendo com a VANT, assine pelo site.</>}
              onTentar={handleCheckAccess} tentando={isChecking} onSair={handleLogout}
              /* 28/10: modelo Néctar completo — no app da loja, sem Pix; "Assinar" abre o site */ />
          ) : (<>
          {/* Fim do teste (06/10): os 3 planos — VANT Pro Anual (selecionado), Pro Mensal e Essencial */}
          <p className="text-center font-mono text-[10px] font-bold tracking-[.18em] mb-3" style={{ color: "#F5B800" }}>{exAssinante ? "SEU PLANO ENCERROU" : "SEU TESTE ACABOU"}</p>
          {renovacao && <div className="mb-4"><RenovarPix pix={renovacao} /></div>}
          {!renovacao && vencida && <div className="mb-4"><PixVencido vencida={vencida} /></div>}
          {(renovacao || vencida) && <p className="text-center text-[11px] font-black tracking-[.14em] mb-2" style={{ color: "#7b766e" }}>OU TROCAR DE PLANO</p>}
          <EscolhaPlano vendido={vendido} titulo={exAssinante ? "Escolha como voltar pra VANT" : undefined} />
          </>)}

          {/* Já pagou / sair (no app da loja esses dois já estão na tela acima) */}
          {!assinaPeloSite() && <div className="space-y-2 mt-4">
            <Button
              onClick={handleCheckAccess}
              variant="outline"
              className="w-full h-10 text-xs border-border/60 bg-card/50"
              disabled={isChecking}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-2 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Verificando..." : "Já paguei, verificar acesso"}
            </Button>

            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full h-9 text-xs text-muted-foreground/50 hover:text-foreground"
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sair
            </Button>
          </div>}

        </div>
      </DialogContent>
    </Dialog>
  );
}
