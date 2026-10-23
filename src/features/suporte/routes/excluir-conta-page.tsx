/* /excluir-conta — account-deletion URL Google Play requires (works without the app).
   The deletion itself is the delete-my-account function behind Perfil › Minha Conta. */
import { Link } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { PaginaPublica, Secao, SUPORTE_EMAIL, SUPORTE_WHATSAPP } from "../components/pagina-publica";

export default function ExcluirContaPage() {
  return (
    <PaginaPublica titulo="Excluir sua conta da Vant" sub="Vant · vantapp.com.br" Icone={Trash2}>
      <Secao t="Pelo app (na hora)">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Entre na sua conta no app da Vant.</li>
          <li>Toque em <strong>Perfil</strong> (barra de baixo) e depois em <strong>Minha Conta</strong>.</li>
          <li>Desça até o fim e toque em <strong>Excluir conta</strong>.</li>
          <li>Confirme. A conta é apagada na hora e você sai do app.</li>
        </ol>
        <p>
          Já está logado neste navegador? <Link to="/my-account" className="text-primary underline underline-offset-2">Abrir Minha Conta</Link>.
        </p>
      </Secao>
      <Secao t="Sem acesso ao app">
        <p>
          Mande um pedido pelo <a href={SUPORTE_WHATSAPP} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">WhatsApp</a> ou
          pelo e-mail <a href={`mailto:${SUPORTE_EMAIL}?subject=Excluir%20minha%20conta`} className="text-primary underline underline-offset-2">{SUPORTE_EMAIL}</a> com
          o CPF ou e-mail do cadastro. A gente confirma que a conta é sua e apaga em até 15 dias.
        </p>
      </Secao>
      <Secao t="O que é apagado">
        <p>Cadastro (nome, CPF, telefone, e-mail, cidade), foto, vendas, metas, relatórios, produtos e estoque, gastos, conversas com o mentor, posts e comentários na comunidade, posição no ranking e as conexões de banco (a Vant para de ler o banco na hora).</p>
      </Secao>
      <Secao t="O que fica guardado por um tempo">
        <p>Só o que a lei obriga: registros de acesso (6 meses, Marco Civil da Internet) e os comprovantes de pagamento da assinatura, que ficam com a Hotmart pelos prazos fiscais. Nada disso é usado pra outra coisa.</p>
      </Secao>
      <Secao t="Assinatura">
        <p>Excluir a conta não cancela a cobrança da Hotmart sozinho. Se você assina, cancele também pelo e-mail da Hotmart ou fale com a gente que cancelamos junto.</p>
      </Secao>
    </PaginaPublica>
  );
}
