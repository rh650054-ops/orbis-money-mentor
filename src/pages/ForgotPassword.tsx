import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { ArrowLeft, MessageCircle, KeyRound, ShieldCheck } from "lucide-react";

const SUPPORT_WHATSAPP = "5511915054830";

/**
 * Recuperação de senha.
 * A conta no Orbis é identificada por CPF (o e-mail de auth é interno,
 * "CPF@orbis.internal"), então o reset por e-mail do Supabase não chega no
 * e-mail pessoal da pessoa. Por isso a recuperação é pelo WhatsApp: o time
 * gera uma senha temporária no painel (admin-reset) e a pessoa cria a nova
 * no próximo login (fluxo já existente).
 */
export default function ForgotPassword() {
  const navigate = useNavigate();

  const openWhatsApp = () => {
    const msg = encodeURIComponent(
      "Olá! Esqueci minha senha do Orbis e preciso recuperar. Meu CPF é: "
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
              A gente te ajuda a voltar pro Orbis
            </p>
          </div>
        </div>

        <Card className="bg-card border border-border rounded-2xl shadow-xl">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start gap-3 rounded-xl bg-primary/10 border border-primary/25 p-3.5">
              <KeyRound className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-foreground leading-relaxed">
                Sua conta no Orbis é pelo <span className="font-semibold">CPF</span>.
                Pra resetar a senha rapidinho, fala com a gente no WhatsApp que o time
                gera uma senha nova na hora e te manda — aí no próximo login você cria
                a sua. 👊
              </p>
            </div>

            <Button
              type="button"
              onClick={openWhatsApp}
              className="w-full h-12 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Recuperar pelo WhatsApp
            </Button>

            <div className="flex items-center gap-2 justify-center text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" />
              Resposta rápida, direto com o time do Orbis
            </div>
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
