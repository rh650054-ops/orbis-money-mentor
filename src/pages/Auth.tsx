import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus } from "lucide-react";
import { z } from "zod";
import orbisLogo from "@/assets/orbis-logo.png";
const authSchema = z.object({
  email: z.string().trim().email({
    message: "Email inválido"
  }).max(255),
  password: z.string().min(6, {
    message: "Senha deve ter no mínimo 6 caracteres"
  }).max(100)
});
export default function Auth() {
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => {
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/");
      }
    });
    supabase.auth.getSession().then(({
      data: {
        session
      }
    }) => {
      if (session) {
        navigate("/");
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Validar dados
      const validated = authSchema.parse({
        email: email.trim(),
        password
      });
      if (isLogin) {
        const {
          error
        } = await supabase.auth.signInWithPassword({
          email: validated.email,
          password: validated.password
        });
        if (error) throw error;
        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta ao Orbis."
        });
      } else {
        const {
          error
        } = await supabase.auth.signUp({
          email: validated.email,
          password: validated.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (error) throw error;
        toast({
          title: "Conta criada!",
          description: "Você já pode começar a usar o Orbis."
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Erro de validação",
          description: error.errors[0].message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Erro",
          description: error.message || "Ocorreu um erro. Tente novamente.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  return <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-b from-black via-[#1A1A1A] to-black">
      {/* Logo e Slogan */}
      <div className="text-center mb-8 space-y-1">
        <div className="flex justify-center mb-6">
          <img src={orbisLogo} alt="Orbis Logo" className="w-32 h-32 object-contain" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          <span className="block bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Domine seus números.
          </span>
        </h1>
        <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
          <span className="block bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
            Domine seu futuro.
          </span>
        </h2>
      </div>

      {/* Card de Login */}
      <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20 shadow-2xl relative z-0">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-foreground">
            {isLogin ? "Entre na sua conta" : "Crie sua conta gratuita"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Bem-vindo de volta ao Orbis" : "Comece sua jornada agora"}
          </CardDescription>
        </CardHeader>
        <CardContent className="relative z-10">
          <form onSubmit={handleAuth} className="space-y-4 relative z-10">
            <div className="space-y-2 relative z-20">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="seu@email.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                autoComplete="email" 
                className="cursor-text bg-background border-input hover:border-primary/50 focus:border-primary transition-colors relative z-20" 
              />
            </div>
            <div className="space-y-2 relative z-20">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                minLength={6} 
                autoComplete="current-password" 
                className="cursor-text bg-background border-input hover:border-primary/50 focus:border-primary transition-colors relative z-20" 
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-primary text-black font-semibold hover:bg-black hover:text-primary hover:border hover:border-primary transition-all cursor-pointer relative z-20" 
              disabled={isLoading}
            >
              {isLoading ? "Carregando..." : isLogin ? <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </> : <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Criar conta
                </>}
            </Button>
          </form>

          <div className="mt-6 text-center relative z-20">
            <button 
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
              }} 
              className="text-sm text-muted-foreground hover:text-primary transition-colors cursor-pointer underline-offset-4 hover:underline relative z-20 bg-transparent border-none p-2"
            >
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>;
}