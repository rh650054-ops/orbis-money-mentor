# Auditoria completa do Orbis — 15/08/2026

Varredura do código inteiro em cinco frentes paralelas: **segurança/backend**, **subsistema de IA**, **arquitetura do front**, **design/UX/acessibilidade** e **banco de dados**. Cada achado cita arquivo e linha reais. Nenhum arquivo foi alterado nesta auditoria — é diagnóstico.

Prioridade sugerida de ataque: **1) as três falhas de admin/dinheiro**, **2) o limite de gasto de IA quebrado**, **3) a bateria/esfera**, depois o resto.

---

## 🔴 CRÍTICO — mexer primeiro

### Segurança e privilégio

1. **Virar admin editando o próprio CPF.** O `is_orbis_admin()` decide quem é admin cruzando `profiles.cpf` (coluna que o usuário edita) com uma whitelist cujo CPF do dono está *hardcoded no git* (`20260619190000_super_admin.sql`, `20260616120000`). Quem souber o CPF do dono e tiver um perfil sem CPF ainda seta o próprio CPF uma vez e vira admin. O trava-CPF só chegou numa migration posterior e não cobre perfil com CPF nulo.
   - *Corrigir:* amarrar admin ao `auth.uid()` (coluna `user_id` em `admin_access`), não ao CPF. Usar `has_role`/`user_roles` como fonte única de verdade.

2. **`link-cpf-to-account/index.ts:18-21` — bypass pela chave mestra no header.** `x-admin-secret == SUPABASE_SERVICE_ROLE_KEY` libera troca de e-mail/CPF (tomada de conta). As funções irmãs (`admin-delete-user`, `admin-reset-password`) já removeram exatamente esse bypass; essa ficou pra trás.
   - *Corrigir:* apagar o caminho do `x-admin-secret`; usar o mesmo check JWT+admin das outras.

3. **`admin_reset_user_password` gera senha temporária fraca** (`20260620120000_admin_reset_password_rpc.sql:39`): `'Orbis' + random()*1000000 + '!'` → só 1 milhão de possibilidades, `random()` não-criptográfico, e a senha volta pela RPC. Combinado com o item 1, é tomada de conta de qualquer usuário.
   - *Corrigir:* `gen_random_bytes` (pgcrypto), auditar e limitar chamadas.

4. **`check-admin-access` grava billing num "check".** Numa chamada de leitura ele faz `profiles.update({is_demo, billing_exempt, plan_status:'active'})` baseado no CPF. Além do risco de privilégio, mistura leitura com escrita de faturamento.

### IA e custo

5. **Tabela `ai_usage` com dois esquemas conflitantes.** Duas migrations fazem `CREATE TABLE IF NOT EXISTS ai_usage` com colunas diferentes (`date/count` vs `dia/feature/count`). O `chat-with-ai` grava num formato e o `bump_ai_usage` no outro — só um funciona por deploy. Pior: `verificar-extrato` e `verificar-deposito` engolem o erro (`catch {}`) e **seguem rodando Claude vision sem nenhum limite diário**. Isso é dinheiro real vazando.
   - *Corrigir:* unificar num esquema (`user_id, dia, feature`), portar o `chat-with-ai` pro `bump_ai_usage`, e fazer extrato/depósito **falharem fechado** em vez de engolir.

6. **Modelos Claude inexistentes no chat principal** (`bright-action/index.ts:959-960`): defaults `claude-opus-5`/`claude-sonnet-5` não existem. Sem as env vars setadas, todo chat dá 400 e cai silenciosamente pro modelo grátis (Cerebras), que "inventa nome e escreve JSON no chat" — é a origem do bug dos adesivos que o código já tenta remendar. O `chat-with-ai` também tem `claude-sonnet-4-6` suspeito.
   - *Corrigir:* fixar IDs reais e atuais, centralizar num único lugar, e logar alto se o modelo retornar 404/400. **(Verificar contra a lista atual da Anthropic antes de fixar.)**

