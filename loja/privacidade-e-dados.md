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

### Apple › o que muda nos rótulos com o build `apple` (27/11/2026)
- Acrescentar **Purchases › Purchase History**: *Data Linked to You*, finalidade **App
  Functionality**, **não** usado para rastreamento.
- Nada muda em "Financial Info": não recebemos cartão nem dados de pagamento da Apple.
- Continua: sem rastreamento entre apps, sem ATT.
- Os rótulos valem para o app na loja inteira: publicar a mudança junto com o build `apple`
  (antes dele o app não registra compras).

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
