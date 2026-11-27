# Assinaturas Apple — da main até a primeira compra Sandbox no iPhone

Roteiro de execução (27/11/2026). **Nada aqui foi executado.** Cada passo marcado 🔒 precisa da
autorização específica do Rick. Detalhe técnico do deploy e do rollback:
`supabase/direitos-apple/README.md`. Nenhum segredo neste arquivo.

## 0. Estado conferido em 27/11/2026 (pelo git)

| PR | Branch | Commit | Base | Situação |
|---|---|---|---|---|
| #373 backend | `feat/apple-direitos-multi-provedor` | `ef15196` | `main` em `e69a2a3` | rascunho; a main não andou desde então, então entra sem conflito |
| #374 iPhone | `feat/apple-etapa3-storekit` | `3e34595` | `ef15196` (#373) | rascunho, empilhado |
| Etapa 4 (este) | `feat/apple-etapa4-loja` | — | `3e34595` (#374) | textos legais, notas, roteiro |
| #364 Pix | `feat/gerar-pix` | `f521327` | — | **não tocado** |

Não conferido nesta sessão (sem acesso à API do GitHub nem ao banco): status do CI no GitHub e o
estado atual de produção. Por isso o passo 2.1 começa rodando os dois.

## 1. Ordem do merge (PRs empilhados)

Recomendado: **de baixo para cima, com "Create a merge commit" (nunca squash)**.

1. 🔒 #373 → `main`. O site publica sozinho (Vercel), mas #373 não muda nada do app: só arquivos de
   `supabase/`. As migrações **não** rodam no merge; as funções **não** publicam no merge
   (`edge-functions.yml` só roda à mão).
2. Mudar a base do #374 para `main` (o GitHub faz isso sozinho se o branch do #373 for apagado no
   merge). Como foi merge commit, o #374 continua com os mesmos commits, sem rebase.
3. 🔒 #374 → `main`. O site muda só onde `VITE_COBRANCA_LOJA=apple` **e** iPhone: na web e no
   Android tudo segue `web`/`link` (provado em `cobranca-loja.test.ts`). O app do iPhone na loja não
   muda: só um build novo com a variável `apple` liga a compra.
4. 🔒 Etapa 4 → `main`. Põe no ar os Termos e a Política com a Apple (a Apple lê essas URLs na
   revisão, então elas precisam estar no ar antes do envio).

Por que não squash: o squash transforma os commits do #373 em um commit novo; o #374, que foi
construído em cima dos originais, passaria a "repetir" as mudanças e precisaria de rebase com
conflito em 87 arquivos. Alternativa se você preferir um link só (como de costume): eu junto as três
num PR único para a `main` — o resultado no código é idêntico; perde-se só a revisão separada.

## 2. Banco, funções e agendamento (antes de qualquer build `apple`)

### 2.1 Antes (somente leitura) — registrar a saída de cada um
- [ ] `npm run preflight && npm run test:sql && npm run drift` no commit de merge.
- [ ] `supabase/direitos-apple/fotografia-hotmart.sql` → guardar como **foto A**.
- [ ] `supabase/direitos-apple/comparar-antes-depois.sql` → esperado: **1** conta com diferença
      (banco adicional pago com plano principal bloqueado: `essencial_banco → sem_plano`) e **0**
      assinantes Hotmart com diferença. Qualquer outra diferença: parar.
- [ ] Impressões digitais das 18 funções (`casos/44`, F0) e das 2 de parceiros (`casos/50`)
      iguais às de produção. Se alguma mudou desde 27/11: regenerar a migração antes.

### 2.2 🔒 Migrações (uma janela só, nesta ordem)
`20261127120000` → `20261127121000` → `20261127122000` → `20261127123000`.

### 2.3 Depois das migrações (somente leitura)
- [ ] `comparar-antes-depois.sql` → **0** diferenças.
- [ ] `fotografia-hotmart.sql` → **foto B**. Iguais à foto A: contas, Hotmart por status, ativas
      com período valendo, cortesias, demos, teste gratuito, Pro ativos. `apple_tabelas_existem`
      passa a `true`. `assinantes_hotmart_sem_plano_ativo` não pode crescer.
- [ ] Um assinante Hotmart real (ex.: a conta do Rick, se for Hotmart) abre o app na web e no
      Android e continua com o mesmo plano e os mesmos bancos.

