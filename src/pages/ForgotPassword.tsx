import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Mail, MessageCircle, KeyRound } from "lucide-react";

const SUPPORT_WHATSAPP = "5551992525965";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      toast({
        title: "E-mail inválido",
        description: "Verifique o e-mail digitado.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast({
        title: "Não foi possível enviar",
        description: "Se você cadastrou um e-mail, verifique-o. Caso contrário, fale com o suporte no WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    setSent(true);
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      "Olá! Preciso recuperar minha senha do Orbis. Meu CPF é: "
    );
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${msg}`, "_blank");
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-5 bg-background animate-fade-in"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-[420px] space-y-5">
        {/* Header com logo */}
        <div className="flex flex-col items-center gap-3">
          <img
            src="/orbis-logo.png"
            alt="Orbis"
            className="w-14 h-14 object-contain animate-orbis-spin-in"
          />
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Recuperar senha</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Vamos te ajudar a voltar pro Orbis
            </p>
          </div>
        </div>

        <Card className="bg-card border border-border rounded-2xl shadow-xl">
          <CardContent className="p-5 space-y-4">
            {!sent ? (
              <>
                <form onSubmit={handleSendReset} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="flex items-center gap-1.5 text-xs">
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      E-mail cadastrado
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Vamos enviar um link para você criar uma nova senha.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    disabled={loading}
                  >
                    {loading ? "Enviando..." : "Enviar link de recuperação"}
                  </Button>
                </form>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-card px-2 text-[10px] text-muted-foreground uppercase tracking-wider">
                      ou
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">
                    Não cadastrou e-mail ou não está conseguindo?
                  </p>
                  <Button
                    type="button"
                    onClick={openWhatsApp}
                    variant="outline"
                    className="w-full h-11 rounded-lg border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Falar com o suporte no WhatsApp
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3 py-2 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground">
                  Link enviado!
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Acesse <span className="text-foreground font-medium">{email}</span> e clique no link que enviamos para criar sua nova senha.
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Não chegou em alguns minutos? Veja no spam ou fale com o suporte.
                </p>
                <Button
                  type="button"
                  onClick={openWhatsApp}
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary hover:bg-primary/10"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                  Suporte no WhatsApp
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => navigate("/auth")}
          className="flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground hover:text-primary transition-colors py-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para o login
        </button>
      </div>
    </div>
  );
}
