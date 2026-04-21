import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus } from "lucide-react";
import orbisLogo from "@/assets/orbis-logo.png";
import { validateCPF, cpfToInternalEmail } from "@/utils/cpfValidation";
import { useBrazilCities } from "@/hooks/useBrazilCities";

type LoginMethod = "cpf" | "email";

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>("cpf");
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [loginEmail, setLoginEmail] = useState("");

  const BR_STATES = [
    "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
    "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
  ];

  const { cities, loading: loadingCities } = useBrazilCities(state);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate("/");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const resolveLoginEmail = async (): Promise<string> => {
    if (loginMethod === "cpf") {
      const cleanedCpf = cpf.replace(/\D/g, '');
      if (!cleanedCpf || cleanedCpf.length !== 11) {
        throw new Error("CPF deve conter 11 dígitos.");
      }
      if (!validateCPF(cleanedCpf)) {
        throw new Error("CPF inválido. Verifique os dígitos.");
      }
      return cpfToInternalEmail(cleanedCpf);
    } else {
      // Email login: sign in directly with the provided email
      const trimmed = loginEmail.trim().toLowerCase();
      if (!trimmed || !trimmed.includes("@")) {
        throw new Error("Informe um e-mail válido.");
      }
      return trimmed;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (password.length < 6) {
        throw new Error("A senha deve ter no mínimo 6 caracteres.");
      }

      if (isLogin) {
        const internalEmail = await resolveLoginEmail();
        const { error } = await supabase.auth.signInWithPassword({
          email: internalEmail,
          password,
        });
        if (error) {
          if (error.message.includes("Invalid login")) {
            throw new Error(loginMethod === "cpf" ? "CPF ou senha incorretos." : "E-mail ou senha incorretos.");
          }
          throw error;
        }
        toast({ title: "Login realizado!", description: "Bem-vindo de volta ao Orbis." });
        navigate("/", { replace: true });
      } else {
        // Signup - always requires CPF
        const cleanedCpf = cpf.replace(/\D/g, '');
        if (!cleanedCpf || cleanedCpf.length !== 11) {
          throw new Error("CPF deve conter 11 dígitos.");
        }
        if (!validateCPF(cleanedCpf)) {
          throw new Error("CPF inválido. Verifique os dígitos.");
        }
        if (name.length < 2) {
          throw new Error("Nome deve ter no mínimo 2 caracteres.");
        }
        const cleanedPhone = phone.replace(/\D/g, "");
        if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
          throw new Error("Informe um WhatsApp válido (DDD + número).");
        }
        if (!state) {
          throw new Error("Selecione o seu estado.");
        }
        if (city.trim().length < 2) {
          throw new Error("Informe a sua cidade.");
        }
        if (email && !email.includes("@")) {
          throw new Error("E-mail inválido.");
        }

        const internalEmail = cpfToInternalEmail(cleanedCpf);
        const trialStart = new Date().toISOString().split('T')[0];
        const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: {
            data: {
              nickname: name,
              cpf: cleanedCpf,
            },
          },
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered") || signUpError.message.includes("User already")) {
            throw new Error("Este CPF já possui uma conta no Orbis. Faça login.");
          }
          throw signUpError;
        }

        // Update profile with CPF, phone, email, location and trial info
        if (signUpData?.user) {
          await supabase.from("profiles").upsert({
            user_id: signUpData.user.id,
            nickname: name,
            cpf: cleanedCpf,
            phone: cleanedPhone,
            email: email.trim() || null,
            state,
            city: city.trim(),
            trial_start: trialStart,
            trial_end: trialEnd,
            is_trial_active: true,
            plan_status: "trial",
            plan_type: "trial",
          }, { onConflict: "user_id" });
        }

        toast({
          title: "Conta criada com sucesso! 🎉",
          description: "Bem-vindo ao Orbis! Você ganhou 3 dias de teste grátis.",
        });
        navigate("/", { replace: true });
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-black via-[#1A1A1A] to-black" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <div className="text-center mb-8">
        <div className="flex justify-center">
          <img src="/orbis-full-logo.png" alt="Orbis" className="w-56 object-contain" />
        </div>
      </div>

      <Card className="w-full max-w-md bg-card/50 backdrop-blur-sm border-primary/20 shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl font-bold text-foreground">
            {isLogin ? "Entre na sua conta" : "Crie sua conta gratuita"}
          </CardTitle>
          <CardDescription>
            {isLogin ? "Use seu CPF ou e-mail" : "Cadastre-se com seu CPF"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className="bg-background"
                />
              </div>
            )}

            {/* Login method toggle - only on login */}
            {isLogin && (
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setLoginMethod("cpf")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    loginMethod === "cpf"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  CPF
                </button>
                <button
                  type="button"
                  onClick={() => setLoginMethod("email")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    loginMethod === "email"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  E-mail
                </button>
              </div>
            )}

            {/* CPF field - always on signup, conditional on login */}
            {(!isLogin || loginMethod === "cpf") && (
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF (somente números)</Label>
                <Input
                  id="cpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="12345678900"
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                  required
                  maxLength={11}
                  className="bg-background"
                />
              </div>
            )}

            {/* Email field for login */}
            {isLogin && loginMethod === "email" && (
              <div className="space-y-2">
                <Label htmlFor="loginEmail">E-mail</Label>
                <Input
                  id="loginEmail"
                  type="email"
                  placeholder="seu@email.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="bg-background"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="bg-background"
              />
            </div>

            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp</Label>
                  <Input
                    id="phone"
                    type="text"
                    inputMode="numeric"
                    placeholder="11999999999"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    required
                    maxLength={11}
                    className="bg-background"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2 col-span-1">
                    <Label htmlFor="state">Estado</Label>
                    <select
                      id="state"
                      value={state}
                      onChange={(e) => { setState(e.target.value); setCity(""); }}
                      required
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="">UF</option>
                      {BR_STATES.map((uf) => (
                        <option key={uf} value={uf}>{uf}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="city">Cidade</Label>
                    <select
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      disabled={!state || loadingCities}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
                    >
                      <option value="">
                        {!state ? "Selecione o estado" : loadingCities ? "Carregando..." : "Selecione a cidade"}
                      </option>
                      {cities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background"
                  />
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full bg-primary text-black font-semibold hover:bg-black hover:text-primary hover:border hover:border-primary transition-all"
              disabled={isLoading}
            >
              {isLoading ? (
                "Carregando..."
              ) : isLogin ? (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Criar conta
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline bg-transparent border-none p-2"
            >
              {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
