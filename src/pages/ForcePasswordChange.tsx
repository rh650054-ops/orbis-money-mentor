import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent } from "@/shared/ui/card";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, CheckCircle2, ShieldCheck } from "lucide-react";

/**
 * Página de troca obrigatória de senha temporária.
 * O admin gera uma senha temporária (OrbisXXXXXX!) → must_change_password = true.
 * Na próxima vez que o usuário logar, o layout detecta a flag e redireciona aqui.
 * Após salvar a nova senha, a flag é limpa e o usuário vai para o dashboard.
 */
export default function ForcePasswordChange() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }
      setUserId(session.user.id);
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: "Senha muito curta", description: "Use no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas diferentes", description: "Os dois campos precisam ser iguais.", variant: "destructive" });
      return;
    }

    setLoading(true);

    // 1. Atualiza a senha no Auth
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      toast({ title: "Erro ao salvar", description: authError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // 2. Limpa a flag must_change_password no profile
    if (userId) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false } as any)
        .eq("user_id", userId);
    }

    setLoading(false);
    setDone(true);
    setTimeout(() => navigate("/", { replace: true }), 1500);
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
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Crie sua senha</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Você entrou com uma senha temporária. Defina uma senha pessoal agora.
            </p>
          </div>
        </div>

        <Card className="bg-card border border-border rounded-2xl shadow-xl">
          <CardContent className="p-5">
            {done ? (
              <div className="space-y-3 py-3 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-base font-semibold text-foreground">Senha salva!</h2>
                <p className="text-xs text-muted-foreground">Redirecionando...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="flex items-center gap-1.5 text-xs">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                    Nova senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    className="h-11 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-xs">Confirme a senha</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    minLength={6}
                    required
                    className="h-11 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                  disabled={loading}
                >
                  {loading ? "Salvando..." : "Salvar e entrar no Orbis"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