### 2.4 🔒 Chave da Apple (Rick, no painel — nunca no chat)
1. App Store Connect › Users and Access › Integrations › **In-App Purchase** › gerar chave.
   Baixar o `.p8` (só baixa uma vez), anotar o **Key ID** e o **Issuer ID** da mesma página.
2. Supabase › Edge Functions › Secrets: `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`,
   `APPLE_IAP_PRIVATE_KEY` (conteúdo inteiro do `.p8`, com as linhas BEGIN/END).
3. Conferir em App Store Connect › App Information que o **Apple ID** do app é `6838336105` e o
   Bundle ID é `app.vant.vendas` (os dois estão fixos em `_shared/apple/regras.ts`; diferente =
   toda transação recusada como `app_diferente`).

### 2.5 🔒 Funções (uma por vez)
Ordem: `apple-webhook`, `apple-conciliar`, `apple-validar`.

- **Corrigido nesta etapa:** o `edge-functions.yml` só desligava a verificação de JWT das funções
  do Pluggy. Publicada por ele, a `apple-webhook` iria com o portão ligado e **toda notificação da
  Apple levaria 401 antes de chegar ao código**. `apple-webhook` e `apple-conciliar` entraram em
  `SEM_JWT`, igual ao `supabase/config.toml`.
- **Limite do workflow:** o modo `publicar` exige que a função já exista (compara com a versão em
  produção). Para a **primeira** publicação de uma função nova, ele falha de propósito. Duas saídas:
  - (a) primeira publicação pela CLI, uma vez, do commit de merge:
    `supabase functions deploy apple-webhook --project-ref qbcsjsdwjjpybvzbxszi --no-verify-jwt`
    (idem `apple-conciliar`; `apple-validar` **sem** `--no-verify-jwt`), e em seguida rodar o
    workflow em `comparar` com o mesmo commit para provar que o publicado é o commit;
  - (b) acrescentar ao workflow um modo "estrear" (confere que a função não existe, publica, prova
    os bytes). Mais seguro a longo prazo, mas mexe no workflow de produção: só se você quiser.
  Recomendo (a) agora e (b) como pendência.
- Fumaça (sem tocar em conta, sem chamar a Apple): webhook com `{"signedPayload":"x"}` → 401
  `assinatura_invalida`; conciliar sem o cabeçalho do cron → 401, com ele → 200 e `com_apple: true`;
  validar sem sessão → 401.

### 2.6 🔒 Agendamento
Só depois da fumaça: o `cron.schedule('apple-conciliar-hora', '23 * * * *', …)` do README.

### 2.7 🔒 URL das notificações
App Store Connect › o app › App Information › **App Store Server Notifications**:
- Production Server URL e Sandbox Server URL: `https://qbcsjsdwjjpybvzbxszi.supabase.co/functions/v1/apple-webhook`
- Versão: **Version 2**.
A mesma URL serve aos dois ambientes: a função lê o ambiente de dentro do conteúdo assinado.
Prova: pedir uma notificação de teste pela App Store Server API (`POST /inApps/v1/notifications/test`)
ou, na falta dela, a primeira compra Sandbox (que gera `SUBSCRIBED`). O log da função mostra o tipo
do evento.

## 3. Produtos no App Store Connect

Contrato de apps pagos, banco e dados fiscais **Active** desde 27/11/2026: já dá para cadastrar. Os ids têm de ser **exatamente** estes
(conferidos em `_shared/apple/regras.ts` e `src/features/assinatura-apple/types.ts`). Um id criado
errado não pode ser reaproveitado: é outro produto.

| Grupo | Nível | Product ID | Nome de referência | Duração | Preço (Brasil) |
|---|---|---|---|---|---|
| VANT Planos | 1 | `app.vant.vendas.pro.anual` | Pro anual | 1 ano | R$ 419,90 |
| VANT Planos | 1 | `app.vant.vendas.pro.mensal` | Pro mensal | 1 mês | R$ 49,90 |
| VANT Planos | 2 | `app.vant.vendas.essencial.mensal` | Essencial mensal | 1 mês | R$ 29,90 |
| VANT Banco adicional | 1 | `app.vant.vendas.banco.mensal` | Banco adicional | 1 mês | R$ 12,90 |

- **Níveis:** na Apple o nível 1 é o mais alto. Pro mensal e Pro anual no mesmo nível = trocar entre
  eles vale na próxima renovação; Essencial → Pro é upgrade imediato (com crédito proporcional da
  Apple); Pro → Essencial vale na próxima renovação. O servidor não depende disso (o nível vem do
  produto), mas a tela de troca fica coerente.
