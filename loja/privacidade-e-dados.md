# Privacidade — respostas pros formulários das lojas

Rascunho com base no código em 07/10/2026. **Conferir antes de enviar**: o
formulário é declaração sua, e informação errada dá remoção do app.

## Google Play › Segurança dos dados / Apple › Rótulos de privacidade

| Dado | Coleta? | Pra quê | Vinculado à pessoa | Compartilhado com terceiros |
|---|---|---|---|---|
| Nome | Sim | Conta, ranking | Sim | Não |
| E-mail | Sim | Conta, recuperar senha | Sim | Não (Resend só entrega o e-mail — é "prestador", não "compartilhamento") |
| Telefone | Sim | Contato/suporte | Sim | Não |
| CPF (identificador) | Sim | Login | Sim | Não |
| Informações financeiras (vendas, gastos, saldos) | Sim | Funcionalidade do app | Sim | Não |
| Dados bancários via Open Finance | Sim (Pro) | Ler entradas de Pix | Sim | Pluggy é prestador |
| Localização aproximada e precisa | Sim | Clima do ponto, pontos de venda, distância no Modo Foco | Sim | Não |
| Áudio (voz do mentor) | Sim, quando usa | Transcrever pergunta pro mentor de IA | Sim | Prestador de IA |
| Fotos (nota fiscal, arte) | Sim, quando usa | Ler nota, criar arte | Sim | Prestador de IA |
| Interações no app (telas, tempo) | Sim | Análise e melhoria (pulso) | Sim | Não |
| Diagnóstico/erros | Sim | Corrigir bugs | Sim | Não |
| **Compras** (histórico de compras — só no iPhone com o build `apple`, 27/11/2026) | Sim | Funcionalidade do app (liberar o plano comprado) | Sim (ligado à conta VANT pelo `appAccountToken`) | Não (a Apple processa o pagamento; não é "compartilhamento") |

### Apple › rótulos completos para o build `apple` (revisto em 27/11/2026)

Preencher em App Store Connect › App Privacy. Para todas as linhas: **Linked to You = Sim**,
**Used to Track You = Não**. Finalidade "App Functionality" salvo indicação.

| Categoria Apple | Tipo | Finalidade(s) | De onde vem no app |
|---|---|---|---|
| Contact Info | Name | App Functionality | cadastro, ranking |
| Contact Info | Email Address | App Functionality | conta, confirmação e recuperação de senha (Resend) |
| Contact Info | Phone Number | App Functionality | contato/suporte |
| Identifiers | User ID | App Functionality | id da conta e CPF usado no login |
| Financial Info | Other Financial Info | App Functionality | vendas, custos, metas, chave Pix, extratos e Open Finance (Pluggy) |
| Location | Precise Location | App Functionality | clima do ponto, Caça-Sinal, distância no Modo Foco |
| Location | Coarse Location | App Functionality | cidade do ponto (Nominatim) |
| User Content | Audio Data | App Functionality | voz do Mentor (só com o consentimento de IA) |
| User Content | Photos or Videos | App Functionality | foto de perfil, nota fiscal, comprovante, referência do Estúdio |
| User Content | Other User Content | App Functionality | mensagens ao Mentor, comunidade, anotações importadas |
| User Content | Customer Support | App Functionality | mensagens enviadas ao suporte |
| Purchases | Purchase History | App Functionality | assinatura Apple (só existe no build `apple`) |
| Usage Data | Product Interaction | Analytics, App Functionality | telas e tempo de uso ("pulso") |
| Diagnostics | Other Diagnostic Data | App Functionality | registros de erro para corrigir bugs |

Marcar **Não** em: Health & Fitness, Sensitive Info, Contacts, Browsing History, Search History,
Payment Info (a Apple processa o pagamento; não recebemos cartão), Device ID (o app não usa
identificador de publicidade nem de aparelho próprio — conferir de novo se entrar notificação push),
Crash Data (não há SDK de crash), Advertising Data, Emails or Text Messages, Gameplay Content.

Observações:
- Os dados enviados às IAs entram nas mesmas categorias acima (são "coletados" pela VANT e repassados
  a um prestador) e só saem com o consentimento de IA, que fica como está.
- As imagens do mapa vêm direto da OpenStreetMap para o aparelho (ela vê o IP). Não é um tipo de
  dado que a VANT coleta; está descrito na Política.
- Publicar os rótulos junto com o build `apple` (a linha "Purchases" só vale a partir dele).

- **Criptografia em trânsito:** Sim (HTTPS em tudo).
- **Pessoa pode pedir exclusão:** Sim — no app (Minha Conta) e em https://app.orbis.inf.br/excluir-conta.
- **Rastreamento entre apps (Apple ATT):** Não. Não precisamos pedir permissão de rastreamento.

## Google Play › Declaração de recursos financeiros
Marcar: **gestão financeira pessoal / de pequenos negócios** e **agregação de contas
(Open Finance)**. Não oferecemos empréstimo, investimento, cripto nem pagamento.

> Atenção ao X1 com depósito/saque (tabelas `x1_wallets`, `x1_deposit_requests`):
> carteira com dinheiro real entre usuários é tratada como pagamento ou aposta.
> No app da loja o X1 é só pontos (decidido em 22/10/2026): sem carteira, sem aposta, toda luta
> "na honra". Feito em `src/shared/lib/x1-loja.ts` (`x1SoPontos`); a web continua com dinheiro.

## Conta de teste pro revisor
As duas lojas exigem login funcionando. Ver `revisao-apple.md`.
