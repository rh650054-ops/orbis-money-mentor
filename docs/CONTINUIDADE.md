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
