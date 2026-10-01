/* Caixa da Vant — login próprio. Mesma conta do app (CPF + senha), mas só entra quem
   está em caixa_socios (Rick e Mohamed). A trava de verdade é o RLS no banco. */
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cpfToInternalEmail, validateCPF } from "@/shared/lib/cpf-validation";
import { VantLogo } from "./caixa-ui";

export default function CaixaLogin({ semAcesso, onSair }: { semAcesso?: boolean; onSair?: () => void }) {
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [indo, setIndo] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro("");
    const limpo = cpf.replace(/\D/g, "");
    if (!validateCPF(limpo)) { setErro("CPF inválido. Confere os números."); return; }
    if (senha.length < 6) { setErro("A senha tem pelo menos 6 caracteres."); return; }
    setIndo(true);
    const { error } = await supabase.auth.signInWithPassword({ email: cpfToInternalEmail(limpo), password: senha });
    setIndo(false);
    if (error) setErro("CPF ou senha incorretos.");
  };

  return (
    <div className="cx-login">
      <div className="cx-card">
        <div className="cx-logo" style={{ marginBottom: 18 }}>
          <VantLogo />
          <div><b>CAIXA DA VANT</b><br /><span>painel dos sócios</span></div>
        </div>
        {semAcesso ? (
          <>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Essa conta não tem acesso ao caixa.</p>
            <p className="cx-nota">Só o Rick e o Mohamed entram aqui. Se você é um dos dois, sai e entra com o seu CPF.</p>
            <button type="button" className="cx-btn" style={{ width: "100%", marginTop: 12 }} onClick={onSair}>Sair</button>
          </>
        ) : (
          <form className="cx-form" onSubmit={entrar}>
            <label><span className="lb">CPF</span>
              <input id="cx-cpf" inputMode="numeric" autoComplete="username" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </label>
            <label><span className="lb">Senha</span>
              <input id="cx-senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </label>
            {erro && <p className="cx-erro" role="alert">{erro}</p>}
            <button type="submit" className="cx-btn gold" disabled={indo}>
              {indo ? <Loader2 className="w-4 h-4 animate-spin inline" /> : "Entrar no caixa"}
            </button>
            <p className="cx-nota" style={{ marginTop: 0 }}>Mesma senha do app. Só sócios entram.</p>
          </form>
        )}
      </div>
    </div>
  );
}