7. **Injeção de prompt via `nickname` no auditor que credita dinheiro.** `verificar-deposito` interpola o apelido do usuário (livre) direto no prompt anti-fraude cuja saída (`destino_confere`, `suspeito`) libera crédito automático na carteira. Um apelido malicioso pode tentar induzir a IA a aprovar comprovante forjado.
   - *Corrigir:* sanitizar/limitar o apelido, separar dados de instruções, e nunca deixar booleano da IA decidir pagamento — a checagem determinística (E2E único, teto, match do destino) é que manda.

### Banco / integridade financeira

8. **`daily_sales` ficou meses sem `UNIQUE(user_id,date)`** (removido em `20251028150730`, só recriado em `20260620210000`). Vários gravadores inseriram linhas duplicadas e o ranking **soma** tudo → faturamento público inflado. Mesma classe de bug do `challenge_blocks` (286 registrados vs ~115 reais). Auditar prêmios/ranking do período.

### Front (bugs de runtime)

9. **Corrida de dados entre usuários (sistêmico).** Dezenas de carregamentos assíncronos sem flag de cancelamento: trocar de conta no meio renderiza os dados do usuário anterior (History, Insights, Index, Finances, `useAIConversations` mostrando mensagens da conversa errada, etc.).

10. **Escritas que falham e mostram "sucesso".** Avatar (`Ranking.tsx:180`), criar produto/receita (`Products.tsx:277`), recusar X1 (`X1InvitePopup`), comentários — awaitam mas nunca checam `{error}`; toast de sucesso dispara mesmo com falha de RLS.

11. **`SpotMap.tsx:126` — mapa Leaflet nunca destruído.** Vaza mapa/tiles/listeners e joga "Map container is already initialized" numa rota quente.

### Design

12. **Esfera de partículas a 60fps o tempo todo** (`OrbisSphere.tsx` via o botão flutuante de chat, sempre visível): loop de `requestAnimationFrame` sem pausa, sem `IntersectionObserver`, sem respeitar `prefers-reduced-motion` nem economia de bateria. Fritа bateria e esquenta justo os Androids fracos do público de rua.
   - *Corrigir:* pausar com aba oculta/fora de tela, frame estático no FAB ocioso, respeitar reduced-motion.

13. **~299 cores fixas quebram o tema claro** (X1, Ranking, FAB do chat): texto branco some em fundo claro. O tema claro é feature que já existe e está ligável.

14. **og:image quebrado** (`index.html:22` → `/orbis-logo-share.png` não existe): todo compartilhamento no WhatsApp/Insta mostra preview em branco — ruim pra produto que cresce por indicação.

15. **Campos sem label na tela de login e no formulário de vendas** (`Auth.tsx`, `DailySalesForm.tsx`): inutilizável em leitor de tela e atrapalha o autofill de senha.

---

## 🟡 MÉDIO

