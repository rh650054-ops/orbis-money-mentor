# VANT — continuidade (sem segredos)

Atualizado em 27/11/2026. Leia isto antes de retomar a integração Apple.

## Assinaturas Apple (StoreKit 2, ponte própria, sem RevenueCat)

| Etapa | Branch / PR | Commit | Estado |
|---|---|---|---|
| 2 — backend | `feat/apple-direitos-multi-provedor` / #373 | `ef15196` | rascunho, base `main@e69a2a3` |
| 3 — iPhone | `feat/apple-etapa3-storekit` / #374 | `3e34595` | rascunho, empilhado no #373 |
| 4 — loja e textos | `feat/apple-etapa4-loja` | ver `git log` | empilhado no #374; PR a abrir |

Nada aplicado em produção: sem merge, sem migração, sem função publicada, sem build `apple`.
PR #364 (Pix, `feat/gerar-pix`) não foi tocado.

Últimos resultados da Etapa 3: 1.353 testes do app, 982 verificações SQL, 10/10 StoreKit,
preflight verde, drift sem divergência nova.

## Decisões aprovadas
Merge commit nos PRs empilhados · primeira publicação das 3 funções pela CLI · segunda conta
de revisão · Sandbox só em contas de teste · sem re-aceite geral dos Termos.

Essencial R$ 29,90/mês · Pro R$ 49,90/mês · Pro R$ 419,90/ano · Banco adicional R$ 12,90/mês ·
dois grupos · só Brasil · site e Android seguem Hotmart · assinantes e teste gratuito atuais
preservados · sem comissão automática sobre Apple nesta etapa · ajustes visuais do #374 aprovados
(total anual em destaque, botão sem logo da Apple).

## Etapa 4 (este branch)
- Termos (seção 4) e Política (pagamento e operadores) com a Apple; data 27/11/2026.
  `TERMOS_VERSAO` **não** foi subida (aprovado pelo Rick em 27/11: novos compradores veem os
  termos na tela de planos — "Ao assinar, você concorda com os Termos de Uso e a Política").
- Política revisada em 27/11: tirada a frase da verificação de fraude por IA (desligada desde 26/11),
  incluídos localização, Resend, clima e mapas (Open-Meteo, WeatherAPI, OpenStreetMap) e a guarda
  das transações da Apple sem vínculo com a conta. Consentimento de IA intocado.
- Rótulos de privacidade completos em `loja/privacidade-e-dados.md`.
- Exclusão de conta avisa para cancelar nos Ajustes do iPhone.
- `edge-functions.yml`: `apple-webhook` e `apple-conciliar` em `SEM_JWT`.
- `supabase/direitos-apple/fotografia-hotmart.sql`: foto rápida, só leitura, antes/depois.
- `loja/apple-assinaturas.md`: ordem de merge, deploy, chave, URL, produtos, Sandbox, segunda conta
  de demonstração, checklist da primeira compra, build.
- `loja/revisao-apple.md` e `loja/privacidade-e-dados.md`: notas e rótulos do build `apple`.

## Pendências e riscos abertos
1. Primeira publicação de função nova: o workflow não publica função inexistente (CLI uma vez, ou
   modo "estrear" no workflow).
2. Compra Sandbox só libera conta registrada como conta de teste (mantido, decisão de 27/11): o
   revisor precisa usar a `revisao.compra`; a `revisao.apple` fica como está.
3. Conferir Apple ID `6838336105` e bundle `app.vant.vendas` no App Store Connect.
4. Small Business Program: pedido enviado, aguardando a Apple. Até a confirmação vale a taxa
   estimada de 25,73% em `apple_taxas`; ao confirmar, inserir uma linha nova com a data de vigência.
5. Status do CI dos PRs e estado de produção não conferidos nesta sessão (sem acesso).

## App Store Connect
Contrato de apps pagos, conta bancária e formulários fiscais **ativos** (27/11/2026, 09:54).
Pendentes do lado do Rick: cadastrar produtos e grupos, gerar a chave In-App Purchase, criar o
testador Sandbox, confirmar a adesão ao Small Business Program.

## Fora de escopo agora
VANT Quick, widget, Constância 2.0, VANT Wall, Produtos, Estoque. Hotmart, Android, site e preços
não mudam.

## Implantação — registro (27/11/2026)
- 10:05 `comparar-antes-depois.sql` (leitura): 1.499 contas, **1** diferença (`essencial_banco → sem_plano`,
  a prevista), **0** dos 97 assinantes Hotmart com diferença. Planos hoje: sem_plano 1.312, teste 68,
  essencial 50, pro 42, equipe 22, pro_anual 3, essencial_banco 2.
