import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus, IdCard, Mail, KeyRound, User, Phone, MapPin } from "lucide-react";
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
        const cleanedCpf = cpf.replace(/\D/g, '');
        if (!cleanedCpf || cleanedCpf.length !== 11) throw new Error("CPF deve conter 11 dígitos.");
        if (!validateCPF(cleanedCpf)) throw new Error("CPF inválido. Verifique os dígitos.");
        if (name.length < 2) throw new Error("Nome deve ter no mínimo 2 caracteres.");
        const cleanedPhone = phone.replace(/\D/g, "");
        if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
          throw new Error("Informe um WhatsApp válido (DDD + número).");
        }
        if (!state) throw new Error("Selecione o seu estado.");
        if (city.trim().length < 2) throw new Error("Informe a sua cidade.");
        if (email && !email.includes("@")) throw new Error("E-mail inválido.");

        const internalEmail = cpfToInternalEmail(cleanedCpf);
        const trialStart = new Date().toISOString().split('T')[0];
        const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nickname: name, cpf: cleanedCpf },
          },
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered") || signUpError.message.includes("User already")) {
            throw new Error("Este CPF já possui uma conta no Orbis. Faça login.");
          }
          throw signUpError;
        }

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
          title: "Conta criada! 🎉",
          description: "Bem-vindo ao Orbis. Você ganhou 3 dias de teste grátis.",
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
    <div
      className="min-h-[100dvh] flex items-center justify-center p-5 bg-background animate-fade-in"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="w-full max-w-[420px] space-y-4">
        {/* Header com logo girando */}
        <div className="flex flex-col items-center gap-2">
          <img
            src="/orbis-logo.png"
            alt="Orbis"
            className="w-16 h-16 object-contain animate-orbis-spin-in"
          />
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">
              {isLogin ? "Entre no Orbis" : "Crie sua conta"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLogin ? "Use seu CPF ou e-mail" : "3 dias grátis pra começar"}
            </p>
          </div>
        </div>

        <Card className="bg-card border border-border rounded-2xl shadow-xl">
          <CardContent className="p-5">
            <form onSubmit={handleAuth} className="space-y-3">
              {/* Toggle CPF / E-mail (apenas no login) */}
              {isLogin && (
                <div className="flex rounded-lg bg-muted p-1">
                  <button
                    type="button"
                    onClick={() => setLoginMethod("cpf")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      loginMethod === "cpf"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground"
                    }`}
                  >
                    CPF
                  </button>
                  <button
                    type="button"
                    onClick={() => setLoginMethod("email")}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                      loginMethod === "email"
                        ? "bg-primary text-primary-foreground shadow"
                        : "text-muted-foreground"
                    }`}
                  >
                    E-mail
                  </button>
                </div>
              )}

              {/* Nome (signup) */}
              {!isLogin && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="flex items-center gap-1.5 text-xs">
                    <User className="w-3.5 h-3.5 text-primary" />
                    Nome completo
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-10 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                  />
                </div>
              )}

              {/* CPF */}
              {(!isLogin || loginMethod === "cpf") && (
                <div className="space-y-1.5">
                  <Label htmlFor="cpf" className="flex items-center gap-1.5 text-xs">
                    <IdCard className="w-3.5 h-3.5 text-primary" />
                    CPF
                  </Label>
                  <Input
                    id="cpf"
                    type="text"
                    inputMode="numeric"
                    placeholder="Apenas números"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                    required
                    maxLength={11}
                    className="h-10 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                  />
                </div>
              )}

              {/* E-mail (login) */}
              {isLogin && loginMethod === "email" && (
                <div className="space-y-1.5">
                  <Label htmlFor="loginEmail" className="flex items-center gap-1.5 text-xs">
                    <Mail className="w-3.5 h-3.5 text-primary" />
                    E-mail
                  </Label>
                  <Input
                    id="loginEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="h-10 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                  />
                </div>
              )}

              {/* Senha */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="flex items-center gap-1.5 text-xs">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  Senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  className="h-10 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>

              {/* Esqueci senha (só no login) */}
              {isLogin && (
                <div className="flex justify-end -mt-1">
                  <Link
                    to="/forgot-password"
                    className="text-[11px] text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
              )}

              {/* Campos extras do signup */}
              {!isLogin && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="flex items-center gap-1.5 text-xs">
                      <Phone className="w-3.5 h-3.5 text-primary" />
                      WhatsApp
                    </Label>
                    <Input
                      id="phone"
                      type="text"
                      inputMode="numeric"
                      placeholder="DDD + número"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                      required
                      maxLength={11}
                      className="h-10 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      Sua localização
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={state}
                        onChange={(e) => { setState(e.target.value); setCity(""); }}
                        required
                        className="col-span-1 h-10 rounded-lg border border-border bg-input px-3 text-sm focus:border-primary outline-none"
                      >
                        <option value="">UF</option>
                        {BR_STATES.map((uf) => (
                          <option key={uf} value={uf}>{uf}</option>
                        ))}
                      </select>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        required
                        disabled={!state || loadingCities}
                        className="col-span-2 h-10 rounded-lg border border-border bg-input px-3 text-sm focus:border-primary outline-none disabled:opacity-60"
                      >
                        <option value="">
                          {!state ? "Selecione UF" : loadingCities ? "Carregando..." : "Cidade"}
                        </option>
                        {cities.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="flex items-center gap-1.5 text-xs">
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      E-mail <span className="text-muted-foreground">(opcional, p/ recuperar senha)</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-10 rounded-lg border-border bg-input focus-visible:border-primary focus-visible:ring-primary/20"
                    />
                  </div>
                </>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold mt-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  "Carregando..."
                ) : isLogin ? (
                  <>
                    <LogIn className="w-4 h-4 mr-2" />
                    Entrar
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Criar conta
                  </>
                )}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-border text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {isLogin ? "Não tem conta? " : "Já tem conta? "}
                <span className="text-primary font-medium">
                  {isLogin ? "Cadastre-se" : "Entre"}
                </span>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
