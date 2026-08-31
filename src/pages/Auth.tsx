import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { LogIn, UserPlus, IdCard, Mail, KeyRound, User, Phone, MapPin } from "lucide-react";
import { validateCPF, cpfToInternalEmail } from "@/shared/lib/cpf-validation";
import { getReferralCode } from "@/shared/lib/checkout";
import { TERMOS_VERSAO } from "@/components/AceiteTermosModal";
import { useBrazilCities } from "@/shared/hooks/use-brazil-cities";

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
    // Conta recém-criada vai pro Onboarding 2.0 (flag setada antes do signUp);
    // login normal continua indo pro dashboard.
    const destino = () => (sessionStorage.getItem("orbis_signup_novo") === "1" ? "/onboarding-novo" : "/");
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate(destino());
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate(destino());
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
      // A conta é identificada por CPF (e-mail de login = CPF@orbis.internal).
      // Resolve o e-mail pessoal -> e-mail interno no servidor, conferindo a senha
      // junto (não vaza CPF nem permite enumerar e-mails).
      const { data: internalEmail, error } = await (supabase as any).rpc("resolve_login_email", {
        p_email: trimmed,
        p_password: password,
      });
      if (error || !internalEmail) {
        throw new Error("E-mail ou senha incorretos.");
      }
      return internalEmail as string;
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

        // 1 conta por pessoa: telefone e e-mail também são únicos (CPF já é único
        // pelo login interno). check_signup_available roda no servidor (ignora RLS)
        // e só diz QUAL campo já está em uso — sem expor dados de ninguém.
        const { data: takenField } = await supabase.rpc("check_signup_available", {
          p_phone: cleanedPhone,
          p_email: email.trim() || null,
        });
        if (takenField === "phone") {
          throw new Error("Já existe uma conta com esse telefone.");
        }
        if (takenField === "email") {
          throw new Error("Já existe uma conta com esse e-mail.");
        }

        const internalEmail = cpfToInternalEmail(cleanedCpf);
        const trialStart = new Date().toISOString().split('T')[0]!;
        const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

        sessionStorage.setItem("orbis_signup_novo", "1"); // → Onboarding 2.0 após criar
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: internalEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nickname: name, cpf: cleanedCpf, ref: getReferralCode() ?? undefined },
          },
        });

        if (signUpError) {
          if (signUpError.message.includes("already registered") || signUpError.message.includes("User already")) {
            throw new Error("Este CPF já possui uma conta no Orbis. Faça login.");
          }
          throw signUpError;
        }

        if (signUpData?.user) {
          const { error: profileError } = await supabase.from("profiles").upsert({
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
            // LGPD: o cadastro exibe e vincula Termos/Política; registra o aceite
            termos_aceitos_versao: TERMOS_VERSAO,
            termos_aceitos_em: new Date().toISOString(),
          } as never, { onConflict: "user_id" });
          // Garantia final: índices únicos no banco (cpf/phone/email). Se uma
          // corrida passar pela pré-checagem, o banco recusa o cadastro aqui.
          if (profileError) {
            if (profileError.code === "23505" || /duplicate|unique/i.test(profileError.message)) {
              throw new Error("Já existe uma conta com esse CPF, telefone ou e-mail.");
            }
            throw profileError;
          }
        }

        toast({
          title: "Conta criada! 🎉",
          description: "Bem-vindo ao Orbis. Você ganhou 3 dias de teste grátis.",
        });
        // Marca a conta como "Onboarding 2.0" (o Layout não mostra a missão antiga pra ela)
        if (signUpData?.user) {
          try { localStorage.setItem(`orbis_onboarding_novo_${signUpData.user.id}`, "1"); } catch { /* nada */ }
        }
        navigate("/onboarding-novo", { replace: true });
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
      className="relative min-h-[100dvh] flex flex-col overflow-hidden bg-background animate-fade-in"
      style={{
        paddingTop: "max(1.25rem, env(safe-area-inset-top))",
        paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
      }}
    >
      {/* Luz de marca no topo: um brilho dourado sutil — sem elemento, sem ruído.
          É o que separa "tela de template" de "tela da marca" sem poluir nada. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px]"
        style={{ background: "radial-gradient(460px 280px at 50% -60px, hsl(45 100% 48% / 0.13), transparent 70%)" }}
      />

      <div className="relative flex-1 flex items-center justify-center p-5">
        <div className="w-full max-w-[420px]">
          {/* Marca: logo maior, título do momento e a assinatura da casa */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <img
              src="/orbis-logo.png"
              alt="Orbis"
              className="w-20 h-20 object-contain animate-orbis-spin-in drop-shadow-[0_10px_28px_hsl(45_100%_48%_/_0.30)]"
            />
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {isLogin ? "Bem-vindo de volta" : "Crie sua conta"}
              </h1>
              <p className="text-sm text-muted-foreground">
                O copiloto de vendas do vendedor de rua
              </p>
            </div>
            {!isLogin && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary">
                3 dias grátis — sem pedir cartão
              </span>
            )}
          </div>

          <Card className="bg-card border border-border rounded-2xl shadow-xl">
            <CardContent className="p-5 sm:p-6">
              <form onSubmit={handleAuth} className="space-y-3.5">
                {/* Toggle CPF / E-mail (apenas no login) */}
                {isLogin && (
                  <div className="flex rounded-xl bg-muted p-1">
                    {([["cpf", "CPF"], ["email", "E-mail"]] as const).map(([m, label]) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setLoginMethod(m)}
                        className={`flex-1 h-9 text-sm font-medium rounded-lg transition-colors ${
                          loginMethod === m
                            ? "bg-primary text-primary-foreground shadow"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
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
                      className="h-11 rounded-xl border-border bg-input text-base focus-visible:border-primary focus-visible:ring-primary/20"
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
                      autoComplete="username"
                      placeholder="Apenas números"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value.replace(/\D/g, ""))}
                      required
                      maxLength={11}
                      className="h-11 rounded-xl border-border bg-input text-base focus-visible:border-primary focus-visible:ring-primary/20"
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
                      className="h-11 rounded-xl border-border bg-input text-base focus-visible:border-primary focus-visible:ring-primary/20"
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
                    className="h-11 rounded-xl border-border bg-input text-base focus-visible:border-primary focus-visible:ring-primary/20"
                  />
                </div>

                {/* Esqueci senha (só no login) — área de toque confortável */}
                {isLogin && (
                  <div className="flex justify-end -mt-1">
                    <Link
                      to="/forgot-password"
                      className="text-xs text-primary hover:underline py-2 px-1"
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
                        autoComplete="tel"
                        placeholder="DDD + número"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        required
                        maxLength={11}
                        className="h-11 rounded-xl border-border bg-input text-base focus-visible:border-primary focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="flex items-center gap-1.5 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-primary" />
                        Sua localização
                      </Label>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          aria-label="Estado (UF)"
                          value={state}
                          onChange={(e) => { setState(e.target.value); setCity(""); }}
                          required
                          className="col-span-1 h-11 rounded-xl border border-border bg-input px-3 text-base outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          <option value="">UF</option>
                          {BR_STATES.map((uf) => (
                            <option key={uf} value={uf}>{uf}</option>
                          ))}
                        </select>
                        <select
                          aria-label="Cidade"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          required
                          disabled={!state || loadingCities}
                          className="col-span-2 h-11 rounded-xl border border-border bg-input px-3 text-base outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
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
                        className="h-11 rounded-xl border-border bg-input text-base focus-visible:border-primary focus-visible:ring-primary/20"
                      />
                    </div>
                  </>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-base font-semibold mt-1 shadow-[0_8px_28px_-10px_hsl(45_100%_48%_/_0.55)]"
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
                      Começar meus 3 dias grátis
                    </>
                  )}
                </Button>

                {/* LGPD: aviso de aceite com links fixos no cadastro */}
                {!isLogin && (
                  <p className="text-xs text-muted-foreground text-center leading-relaxed mt-2">
                    Ao criar a conta, você concorda com os{" "}
                    <Link to="/termos" className="text-primary underline">Termos de Uso</Link> e a{" "}
                    <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
                  </p>
                )}
              </form>

              <div className="mt-5 pt-4 border-t border-border text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors py-2 px-3"
                >
                  {isLogin ? "Não tem conta? " : "Já tem conta? "}
                  <span className="text-primary font-semibold">
                    {isLogin ? "Cadastre-se" : "Entre"}
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Um fio de confiança embaixo — discreto, sem virar banner */}
          <p className="text-xs text-muted-foreground/70 text-center mt-4">
            Feito no Brasil pra quem vende na rua. Seus números são só seus.
          </p>
        </div>
      </div>
    </div>
  );
}