- 10:05 **Foto A** (`fotografia-hotmart.sql`): contas 1.499; Hotmart active 88, past_due 9, expired 68,
  canceled 4; ativas com período valendo 96; plan_status active 118 / trial 915 / expired 466;
  assinantes Hotmart sem plano ativo 0; cortesias 22; demos 7; teste gratuito 68; Pro ativos 51;
  eventos Hotmart 24 h: 34 (último 02:52); tabelas Apple: não existem.
- Produção sem as 4 migrações (última aplicada: `20261126172147`).
- Merge do #373 bloqueado pelo controle de permissões da sessão; nada mais foi executado.

- 27/11 (Rick): Banco adicional cadastrado no mesmo grupo dos planos e **fora de venda no iPhone**
  (app `BANCO_APPLE_A_VENDA = false`; servidor `FORA_DE_VENDA` → `produto_fora_de_venda`, sem direito,
  só livro financeiro; oferta `banco: bloqueado`). Não entra na submissão. Hotmart intocada.
- 27/11: 3 planos cadastrados; 3 segredos da Apple no Supabase; testador Sandbox criado (Brasil);
  Small Business Program solicitado (taxa estimada segue 25,73%).

## Implantação em produção — 27/11/2026 (autorização do Rick, 11:22)
- 11:2x Merges na main com merge commit: #373 (`c3e739a`), #374 (`1e124c9`), #375 (`09b8962`). #364 intocado.
- 11:30 Conferência antes (leitura): 1.500 contas; 1 diferença prevista; 0 dos 97 assinantes Hotmart;
  impressões digitais das funções substituídas = produção (21/21 e 2/2).
- Migrações aplicadas: `20261127120000`, `20261127121000`, `20261127122000`.
- `20261127123000` **falhou sem aplicar nada**: a `parceiros_resumo` de produção tem `DEFAULT NULL`
  no parâmetro. Corrigido no PR #377 (assinatura apenas; corpo igual). Aguarda merge para aplicar.
- 11:45 Depois (leitura): **0 diferenças**; a conta prevista passou a `sem_plano`; foto B = foto das
  11:30 (Hotmart active 88 / past_due 9 / expired 68 / canceled 4; 96 com período valendo; 0
  assinantes Hotmart sem plano; cortesias 22; demos 7; teste 69; Pro 51); 4 cortesias Pro marcadas.
- As 49 funções aplicadas têm impressão digital igual à do repositório (banco de referência local).
- Funções publicadas como stub fixado em `09b8962`: `apple-webhook` v1 (sem JWT), `apple-conciliar` v1
  (sem JWT), `apple-validar` v1 (com JWT). Fumaça: 401 `assinatura_invalida`; 401 sem cron / 200 com
  cron e `com_apple: true`; 401 sem sessão.
- Agendamento `apple-conciliar-hora` (job 29, `23 * * * *`).
- Pendentes: migração 4 (após #377), URL de notificações no App Store Connect, conta `revisao.compra`
  e registro como conta de teste, variável `VITE_COBRANCA_LOJA_IOS=apple` e build.

## 27/11/2026 (tarde) — primeira compra Sandbox

- Conta de teste: teste.sandbox.rick@vant.com.br (sem cortesia, fora de ranking/CRM/MRR/comissões, autorizada para Sandbox). Build 13 no TestFlight.
- Compra Sandbox Essencial ~12:19: a Apple cobrou, a VANT mostrou "Não foi possível confirmar".
- Causa raiz: o runtime das Edge Functions (1.79.1, compat. Deno 2.1.4) não implementa `X509Certificate.verify/toString` de `node:crypto` e chama a curva de "p256"; a verificação da cadeia x5c falhava para toda transação real, e as notificações V2 recebiam 401.
- Correção (PR #378, incluída no PR do paywall): verificação com WebCrypto + leitor DER próprio, raiz Apple G3 fixada, cliente da App Store Server API com WebCrypto; o app não finaliza a transação quando o servidor recusa por erro interno e tenta de novo em 4s/12s/30s/60s.
- A compra das 12:19 continua não finalizada no iPhone e é reenviada pelo RecuperadorApple ao abrir o app, depois que as 3 funções forem republicadas fixadas no commit de merge.
- Paywall premium em tela cheia (fim do teste e toques em "assinar"); uso inline dentro de páginas mantido.
- Pendente: merge + publicar apple-webhook (verify_jwt false), apple-conciliar (false), apple-validar (true) fixadas no merge; build 14; Rick apagar a função apple-diagnostico-tmp e o branch diag/apple-webcrypto-tmp.
