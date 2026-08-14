import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ScrollText } from "lucide-react";

// Termos de Uso — URL fixa: /termos

const S = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-base font-bold text-foreground">{t}</h2>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </section>
);

export default function Termos() {
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
            <ScrollText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Termos de Uso</h1>
            <p className="text-xs text-muted-foreground">Última atualização: 28 de julho de 2026</p>
          </div>
        </div>

        <S t="1. Aceite">
          <p>
            Ao criar uma conta ou usar o <strong>Orbis</strong> (www.orbis.inf.br), você concorda com
            estes Termos de Uso e com a nossa{" "}
            <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
            Se não concordar, não use o serviço.
          </p>
        </S>

        <S t="2. O que é o Orbis">
          <p>
            Uma ferramenta de gestão para vendedores autônomos: metas diárias, registro de vendas e
            custos, estoque, finanças, rankings, competições e um assistente de IA. O Orbis é uma
            ferramenta de organização — <strong>não é consultoria financeira, contábil ou jurídica</strong>,
            e as sugestões do assistente de IA não substituem um profissional habilitado.
          </p>
        </S>

        <S t="3. Sua conta">
          <p>
            O cadastro exige CPF válido e dados verdadeiros. A conta é pessoal e intransferível; você
            é responsável por manter a senha em sigilo e por tudo que acontecer na sua conta. O Orbis
            é destinado a maiores de 18 anos.
          </p>
        </S>

        <S t="4. Assinatura e pagamento">
          <p>
            O acesso completo depende de assinatura paga, processada pela <strong>Hotmart</strong>.
            Renovação, cancelamento e reembolso seguem as regras e prazos da plataforma de pagamento
            e do plano contratado. O não pagamento na renovação suspende o acesso após o período de
            carência. O cancelamento pode ser feito pela própria Hotmart a qualquer momento.
          </p>
        </S>

        <S t="5. Regras de uso">
          <p>É proibido: fraudar rankings, competições ou extratos; usar a conta de terceiros; enviar conteúdo ilegal ou ofensivo na comunidade; tentar burlar a segurança do sistema; usar o serviço para atividades ilícitas. Violações podem levar à suspensão ou encerramento da conta, sem prejuízo das medidas legais.</p>
        </S>

        <S t="6. Carteira X1 e funções financeiras">
          <p>
            Depósitos e saques da carteira X1 são processados pelo <strong>Mercado Pago</strong> e
            seguem as regras exibidas no app. A conexão bancária (via Pluggy/Open Finance) e o envio
            de extratos são opcionais e só ocorrem com a sua autorização. Os valores, metas e
            relatórios exibidos dependem dos dados que você registra — confira sempre suas
            informações.
          </p>
        </S>

        <S t="7. Propriedade intelectual">
          <p>
            O Orbis, sua marca, layout e código pertencem aos seus titulares. Seus dados são seus:
            você pode exportá-los (ex.: CSV) e excluí-los quando quiser.
          </p>
        </S>

        <S t="8. Limitação de responsabilidade">
          <p>
            Trabalhamos para manter o serviço disponível e correto, mas ele é fornecido "como está".
            Na extensão permitida pela lei, não respondemos por lucros cessantes, decisões tomadas
            com base nos relatórios ou indisponibilidades causadas por terceiros (hospedagem,
            pagamento, conexão bancária). Nada nestes termos exclui direitos do consumidor previstos
            em lei.
          </p>
        </S>

        <S t="9. Encerramento">
          <p>
            Você pode excluir sua conta a qualquer momento em Minha Conta → Excluir minha conta — a
            exclusão é definitiva e apaga seus dados conforme a Política de Privacidade. Podemos
            encerrar contas que violem estes termos.
          </p>
        </S>

        <S t="10. Alterações e contato">
          <p>
            Podemos atualizar estes termos, indicando a data no topo e avisando mudanças relevantes
            no app. Lei aplicável: brasileira; foro do seu domicílio, quando você for consumidor.
            Dúvidas: <strong>rh650054@gmail.com</strong>.
          </p>
        </S>

        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          Veja também a <Link to="/privacidade" className="text-primary underline">Política de Privacidade</Link>.
        </p>
      </div>
    </div>
  );
}
