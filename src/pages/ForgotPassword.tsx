import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent } from "@/shared/ui/card";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF } from "@/shared/lib/cpf-validation";
import { ArrowLeft, MessageCircle, IdCard, MailCheck, ShieldCheck } from "lucide-react";

const SUPPORT_WHATSAPP = "5511915054830";

/**
 * Recuperação de senha self-service.
 * A conta é por CPF (e-mail de auth interno), então o link de recuperação é
 * gerado no servidor (edge function `recuperar-senha`) e enviado pro e-mail
 * pessoal — só se ele estiver confirmado. Quem não tem e-mail confirmado
 * continua pelo WhatsApp (senha temporária gerada pelo time).
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const openWhatsApp = () => {
    const msg = encodeURIComponent("Olá! Esqueci minha senha da Vant e preciso recuperar. Meu CPF é: ");
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${msg}`, "_blank");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const limpo = cpf.replace(/\D/g, "");
    if (!validateCPF(limpo)) {
      toast({ title: "CPF inválido", description: "Confira os 11 dígitos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.functions.invoke("recuperar-senha", { body: { cpf: limpo } });
    setLoading(false);
    if (error) {
      toast({ title: "Não deu agora", description: "Tente de novo em instantes ou fale no WhatsApp.", variant: "destructive" });
      return;
    }
    setEnviado(true);
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center p-5 bg-background animate-fade-in"
      style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
    >
      <div className="w-full max-w-[420px] space-y-5">
        <div className="flex flex-col items-center gap-3">
          <img src="/vant-logo.png" alt="Vant" className="w-14 h-14 object-contain animate-orbis-spin-in" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Recuperar senha</h1>
            <p className="text-xs text-muted-foreground mt-1">A gente te ajuda a voltar pra Vant</p>
          </div>
        </div>

        <Card className="bg-card border border-border rounded-2xl shadow-xl">
          <CardContent className="p-5 space-y-4">
            {enviado ? (
              <div className="space-y-3 text-center py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                  <MailCheck className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm text-foreground font-semibold">Se esse CPF tiver um e-mail confirmado, o link já está a caminho.</p>
                <p className="text-xs text-muted-foreground">
                  Olha a caixa de entrada (e o spam). O link vale por 1 hora. Não chegou? Você ainda pode recuperar pelo WhatsApp.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cpf" className="flex items-center gap-1.5 text-xs">
                    <IdCard className="w-3.5 h-3.5 text-primary" /> CPF da conta
                  </Label>
                  <Input id="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf}
                    onChange={(e) => setCpf(e.target.value)} required className="h-11 rounded-lg bg-input" />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Mandamos um link pro e-mail que você confirmou no app. Não confirmou? Sem problema, usa o WhatsApp abaixo.
                </p>
                <Button type="submit" disabled={loading} className="w-full h-12 rounded-lg font-semibold">
                  {loading ? "Enviando..." : "Enviar link por e-mail"}
                </Button>
              </form>
            )}

            <Button type="button" variant="outline" onClick={openWhatsApp} className="w-full h-11 rounded-lg">
              <MessageCircle className="w-4 h-4 mr-2" /> Recuperar pelo WhatsApp
            </Button>

            <div className="flex items-center gap-2 justify-center text-[11px] text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" /> Ninguém vê sua senha — nem a gente
            </div>
          </CardContent>
        </Card>

        <button type="button" onClick={() => navigate("/auth")}
          className="flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground hover:text-primary transition-colors py-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
        </button>
      </div>
    </div>
  );
}
