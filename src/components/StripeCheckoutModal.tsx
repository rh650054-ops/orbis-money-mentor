import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2, CreditCard, ExternalLink, Copy } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "");

interface CheckoutFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  clientSecret: string;
  paymentLink?: string;
}

function CheckoutForm({ onSuccess, onCancel, clientSecret, paymentLink }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/`,
        },
        redirect: "if_required",
      });

      if (error) {
        toast({
          title: "Erro no pagamento",
          description: error.message || "Não foi possível processar o pagamento.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ Pagamento confirmado!",
          description: "Seu plano foi ativado com sucesso.",
        });
        onSuccess();
      }
    } catch (err) {
      toast({
        title: "Erro no pagamento",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyLink = () => {
    if (paymentLink) {
      navigator.clipboard.writeText(paymentLink);
      toast({
        title: "Link copiado!",
        description: "Cole em qualquer navegador para completar o pagamento.",
      });
    }
  };

  const handleOpenExternal = () => {
    if (paymentLink) {
      window.open(paymentLink, "_blank");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-muted/50 rounded-lg p-4">
        <PaymentElement />
      </div>

      <div className="space-y-3">
        <Button
          type="submit"
          disabled={!stripe || isProcessing}
          className="w-full h-12 text-base font-semibold"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <CreditCard className="w-5 h-5 mr-2" />
              Confirmar pagamento
            </>
          )}
        </Button>

        {paymentLink && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Ou use estes fallbacks
                </span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleCopyLink}
              className="w-full"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copiar link de pagamento
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleOpenExternal}
              className="w-full"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir no navegador externo
            </Button>
          </>
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          className="w-full"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

interface StripeCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientSecret: string;
  paymentLink?: string;
}

export default function StripeCheckoutModal({
  isOpen,
  onClose,
  clientSecret,
  paymentLink,
}: StripeCheckoutModalProps) {
  const handleSuccess = () => {
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  };

  const options = {
    clientSecret,
    appearance: {
      theme: "stripe" as const,
    },
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">💳 Finalizar Pagamento</DialogTitle>
          <DialogDescription>
            Complete seu pagamento de forma segura. O checkout acontece aqui mesmo, sem redirecionamentos.
          </DialogDescription>
        </DialogHeader>

        <Elements stripe={stripePromise} options={options}>
          <CheckoutForm
            onSuccess={handleSuccess}
            onCancel={onClose}
            clientSecret={clientSecret}
            paymentLink={paymentLink}
          />
        </Elements>

        <div className="space-y-1 pt-2">
          <p className="text-xs text-center text-muted-foreground">
            🔒 Pagamento 100% seguro processado pelo Stripe
          </p>
          <p className="text-xs text-center text-muted-foreground">
            💳 Aceita cartão de crédito, débito e PIX
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
