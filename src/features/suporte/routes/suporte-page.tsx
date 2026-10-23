/* /suporte — support URL the App Store requires. Public, no login. */
import { Link } from "react-router-dom";
import { LifeBuoy, Mail, MessageCircle } from "lucide-react";
import { PaginaPublica, Secao, SUPORTE_EMAIL, SUPORTE_WHATSAPP } from "../components/pagina-publica";

const botao = "w-full h-12 rounded-xl inline-flex items-center justify-center gap-2 text-sm font-bold";

export default function SuportePage() {
  return (
    <PaginaPublica titulo="Suporte da Vant" sub="A gente responde de segunda a sábado, das 9h às 18h" Icone={LifeBuoy}>
      <div className="space-y-2.5">
        <a href={SUPORTE_WHATSAPP} target="_blank" rel="noopener noreferrer" className={`${botao} bg-primary text-primary-foreground`}>
          <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
        </a>
        <a href={`mailto:${SUPORTE_EMAIL}`} className={`${botao} border border-border text-foreground`}>
          <Mail className="w-4 h-4" /> {SUPORTE_EMAIL}
        </a>
      </div>

      <Secao t="Esqueci minha senha">
        <p>Na tela de entrar, toque em <strong>Esqueci minha senha</strong>. Se o seu e-mail estiver confirmado, o link chega na hora. Se não chegar, chama a gente no WhatsApp com o CPF do cadastro.</p>
      </Secao>
      <Secao t="Assinatura">
        <p>A assinatura da Vant é feita pelo site <strong>vantapp.com.br</strong> (pagamento processado pela Hotmart). Pra cancelar, trocar de plano ou pedir reembolso, fale com a gente pelo WhatsApp ou e-mail acima.</p>
      </Secao>
      <Secao t="Excluir minha conta">
        <p>Dá pra excluir pelo próprio app. Veja o passo a passo em <Link to="/excluir-conta" className="text-primary underline underline-offset-2">Excluir conta</Link>.</p>
      </Secao>
      <Secao t="Documentos">
        <p>
          <Link to="/termos" className="text-primary underline underline-offset-2">Termos de Uso</Link>
          {" · "}
          <Link to="/privacidade" className="text-primary underline underline-offset-2">Política de Privacidade</Link>
        </p>
      </Secao>
    </PaginaPublica>
  );
}
