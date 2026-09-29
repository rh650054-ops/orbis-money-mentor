import { useEffect, useState } from "react";
import { Mail, MailCheck, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Etapa = "fechado" | "email" | "codigo";

/**
 * Confirmação do e-mail pessoal (código de 6 dígitos via edge function `email-confirmar`).
 * Com o e-mail confirmado o usuário recupera a senha sozinho em /forgot-password.
 */
export default function ConfirmarEmailCard({ userId, abrir = false, somenteSeNaoConfirmado = false }: { userId: string | undefined; abrir?: boolean; somenteSeNaoConfirmado?: boolean }) {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [verificado, setVerificado] = useState(false);
  const [carregou, setCarregou] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>(abrir ? "email" : "fechado");
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    (supabase as any)
      .from("profiles")
      .select("email, email_verificado_em")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: { data: { email: string | null; email_verificado_em: string | null } | null }) => {
        setEmail(data?.email ?? "");
        setVerificado(!!data?.email_verificado_em);
        setCarregou(true);
        if (abrir) setTimeout(() => document.getElementById("email-rec")?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      });
  }, [userId, abrir]);

  const enviar = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("email-confirmar", { body: { acao: "enviar", email } });
    setLoading(false);
    const msg = (data as { error?: string } | null)?.error;
    if (error || msg) {
      toast({ title: "Não foi possível enviar", description: msg ?? "Tente de novo em instantes.", variant: "destructive" });
      return;
    }
    setEtapa("codigo");
    toast({ title: "Código enviado", description: `Olha a caixa de entrada de ${email} (e o spam).` });
  };

  const confirmar = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("email-confirmar", { body: { acao: "confirmar", codigo } });
    setLoading(false);
    const msg = (data as { error?: string } | null)?.error;
    if (error || msg) {
      toast({ title: "Código não bateu", description: msg ?? "Tente de novo.", variant: "destructive" });
      return;
    }
    setVerificado(true);
    setEtapa("fechado");
    setCodigo("");
    toast({ title: "✅ E-mail confirmado", description: "Agora você recupera a senha sozinho se precisar." });
  };

  if (somenteSeNaoConfirmado && (!carregou || verificado)) return null;

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <button type="button" onClick={() => setEtapa((e) => (e === "fechado" ? "email" : "fechado"))} className="w-full flex items-center gap-4 text-left">
          <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-primary">
            {verificado ? <MailCheck className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
          </div>
          <div className="flex-1">
            <p className="font-semibold">E-mail de recuperação</p>
            <p className="text-xs text-muted-foreground">
              {verificado ? `${email} · confirmado` : email ? `${email} · não confirmado` : "Cadastre um e-mail pra recuperar a senha sozinho"}
            </p>
          </div>
          {etapa === "fechado" ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
        </button>

        {etapa === "email" && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="email-rec" className="text-xs">Seu e-mail</Label>
              <Input id="email-rec" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com" className="h-11 rounded-lg bg-input" />
            </div>
            <Button type="button" onClick={enviar} disabled={loading || !email.includes("@")} className="w-full h-11 rounded-lg font-semibold">
              {loading ? "Enviando..." : verificado ? "Trocar e confirmar de novo" : "Enviar código de confirmação"}
            </Button>
          </div>
        )}

        {etapa === "codigo" && (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="codigo-rec" className="text-xs">Código de 6 dígitos</Label>
              <Input id="codigo-rec" inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                placeholder="000000" className="h-11 rounded-lg bg-input tracking-[0.4em] text-center text-lg" />
            </div>
            <Button type="button" onClick={confirmar} disabled={loading || codigo.length !== 6} className="w-full h-11 rounded-lg font-semibold">
              {loading ? "Conferindo..." : "Confirmar e-mail"}
            </Button>
            <button type="button" onClick={enviar} disabled={loading} className="w-full text-xs text-muted-foreground hover:text-primary py-1">
              Não chegou? Reenviar código
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
