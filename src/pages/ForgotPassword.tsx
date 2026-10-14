import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Card, CardContent } from "@/shared/ui/card";
import { useToast } from "@/shared/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateCPF } from "@/shared/lib/cpf-validation";
import { ArrowLeft, MessageCircle, IdCard, MailCheck, KeyRound, CheckCircle2, ShieldCheck } from "lucide-react";

const SUPPORT_WHATSAPP = "5511915054830";
type Passo = "cpf" | "codigo" | "senha" | "feito";
type Resp = { ok: boolean; desafio?: string; token?: string; erro?: string };

const ERROS: Record<string, string> = {
  codigo: "Código incorreto ou expirado. Depois de 5 erros ele para de valer: peça outro.",
  limite: "Muitas tentativas. Espere uns 15 minutos e tente de novo.",
  token: "O tempo pra trocar a senha acabou. Peça um código novo.",
  senha_curta: "A senha precisa ter pelo menos 8 caracteres.",
  senha_longa: "Senha longa demais. Use até 72 caracteres.",
  senhas_diferentes: "As duas senhas precisam ser iguais.",
  senha_recusada: "Essa senha não foi aceita. Tente outra mais forte.",
};

async function chamar(body: Record<string, string>): Promise<Resp> {
  const { data, error } = await supabase.functions.invoke("recuperar-senha", { body });
  if (error || !data) return { ok: false, erro: "indisponivel" };
  return data as Resp;
}

/**
 * "Esqueci minha senha" por código (Rick, 11/10/2026).
 * CPF → código de 6 dígitos no e-mail CONFIRMADO → senha nova. Tudo validado no
 * servidor (edge function recuperar-senha). A resposta do passo 1 é sempre igual,
 * exista ou não a conta. Nenhuma sessão é criada: depois de trocar, entra pelo login.
 * Sem e-mail confirmado: WhatsApp (o suporte confere a identidade).
 */
