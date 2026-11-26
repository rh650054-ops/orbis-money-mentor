import { Link, useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();
  // Volta pra tela de onde ele veio. Antes era fixo em /auth, o que jogava
  // quem ja' estava logado direto na tela de login.
  const voltar = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <button type="button" onClick={voltar} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Política de Privacidade</h1>
            <p className="text-xs text-muted-foreground">Última atualização: 26 de novembro de 2026</p>
          </div>
        </div>

        <S t="1. Quem somos">
          <p>
            A <strong>Vant</strong> ("nós") é um aplicativo de gestão de vendas, metas e finanças para
            vendedores autônomos e ambulantes, disponível em <strong>vantapp.com.br</strong>. Esta
            política explica, em linguagem simples, quais dados pessoais tratamos, para quê, com quem
            compartilhamos e quais são os seus direitos, conforme a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018 — LGPD).
          </p>
          <p>
            Canal do encarregado de dados (DPO): <strong>suporte@vantapp.com.br</strong>.
          </p>
        </S>

        <S t="2. Dados que coletamos">
          <p><strong>No cadastro:</strong> nome/apelido, CPF, e-mail, telefone/WhatsApp, cidade e estado, e senha (armazenada de forma criptografada — nunca temos acesso à senha em texto).</p>
          <p><strong>No uso do app:</strong> registros de vendas, metas, custos, despesas, contas a pagar, produtos, insumos e estoque, rotinas de trabalho, participação em rankings e competições, e foto de perfil (opcional).</p>
          <p><strong>Financeiros (opcionais):</strong> chave Pix cadastrada por você para receber pagamentos; extratos bancários enviados por você ou obtidos via conexão bancária autorizada (Open Finance, pela Pluggy); movimentações da carteira X1.</p>
          <p><strong>Assistente de IA:</strong> as mensagens que você troca com o assistente da Vant, para gerar as respostas e conselhos.</p>
          <p><strong>Pagamento da assinatura:</strong> processado pela Hotmart. Não armazenamos números de cartão — recebemos da Hotmart apenas a confirmação do pagamento, e-mail e CPF do comprador para liberar seu acesso.</p>
          <p><strong>Técnicos:</strong> registros de acesso (logs), identificadores de dispositivo e dados de uso necessários à segurança e ao funcionamento.</p>
        </S>

        <S t="3. Para que usamos (finalidades e bases legais)">
          <p><strong>Prestar o serviço</strong> (execução de contrato): manter sua conta, calcular metas, custos, lucros e relatórios, operar rankings, competições e a carteira X1.</p>
          <p><strong>Conexão bancária e extratos</strong> (consentimento): só acontecem quando você autoriza expressamente; você pode desconectar a qualquer momento.</p>
          <p><strong>Funções de inteligência artificial</strong> (consentimento, art. 7º, I e art. 8º da LGPD): só com a sua autorização, dada numa caixa separada e desmarcada na tela de Termos ou em Minha Conta → Inteligência artificial. Sem ela, nenhum dado é enviado a provedores de IA e as demais funções do app continuam disponíveis. Você pode retirar a autorização a qualquer momento, no mesmo lugar; a partir daí nenhum novo envio é feito. Se mudarmos os provedores ou os dados enviados, a autorização anterior deixa de valer e pedimos uma nova antes de qualquer envio. Guardamos o histórico das suas respostas (data, versão do texto e escolha) como registro do consentimento.</p>
          <p><strong>Segurança e melhoria</strong> (legítimo interesse): prevenção de fraude (inclusive em competições), estabilidade e evolução do produto.</p>
          <p><strong>Obrigações legais:</strong> guarda de registros exigidos por lei (ex.: registros de acesso e de pagamento).</p>
        </S>

        <S t="4. Com quem compartilhamos (operadores)">
          <p>Não vendemos seus dados. Compartilhamos apenas com fornecedores que operam o serviço, sob contrato:</p>
          <p><strong>Supabase</strong> — banco de dados e autenticação. Os dados da Vant ficam hospedados em servidores na região de São Paulo, Brasil (AWS sa-east-1).</p>
          <p><strong>Vercel</strong> — hospedagem do site e do aplicativo web (EUA, com rede de distribuição global).</p>
          <p><strong>Provedores de inteligência artificial — somente se você autorizar</strong> (Minha Conta → Inteligência artificial). Cada função envia só o necessário para gerar a resposta:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Mentor (chat e voz)</strong>: o que você escreve ou fala, seu apelido e, quando você pergunta, suas vendas, estoque, finanças e ranking → Google (Gemini), Anthropic (Claude) e OpenAI (voz).</li>
            <li><strong>Dicas e relatórios do dia</strong>: vendas, meta, horários, produtos, custos e gastos → Anthropic, Google e Cerebras.</li>
            <li><strong>Mensagem do DEFCON</strong>: números da meta e das vendas do bloco → Anthropic, Google e Cerebras.</li>
            <li><strong>Dica do clima</strong>: cidade, meta, vendas do dia, melhores horários e contas a vencer (nome e valor) → Anthropic, Google e Cerebras. A previsão do tempo em si não usa IA.</li>
            <li><strong>Objetivo de lucro</strong>: seu apelido, vendas, calotes, produtos, estoque, custos, gastos e o movimento do banco (entradas no total e saídas por categoria, se o banco estiver conectado) dos últimos 60 dias → Anthropic, Google e Cerebras.</li>
            <li><strong>Leitura de nota fiscal</strong>: a foto da nota que você escolhe → Anthropic.</li>
            <li><strong>Raio-X e conferência de extrato</strong>: o arquivo do extrato que você envia (pode conter seu nome, banco e transações) e seu apelido → Anthropic e Google. O arquivo não é guardado.</li>
            <li><strong>Comprovante da carteira X1</strong>: a foto do comprovante Pix (valor, data, nomes e banco) → Anthropic.</li>
            <li><strong>Estúdio de Marca</strong>: o estilo descrito, o nome da banca e a foto de referência, se enviada → Google e OpenAI.</li>
          </ul>
          <p>CPF e senha nunca são enviados a provedores de IA. A verificação de fraude feita pela equipe só usa IA com os dados de quem autorizou.</p>
          <p><strong>Hotmart</strong> — processamento do pagamento da assinatura.</p>
          <p><strong>Pluggy</strong> — conexão bancária via Open Finance, somente quando você autoriza (Brasil, regulada pelo ecossistema do Banco Central).</p>
          <p><strong>Mercado Pago</strong> — processamento de depósitos e saques da carteira X1, quando você usa essa função.</p>
          <p><strong>Google</strong> — integração opcional com a sua agenda, somente se você conectar.</p>
        </S>

        <S t="5. Transferência internacional de dados">
          <p>
            Alguns operadores ficam fora do Brasil, nos Estados Unidos: Anthropic, OpenAI, Google (Gemini),
            Cerebras e Vercel. A transferência é amparada pelo art. 33 da LGPD por meio de garantias
            contratuais (termos comerciais de API e Adendos de Processamento de Dados). Sobre o uso dos
            dados pelos provedores de IA, segundo os termos de cada um:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Anthropic</strong>: não usa os dados enviados pela API para treinar seus modelos por padrão.</li>
            <li><strong>OpenAI</strong>: não usa entradas e saídas da plataforma de API para treinar ou melhorar seus modelos por padrão.</li>
            <li><strong>Google (Gemini)</strong>: na API paga, não usa os prompts e as respostas para melhorar seus produtos.</li>
            <li><strong>Cerebras</strong>: não retém as entradas e saídas dos serviços de inferência.</li>
          </ul>
          <p>Todo envio é feito por conexão criptografada (HTTPS), a partir dos servidores da Vant, e só o necessário para cada função.</p>
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
            com o encarregado: <strong>suporte@vantapp.com.br</strong>. Respondemos nos prazos da LGPD.
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
          <p>A Vant é destinada a maiores de 18 anos.</p>
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
