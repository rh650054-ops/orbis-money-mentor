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
Essencial R$ 29,90/mês · Pro R$ 49,90/mês · Pro R$ 419,90/ano · Banco adicional R$ 12,90/mês ·
dois grupos · só Brasil · site e Android seguem Hotmart · assinantes e teste gratuito atuais
preservados · sem comissão automática sobre Apple nesta etapa · ajustes visuais do #374 aprovados
(total anual em destaque, botão sem logo da Apple).

## Etapa 4 (este branch)
- Termos (seção 4) e Política (pagamento e operadores) com a Apple; data 27/11/2026.
  `TERMOS_VERSAO` **não** foi subida (decisão a confirmar com o Rick).
- Exclusão de conta avisa para cancelar nos Ajustes do iPhone.
- `edge-functions.yml`: `apple-webhook` e `apple-conciliar` em `SEM_JWT`.
- `supabase/direitos-apple/fotografia-hotmart.sql`: foto rápida, só leitura, antes/depois.
- `loja/apple-assinaturas.md`: ordem de merge, deploy, chave, URL, produtos, Sandbox, segunda conta
  de demonstração, checklist da primeira compra, build.
- `loja/revisao-apple.md` e `loja/privacidade-e-dados.md`: notas e rótulos do build `apple`.

## Pendências e riscos abertos
1. Primeira publicação de função nova: o workflow não publica função inexistente (CLI uma vez, ou
   modo "estrear" no workflow).
2. Compra Sandbox só libera conta registrada como conta de teste: o revisor precisa usar a
   `revisao.compra`. Alternativas registradas em `loja/apple-assinaturas.md` §5.
3. Conferir Apple ID `6838336105` e bundle `app.vant.vendas` no App Store Connect.
4. Small Business Program não confirmado: a taxa estimada em `apple_taxas` é 25,73%; ao aderir,
   inserir uma linha nova com a data de vigência (o repasse real continua sendo a verdade).
5. Status do CI dos PRs e estado de produção não conferidos nesta sessão (sem acesso).

## App Store Connect
Contrato de apps pagos, conta bancária e formulários fiscais **ativos** (27/11/2026, 09:54).
Pendentes do lado do Rick: cadastrar produtos e grupos, gerar a chave In-App Purchase, criar o
testador Sandbox, confirmar a adesão ao Small Business Program.

## Fora de escopo agora
VANT Quick, widget, Constância 2.0, VANT Wall, Produtos, Estoque. Hotmart, Android, site e preços
não mudam.