- **Preço:** país base Brasil; disponibilidade **somente Brasil** (desmarcar os outros 174 países,
  senão a Apple gera preço em outras moedas).
- **Sem oferta introdutória/teste grátis da Apple.** O teste gratuito continua sendo o da VANT, no
  servidor. Um teste da Apple em cima dele daria dois testes seguidos e confundiria a revisão.
- **Family Sharing: desligado** (o acesso é da conta VANT, não da família).
- Localização pt-BR (nome ≤ 30, descrição ≤ 45 caracteres):
  - Essencial — "Controle e gestão das vendas"
  - Pro mensal / Pro anual — "Experiência completa da VANT"
  - Banco adicional — "Mais um banco conectado ao app"
  - Nome de exibição do grupo "VANT Planos": "Planos VANT"; do outro: "Banco adicional".
- Cada produto precisa de **print de revisão** (a tela de planos do build `apple`) e da nota:
  "Unlocks the plan in the VANT app for the account signed in. Test account in the App Review notes."
- Os produtos vão para a revisão **junto com o build** na primeira vez (seleção "In-App Purchases
  and Subscriptions" na versão).

## 4. 🔒 Testador Sandbox

App Store Connect › Users and Access › Sandbox › Test Accounts › "+":
- e-mail que **nunca** foi Apple ID (ex.: um alias novo do seu e-mail), país **Brasil**, senha forte
  guardada no gerenciador de senhas.
- No iPhone: Ajustes › App Store › **Conta Sandbox** (aparece depois de instalar um build de
  desenvolvimento ou do TestFlight). Não sair do Apple ID real.
- Compras no TestFlight não cobram nada e usam o ambiente Sandbox; as renovações são aceleradas
  (uma assinatura mensal renova a cada poucos minutos), o que permite testar renovação e expiração
  no mesmo dia.

## 5. Segunda conta de demonstração (para testar a compra)

**Por que precisa:** a `revisao.apple@vant.com.br` tem acesso de cortesia. Para o servidor, conta de
cortesia **não recebe oferta de compra** (`assinatura_apple_oferta` → motivo `cortesia`): o revisor
veria "Sua conta já tem acesso" e não conseguiria testar a assinatura. E compra **Sandbox só libera
acesso em conta registrada como conta de teste** (`apple_vale`). Como a revisão da Apple compra em
Sandbox, a conta que o revisor usar para comprar tem de estar registrada.

Passos:
1. 🔒 Criar a conta nova pelo app, como um cliente, pelo mesmo procedimento usado para a
   `revisao.apple` em 23/11 (e-mail sugerido: `revisao.compra@vant.com.br`). Sem cortesia
   (`billing_exempt`), sem `is_demo`, sem código de parceiro, sem Hotmart, sem cartão no CRM — a
   função de registro recusa conta com vida comercial.
2. Conferir (somente leitura):
   ```sql
   begin read only;
   select user_id, plan_status, billing_exempt, is_demo, origem_ref, is_trial_active, trial_end,
          termos_aceitos_versao
     from public.profiles where email in ('revisao.apple@vant.com.br', 'revisao.compra@vant.com.br');
   commit;
   ```
3. 🔒 Registrar (painel SQL, como admin, depois das migrações):
   ```sql
   select public.apple_conta_de_teste_registrar('<user_id da revisao.compra>',
     'Conta da revisão da Apple para testar a compra (27/11/2026)');
   ```
   Fazer o mesmo com a conta que você vai usar no seu iPhone para a primeira compra, se não for esta.
4. Dados de exemplo: lançar 2 ou 3 dias de vendas nela, para o revisor ver o app vivo depois de
   assinar. Ninguém aceita os Termos nela antes da Apple (mesma regra da `revisao.apple`).
5. A `revisao.apple` continua como está (cortesia, todas as funções visíveis). O campo "Sign-in
   required" do App Store Connect recebe a **`revisao.compra`** (é a que precisa logar para comprar);
   as notas citam as duas.

**Risco registrado (decisão sua, não implementei):** se o revisor criar uma conta própria e comprar
nela, a compra Sandbox não libera o acesso (a conta não está registrada) e isso pode virar recusa
por "a compra não funcionou". Alternativas:
- (a) manter como está e deixar claro nas notas qual conta usar — risco baixo, é o que a Apple
  costuma seguir;
- (b) liberar compra Sandbox em qualquer conta, só pelo período comprado e fora dos indicadores —
  some o risco de recusa, mas qualquer pessoa com TestFlight ganharia acesso sem pagar;
- (c) liberar Sandbox em qualquer conta **só enquanto a versão estiver em revisão** (uma chave
  ligada por você e desligada na aprovação) — fecha os dois buracos, custa uma etapa no envio.
Recomendo (a) na primeira submissão; se houver recusa por isso, (c).

## 6. Primeira compra Sandbox no iPhone — checklist

Pré-requisitos (todos verdes antes de abrir o app):
- [x] Contrato de apps pagos, dados fiscais e conta bancária **Active** (27/11/2026).
- [ ] Seções 2.2 a 2.7 feitas; foto B igual à foto A.
- [ ] 4 produtos criados com os ids exatos, status "Ready to Submit".
- [ ] Testador Sandbox criado e logado no iPhone; conta VANT registrada como conta de teste.
- [ ] 🔒 Build do TestFlight com `VITE_COBRANCA_LOJA_IOS=apple` (seção 7).

Compra:
1. [ ] Entrar na conta de teste. Tela de planos mostra os 3 planos com preço vindo da Apple
       (R$ 29,90 / R$ 49,90 / R$ 419,90), o anual com o total em destaque e "Equivale a R$ 34,99 por
       mês", texto de renovação automática, Restaurar, Termos e Privacidade.
2. [ ] Assinar Essencial → folha da Apple mostra "[Ambiente: Sandbox]" → confirmar.
3. [ ] App libera sozinho (`estado = liberada`). No banco: 1 linha em `apple_assinaturas`
       (`ambiente = Sandbox`), 1 em `apple_transacoes`, eventos em `apple_eventos` (`SUBSCRIBED`).
4. [ ] Indicadores e parceiros: nada muda (Sandbox fica fora; conferir com a foto C abaixo).
5. [ ] Trocar para Pro mensal (upgrade imediato) → plano vira Pro; transação antiga `substituida`.
6. [ ] Banco adicional em Conectar banco → compra no outro grupo; limite de bancos sobe.
7. [ ] Esperar uma renovação acelerada → `DID_RENEW` chega; `expira_em` avança.
8. [ ] Desligar a renovação em Gerenciar assinatura → `DID_CHANGE_RENEWAL_STATUS`; acesso segue até
       o fim do período e depois cai (o `apple-conciliar` da hora confirma).
9. [ ] Apagar e reinstalar o app → Restaurar compras → acesso volta na mesma conta.
10. [ ] Entrar com uma conta **Hotmart ativa** no mesmo iPhone → tela mostra "Seu plano está ativo",
        sem botão de compra (proteção contra contratação duplicada).
11. [ ] `fotografia-hotmart.sql` → **foto C**, igual à A/B nos números da Hotmart.

Se algo falhar: build sem a variável `apple` volta o app ao modo link; nenhum dado da Hotmart foi
tocado. Rollback completo no README.

## 7. 🔒 Próximo build

- Variável do repositório `VITE_COBRANCA_LOJA_IOS = apple`, rodar `ios-build.yml` a partir da `main`
  depois do merge da Etapa 4. O log mostra `iPhone billing mode: apple` e o `npx cap sync ios`
  tem de listar `vant-storekit`.
- Vai só para o TestFlight. **Não enviar para revisão** sem sua autorização.
- Para voltar: apagar a variável (ou `link`) e gerar outro build.

## 8. Etapa 4 — o que já dá para fechar enquanto a Apple processa o contrato

Feito neste branch:
- Termos de Uso, seção 4: assinatura pela Apple com os itens que a Apple exige (preço e período,
  cobrança na conta Apple ID, renovação automática e a janela de 24 h, como cancelar, reembolso pela
  Apple) e que excluir a conta não cancela a assinatura.
- Política de Privacidade: Apple como processadora do pagamento no iPhone e o que recebemos dela.
- Aviso da exclusão de conta no app: cancelar também nos Ajustes do iPhone.
- Rótulos de privacidade e notas ao revisor (arquivos ao lado).

**Não** subi a `TERMOS_VERSAO`: subir faria as 1.498 contas, inclusive todos os assinantes Hotmart,
aceitarem os Termos de novo no próximo acesso, por uma mudança que só acrescenta um meio de
pagamento. A data no topo muda; o aceite não. Se você preferir que todos re-aceitem, é uma linha.

Com o contrato ativo, o que falta do lado da Apple é tarefa sua no App Store Connect e pode começar já: produtos (§3), chave (§2.4) e testador (§4). A URL das notificações (§2.7) espera a `apple-webhook` publicada.
