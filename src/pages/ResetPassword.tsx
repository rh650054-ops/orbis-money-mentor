import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { supabase } from "@/integrations/supabase/client";

/**
 * Links de recuperação antigos (até 11/10/2026) caíam aqui. Agora a recuperação é
 * por código em /forgot-password. Se um link antigo ainda abrir uma sessão de
 * recuperação, ela é encerrada neste aparelho: link não troca senha nem confirma e-mail.
 */
export default function ResetPassword() {
  const navigate = useNavigate();

  useEffect(() => {
    const sair = () => void supabase.auth.signOut({ scope: "local" });
    if (/type=recovery/.test(window.location.hash)) sair();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") sair();
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-5 bg-background">
      <Card className="w-full max-w-[420px] bg-card border border-border rounded-2xl shadow-xl">
        <CardContent className="p-5 space-y-3 text-center">
          <p className="text-sm text-foreground font-semibold">Esse link não vale mais.</p>
          <p className="text-xs text-muted-foreground">Agora a senha é trocada com um código de 6 dígitos que chega no seu e-mail confirmado.</p>
          <Button onClick={() => navigate("/forgot-password", { replace: true })} className="w-full h-11 rounded-lg font-semibold">
            Recuperar com código
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
