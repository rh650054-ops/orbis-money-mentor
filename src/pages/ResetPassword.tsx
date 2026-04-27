import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { KeyRound, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    // Supabase auto-cria sessão ao chegar com o token de recovery no hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(true);
      }
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setHasSession(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "Use no mínimo 6 caracteres.",
        variant: "destructive",
      });
      return;
    }
    if (password !== confirm) {
      toast({
        title: "Senhas diferentes",
        description: "Confirme a mesma senha nos dois campos.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({
        title: "Não foi possível atualizar",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

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
          <img
            src="/orbis-logo.png"
            alt="Orbis"
            className="w-14 h-14 object-contain animate-orbis-spin-in"
          />
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Nova senha</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Defina uma senha nova pra continuar
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
                <h2 className="text-base font-semibold text-foreground">
                  Senha atualizada!
                </h2>
                <p className="text-xs text-muted-foreground">
                  Redirecionando...
                </p>
              </div>
            ) : !hasSession ? (
              <div className="space-y-3 py-3 text-center">
                <p className="text-sm text-foreground">
                  Link inválido ou expirado.
                </p>
                <p className="text-xs text-muted-foreground">
                  Solicite um novo link de recuperação.
                </p>
                <Button
                  onClick={() => navigate("/forgot-password")}
                  className="h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  Pedir novo link
                </Button>
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
                  <Label htmlFor="confirm" className="text-xs">
                    Confirme a senha
                  </Label>
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
                  {loading ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