- **Toda a arquitetura "Part A" (React Query) está montada mas 0% adotada** — nenhum `useQuery`/`useMutation` no app, skeletons e error boundaries de rota sem uso, `src/features/` vazio. É a *causa raiz* das corridas e escritas silenciosas acima. O ESLint ainda isenta a árvore legada, então o `preflight` não pega nada disso.
- **`register-user` público, sem rate limit** — criação em massa de contas/trials com `service_role`, sem CAPTCHA.
- **`estudio-arte` com `MODO_TESTE_LIBERADO=1` por padrão** — qualquer logado gera imagem (a mais cara do sistema, ~R$0,90 em qualidade `high`), até 30/dia, sem exigir assinatura.
- **`defcon-coach` sem contabilizar uso** — proxy de LLM sem `bump_ai_usage`, gasto por usuário sem teto.
- **Webhooks só com token estático** (Hotmart/Pluggy), sem assinatura HMAC; Pluggy aceita segredo na *query string* (`?secret=`), o lugar que mais vaza em log. Pluggy sem idempotência.
- **`listUsers({perPage:200})`** — a proteção anti-tomada-de-conta do `register-user` falha aberto assim que passa de 200 usuários (já tem 352 cadastrados).
- **`public_profiles` com 3 definições concorrentes** — uma delas (`fix_profiles_rls`) expõe instagram/whatsapp/cidade sem a máscara `show_*`.
- **UPDATE de perfil sem `WITH CHECK`** — usuário pode reatribuir `user_id` da própria linha; mesma falta em `daily_sales`, `leaderboard_stats`, `work_sessions`, etc.
- **`has_role` virou SECURITY INVOKER** — passa a mentir (retorna false) pra qualquer checagem que não seja o próprio uid.
- **`rate_limits` com policy `USING(true)`** — qualquer logado apaga/insere linhas, derrubando o próprio rate limiting.
- **Paywall duplicado** — `Layout` e `PaywallGate` montam `useTrialStatus/useSubscription/useAdminAccess` ao mesmo tempo → `check-admin-access` chamado várias vezes por load, e `useSubscription` faz *escrita* dentro de hook de leitura.
- **Refetch storms** — `loadAll()` após cada escrita pisca "Carregando" na lista inteira; handlers de realtime recarregam tudo a cada evento.
- **Vibração/timer repetidos** (`DefconX1Live`, `useX1DefconAlert`) por objeto novo a cada poll de 15s.
- **`incrementSold`/leaderboard write-back** não-transacionais, erros engolidos, corrida entre dispositivos.
- **Consentimento LGPD engolido** (`AceiteTermosModal:28`) — falha de rede deixa o modal nunca aparecer.
- **Arquivos gigantes** estourando o teto de LOC: Finances 3668, useDefconChallenge ~1475, Insights 1475, X1 1289, Products 1158.
- **`central-de-bugs.html` aponta pra um projeto Supabase diferente** e insere em `orbis_bugs` sem autenticação — investigar se é infra morta ou segundo ambiente.

---

## 🟢 MELHORIAS (irrefutáveis, mas menos urgentes)

- Cores/moeda formatadas na mão (`R$1234.50`, ponto em vez de vírgula) em vez de `formatCurrency`.
- Cópia de desenvolvedor vazando pro usuário: "Verifique Settings → Workspace → Usage" (`AIInsightsReport.tsx:47`).
- Português sem acento em texto visível (`FloatingChatButton`: "Referencia", "voce").
- `useState<any>`/`catch(any)` violando o A6 em vários pontos.
- Botão "Close" em inglês no dialog/sheet (app todo em PT); `ToastClose` sem label e invisível no touch.
- Ícone maskable do PWA sem safe-zone (Android corta o logo); manifest sem `lang:"pt-BR"`.
- Alvos de toque < 44px (switch, checkbox, back-button, chevrons).
- Overlay de chat em tela cheia não é focus trap (Tab escapa por trás).
- Skeletons existem mas ninguém usa — spinners no lugar (viola A7).
- Dois CPFs de "dono" diferentes hardcoded (PII no histórico do git); consolidar e tirar do SQL versionado.
- `_shared/orbis-brain.ts` é código morto; o editor "Cérebro da Orbis IA" edita `ai_brain`, que só o `chat-with-ai` lê — o chat real (`bright-action`) ignora, então o editor **não afeta o chat ao vivo**.
- `Ranking.tsx` ~70% código morto (`ConstanciaLeague`, aba semanal inalcançável).
- CORS `*` em endpoints autenticados/webhook — padronizar no `ALLOWED_ORIGIN`.
- Migrations escritas como "cole no SQL Editor" sugerem que o estado do repo pode não bater com o banco em produção — reconciliar com `list_migrations`.

---

## Os 3 piores, se for pra escolher

1. **Admin/dinheiro spoofável** — virar admin pelo CPF (item 1) + resetar senha de qualquer um com senha fraca (item 3). Tomada de conta completa.
2. **Limite de gasto de IA quebrado** (item 5) — extrato/depósito rodam Claude vision sem teto, com o erro engolido.
3. **Esfera 60fps sempre ligada** (item 12) — maior dano de bateria/calor no público-alvo, e é o fix de maior retorno visível.
