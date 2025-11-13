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
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres").max(100),
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres").optional(),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos").optional(),
  phone: z.string().regex(/^\d{10,11}$/, "Celular inválido (10 ou 11 dígitos)").optional(),
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
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
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
      if (isLogin) {
        authSchema.parse({ email: email.trim(), password });
      } else {
        authSchema.parse({ email: email.trim(), password, name, cpf, phone });
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        
        if (error) throw error;
        
        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta ao Orbis."
        });
        
        navigate("/", { replace: true });
      } else {
        // Verificar se CPF, email ou telefone já existem
        const { data: existingByCpf } = await supabase
          .from('profiles')
          .select('cpf')
          .eq('cpf', cpf)
          .maybeSingle();

        if (existingByCpf) {
          toast({
            variant: "destructive",
            title: "CPF já cadastrado",
            description: "Este CPF já possui uma conta no Orbis. Faça login ou use outro CPF.",
          });
          setIsLoading(false);
          return;
        }

        const { data: existingByEmail } = await supabase
          .from('profiles')
          .select('email')
          .eq('email', email.trim())
          .maybeSingle();

        if (existingByEmail) {
          toast({
            variant: "destructive",
            title: "E-mail já cadastrado",
            description: "Este e-mail já possui uma conta no Orbis. Faça login ou use outro e-mail.",
          });
          setIsLoading(false);
          return;
        }

        const { data: existingByPhone } = await supabase
          .from('profiles')
          .select('phone')
          .eq('phone', phone)
          .maybeSingle();

        if (existingByPhone) {
          toast({
            variant: "destructive",
            title: "Telefone já cadastrado",
            description: "Este telefone já possui uma conta no Orbis. Faça login ou use outro número.",
          });
          setIsLoading(false);
          return;
        }

        // Create user account
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { name, cpf, phone }
          }
        });

        if (signUpError) throw signUpError;

        // Update profile with CPF and phone (the trigger creates the profile)
        if (authData.user) {
          const trialStart = new Date();
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + 3);

          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              cpf,
              phone,
              nickname: name,
              trial_start: trialStart.toISOString().split('T')[0],
              trial_end: trialEnd.toISOString().split('T')[0],
              is_trial_active: true,
              plan_status: 'trial',
            })
            .eq('user_id', authData.user.id);

          if (updateError) throw updateError;
        }

        toast({
          title: "Conta criada com sucesso! 🎉",
          description: "Bem-vindo ao Orbis! Você ganhou 3 dias de teste grátis.",
        });
        
        navigate("/", { replace: true });
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
            {!isLogin && (
              <div className="space-y-2 relative z-20">
                <Label htmlFor="name">Nome completo</Label>
                <Input 
                  id="name" 
                  type="text" 
                  placeholder="Seu nome" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required={!isLogin}
                  className="cursor-text bg-background border-input hover:border-primary/50 focus:border-primary transition-colors relative z-20" 
                />
              </div>
            )}
            
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
            
            {!isLogin && (
              <>
                <div className="space-y-2 relative z-20">
                  <Label htmlFor="cpf">CPF (somente números)</Label>
                  <Input 
                    id="cpf" 
                    type="text" 
                    placeholder="12345678900" 
                    value={cpf} 
                    onChange={e => setCpf(e.target.value.replace(/\D/g, ''))} 
                    required={!isLogin}
                    maxLength={11}
                    className="cursor-text bg-background border-input hover:border-primary/50 focus:border-primary transition-colors relative z-20" 
                  />
                </div>
                
                <div className="space-y-2 relative z-20">
                  <Label htmlFor="phone">Celular (somente números)</Label>
                  <Input 
                    id="phone" 
                    type="text" 
                    placeholder="11999999999" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} 
                    required={!isLogin}
                    maxLength={11}
                    className="cursor-text bg-background border-input hover:border-primary/50 focus:border-primary transition-colors relative z-20" 
                  />
                </div>
              </>
            )}
            
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