export default function ForgotPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [passo, setPasso] = useState<Passo>("cpf");
  const [cpf, setCpf] = useState("");
  const [desafio, setDesafio] = useState("");
  const [codigo, setCodigo] = useState("");
  const [token, setToken] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [espera, setEspera] = useState(0);

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  const erro = (codigoErro?: string) =>
    toast({ title: "Não deu", description: ERROS[codigoErro ?? ""] ?? "Tente de novo em instantes ou fale no WhatsApp.", variant: "destructive" });

  const openWhatsApp = () => {
    const msg = encodeURIComponent("Olá! Esqueci minha senha da Vant e não tenho e-mail confirmado. Meu nome é: ");
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}?text=${msg}`, "_blank");
  };

  const pedirCodigo = async () => {
    const limpo = cpf.replace(/\D/g, "");
    if (!validateCPF(limpo)) return toast({ title: "CPF inválido", description: "Confira os 11 dígitos.", variant: "destructive" });
    setLoading(true);
    const r = await chamar({ acao: "pedir", cpf: limpo });
    setLoading(false);
    if (!r.ok || !r.desafio) return erro(r.erro);
    setDesafio(r.desafio);
    setCodigo("");
    setEspera(60);
    setPasso("codigo");
  };

  const conferir = async () => {
    setLoading(true);
    const r = await chamar({ acao: "verificar", desafio, codigo: codigo.replace(/\D/g, "") });
    setLoading(false);
    if (!r.ok || !r.token) return erro(r.erro);
    setToken(r.token);
    setPasso("senha");
  };

  const salvar = async () => {
    if (senha.length < 8) return erro("senha_curta");
    if (senha !== confirmacao) return erro("senhas_diferentes");
    setLoading(true);
    const r = await chamar({ acao: "trocar", token, senha, confirmacao });
    setLoading(false);
    if (r.ok) {
      setSenha(""); setConfirmacao(""); setToken("");
      return setPasso("feito");
    }
    erro(r.erro);
    if (r.erro === "token") { setToken(""); setPasso("cpf"); }
  };

  const enviar = (fn: () => Promise<unknown>) => (e: React.FormEvent) => { e.preventDefault(); void fn(); };
  const campo = "h-11 rounded-lg bg-input";

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-5 bg-background animate-fade-in"
      style={{ paddingTop: "max(1.25rem, env(safe-area-inset-top))", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}>
      <div className="w-full max-w-[420px] space-y-5">
        <div className="flex flex-col items-center gap-3">
          <img src="/vant-logo.png" alt="Vant" className="w-14 h-14 object-contain animate-orbis-spin-in" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Recuperar senha</h1>
            <p className="text-xs text-muted-foreground mt-1">A gente te ajuda a voltar pra Vant</p>
          </div>
        </div>

        <Card className="bg-card border border-border rounded-2xl shadow-xl">
          <CardContent className="p-5 space-y-4">
            {passo === "cpf" && (
              <form onSubmit={enviar(pedirCodigo)} className="space-y-3">
                <Label htmlFor="cpf" className="flex items-center gap-1.5 text-xs"><IdCard className="w-3.5 h-3.5 text-primary" /> CPF da conta</Label>
                <Input id="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" value={cpf} onChange={(e) => setCpf(e.target.value)} required className={campo} />
                <p className="text-[11px] text-muted-foreground leading-relaxed">Mandamos um código de 6 dígitos pro e-mail que você confirmou no app.</p>
                <Button type="submit" disabled={loading} className="w-full h-12 rounded-lg font-semibold">{loading ? "Enviando..." : "Enviar código"}</Button>
              </form>
            )}

            {passo === "codigo" && (
              <form onSubmit={enviar(conferir)} className="space-y-3">
                <div className="flex gap-2.5 items-start">
                  <MailCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">Se esse CPF tiver um e-mail confirmado, o código chega em até 2 minutos (olhe o spam). Ele vale por 15 minutos.</p>
                </div>
                <Label htmlFor="codigo" className="text-xs">Código</Label>
                <Input id="codigo" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} required className={`${campo} text-center text-lg tracking-[.4em]`} />
                <Button type="submit" disabled={loading || codigo.length !== 6} className="w-full h-12 rounded-lg font-semibold">{loading ? "Conferindo..." : "Continuar"}</Button>
                <Button type="button" variant="ghost" disabled={loading || espera > 0} onClick={() => void pedirCodigo()} className="w-full h-10 text-xs">
                  {espera > 0 ? `Reenviar código em ${espera}s` : "Reenviar código"}
                </Button>
              </form>
            )}

            {passo === "senha" && (
              <form onSubmit={enviar(salvar)} className="space-y-3">
                <Label htmlFor="senha" className="flex items-center gap-1.5 text-xs"><KeyRound className="w-3.5 h-3.5 text-primary" /> Nova senha</Label>
                <Input id="senha" type="password" autoComplete="new-password" minLength={8} maxLength={72} placeholder="mínimo 8 caracteres" value={senha} onChange={(e) => setSenha(e.target.value)} required className={campo} />
                <Label htmlFor="confirmacao" className="text-xs">Confirme a senha</Label>
                <Input id="confirmacao" type="password" autoComplete="new-password" minLength={8} maxLength={72} value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} required className={campo} />
                <Button type="submit" disabled={loading} className="w-full h-12 rounded-lg font-semibold">{loading ? "Salvando..." : "Salvar nova senha"}</Button>
              </form>
            )}

            {passo === "feito" && (
              <div className="space-y-3 text-center py-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center"><CheckCircle2 className="w-6 h-6 text-primary" /></div>
                <p className="text-sm text-foreground font-semibold">Senha trocada!</p>
                <p className="text-xs text-muted-foreground">Por segurança, saímos da sua conta em todos os aparelhos. Entre com seu CPF e a senha nova.</p>
                <Button onClick={() => navigate("/auth", { replace: true })} className="w-full h-12 rounded-lg font-semibold">Ir pro login</Button>
              </div>
            )}

            {passo !== "feito" && (
              <Button type="button" variant="outline" onClick={openWhatsApp} className="w-full h-11 rounded-lg">
                <MessageCircle className="w-4 h-4 mr-2" /> Sem e-mail confirmado? WhatsApp
              </Button>
            )}
            <div className="flex items-center gap-2 justify-center text-[11px] text-muted-foreground"><ShieldCheck className="w-3.5 h-3.5" /> Ninguém vê sua senha, nem a gente</div>
          </CardContent>
        </Card>

        <button type="button" onClick={() => navigate("/auth")} className="flex items-center justify-center gap-1.5 w-full text-xs text-muted-foreground hover:text-primary transition-colors py-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
        </button>
      </div>
    </div>
  );
}
