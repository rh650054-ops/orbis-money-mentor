import { useNavigate } from "react-router-dom";
import { KeyRound, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/shared/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { avisar } from "@/shared/lib/avisar";

/**
 * Trocar senha = o mesmo caminho do login (decisão do Mohamed, 29/09):
 * sai da conta e abre "Esqueci a senha", onde a pessoa pede o link por e-mail.
 * Um único fluxo pra trocar senha, sem formulário dentro do app.
 */
export default function TrocarSenhaCard() {
  const navigate = useNavigate();

  const ir = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      avisar.silencioso("TrocarSenhaCard: signOut", e);
    }
    navigate("/forgot-password", { replace: true });
  };

  return (
    <Card className="cursor-pointer hover:bg-muted/10 transition-colors" onClick={ir}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-muted/40 flex items-center justify-center text-primary">
          <KeyRound className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Trocar senha</p>
          <p className="text-xs text-muted-foreground">Você sai da conta e recebe um link por e-mail pra criar a nova</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
