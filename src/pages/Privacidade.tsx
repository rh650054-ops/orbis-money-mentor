import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

// Política de Privacidade (LGPD) — URL fixa: /privacidade
// Atualizar "Última atualização" a cada mudança relevante.

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-base font-bold text-foreground">{t}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </section>
);

export default function Privacidade() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <Link to="/auth" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Política de Privacidade</h1>
            <p className="text-xs text-muted-foreground">Última atualização: 28 de julho de 2026</p>
          </div>
        </div>

        <S t="1. Quem somos">
          <p>
            O <strong>Orbis</strong> ("nós") é um aplicativo de gestão de vendas, metas e finanças para
            vendedores autônomos e ambulantes, disponível em <strong>www.orbis.inf.br</strong>. Esta
            política explica, em linguagem simples, quais dados pessoais tratamos, para quê, com quem
            compartilhamos e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018 — LGPD).
          </p>
          <p>
            Canal do encarregado de dados (DPO): <strong>rh650054@gmail.com</strong>.
          </p>
        </S>

        <S t="2. Dados que coletamos">
          <p><strong>No cadastro:</strong> nome/apelido, CPF, e-mail, telefone/WhatsApp, cidade e estado, e senha (armazenada de forma criptografada — nunca temos acesso à senha em texto).</p>
          <p><strong>No uso do app:</strong> registros de vendas, metas, custos, despesas, contas a pagar, produtos, insumos e estoque, rotinas de trabalho, participação em rankings e competições, e foto de perfil (opcional).</p>
          <p><strong>Financeiros (opcionais):</strong> chave Pix cadastrada por você para receber pagamentos; extratos bancários enviados por você ou obtidos via conexão bancária autorizada (Open Finance, pela Pluggy); movimentações da carteira X1.</p>
          <p><strong>Assistente de IA:</strong> as mensagens que você troca com o assistente do Orbis, para gerar as respostas e conselhos.</p>
          <p><strong>Pagamento da assinatura:</strong> processado pela Hotmart. Não armazenamos números de cartão — recebemos da Hotmart apenas a confirmação do pagamento, e-mail e CPF do comprador para liberar seu acesso.</p>
          <p><strong>Técnicos:</strong> registros de acesso (logs), identificadores de dispositivo e dados de uso necessários à segurança e ao funcionamento.</p>
        </S>

        <S t="3. Para que usamos (finalidades e bases legais)">
          <p><strong>Prestar o serviço</strong> (execução de contrato): manter sua conta, calcular metas, custos, lucros e relatórios, operar rankings, competições e a carteira X1.</p>
          <p><strong>Conexão bancária e extratos</strong> (consentimento): só acontecem quando você autoriza expressamente; você pode desconectar a qualquer momento.</p>
          <p><strong>Assistente de IA</strong> (execução de contrato): suas mensagens e dados de contexto necessários são processados para gerar respostas personalizadas.</p>
          <p><strong>Segurança e melhoria</strong> (legítimo interesse): prevenção de fraude (inclusive em competições), estabilidade e evolução do produto.</p>
          <p><strong>Obrigações legais:</strong> guarda de registros exigidos por lei (ex.: registros de acesso e de pagamento).</p>
        </S>

        <S t="4. Com quem compartilhamos (operadores)">
          <p>Não vendemos seus dados. Compartilhamos apenas com fornecedores que operam o serviço, sob contrato:</p>
          <p><strong>Supabase</strong> — banco de dados e autenticação. Os dados do Orbis ficam hospedados em servidores na região de São Paulo, Brasil (AWS sa-east-1).</p>
          <p><strong>Vercel</strong> — hospedagem do site e do aplicativo web (EUA, com rede de distribuição global).</p>
          <p><strong>Anthropic</strong> — processamento das conversas do assistente de IA (EUA). Veja a seção 5 sobre transferência internacional.</p>
          <p><strong>Hotmart</strong> — processamento do pagamento da assinatura.</p>
          <p><strong>Pluggy</strong> — conexão bancária via Open Finance, somente quando você autoriza (Brasil, regulada pelo ecossistema do Banco Central).</p>
          <p><strong>Mercado Pago</strong> — processamento de depósitos e saques da carteira X1, quando você usa essa função.</p>
          <p><strong>Google</strong> — integração opcional com a sua agenda, somente se você conectar.</p>
        </S>

        <S t="5. Transferência internacional de dados">
          <p>
            Alguns operadores estão localizados fora do Brasil, principalmente nos Estados Unidos
            (Anthropic e Vercel). Nesses casos, a transferência é amparada pelo art. 33 da LGPD por
            meio de garantias contratuais: o tratamento pela Anthropic é regido pelos seus termos
            comerciais, que incorporam um Adendo de Processamento de Dados (DPA) com Cláusulas
            Contratuais Padrão, e a Anthropic não utiliza os dados enviados pela API para treinar
            seus modelos por padrão. Enviamos à IA somente o necessário para gerar as respostas.
          </p>
        </S>

        <S t="6. Por quanto tempo guardamos">
          <p>
            Enquanto sua conta estiver ativa. Ao excluir a conta (você mesmo pode fazer isso em
            Minha Conta → Excluir minha conta), apagamos seus dados pessoais de todas as tabelas do
            aplicativo. Podemos reter registros mínimos exigidos por lei (como logs de acesso e
            comprovantes de pagamento) pelos prazos legais aplicáveis.
          </p>
        </S>

        <S t="7. Seus direitos (art. 18 da LGPD)">
          <p>
            Você pode, a qualquer momento: confirmar se tratamos seus dados; acessá-los; corrigi-los
            (diretamente no app, em Minha Conta); pedir anonimização, bloqueio ou eliminação;
            solicitar portabilidade; saber com quem compartilhamos; revogar consentimentos (ex.:
            desconectar o banco); e excluir sua conta pelo próprio app. Para qualquer pedido, fale
            com o encarregado: <strong>rh650054@gmail.com</strong>. Respondemos nos prazos da LGPD.
          </p>
        </S>

        <S t="8. Segurança">
          <p>
            Usamos criptografia em trânsito (HTTPS), controle de acesso por linha no banco de dados
            (cada usuário só acessa os próprios dados), senhas com hash e acesso administrativo
            restrito. Nenhum sistema é 100% infalível; em caso de incidente relevante, comunicaremos
            você e a ANPD conforme a lei.
          </p>
        </S>

        <S t="9. Cookies e armazenamento local">
          <p>
            Usamos armazenamento local do navegador para manter sua sessão e preferências (ex.: tema
            e modelos de mensagem). Não usamos cookies de publicidade de terceiros.
          </p>
        </S>

        <S t="10. Crianças e adolescentes">
          <p>O Orbis é destinado a maiores de 18 anos.</p>
        </S>

        <S t="11. Alterações desta política">
          <p>
            Podemos atualizar esta política e indicaremos a data no topo. Mudanças relevantes serão
            avisadas no app. O uso continuado após a atualização indica ciência do novo texto.
          </p>
        </S>

        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          Veja também os <Link to="/termos" className="text-primary underline">Termos de Uso</Link>.
        </p>
      </div>
    </div>
  );
}
