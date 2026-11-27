# Notas pro revisor (App Review / Play)

Colar no campo "Notes" do App Store Connect (e em "Instruções de acesso" no Play Console).
A conta e a senha vão nos campos próprios de "Sign-in required" (Apple) e
"Instruções de acesso" (Google), não no texto abaixo.

---

VANT is a sales and money-management app for street vendors in Brazil (people who
sell at traffic lights, beaches and events). The UI is in Brazilian Portuguese.

Demo account: on the login screen tap "E-mail" (next to "CPF") and use the account and
password provided in the sign-in fields (App Store: revisao.apple@vant.com.br · Google Play:
revisao@vantapp.com.br). It has an active subscription and sample data, so every feature is
visible without paying.

How to test the core flow:
1. Bottom bar "Foco" > "Iniciar DEFCON 4" > "Começar". This is the main feature: a
   timer split into 1-hour blocks; tap "+ Venda" to register a sale, "Abordagem" to
   count a customer approached. "Encerrar" ends the day and shows the summary.
2. "Vender" (center button) shows today's sales and products.
3. "Relatório" shows the day, week and month (sales, costs, profit, best hours).
4. "Dashboard" > "Financeiro" > "Ver detalhes" shows income, costs and margin.
5. "Perfil" > "Minha Conta" holds personal data and "Excluir conta" (account deletion,
   immediate). The same steps are public at https://app.vantapp.com.br/excluir-conta.
6. Ranking and "X1" (head-to-head challenge) use points only. No money is deposited,
   wagered or paid out inside the app.
7. Bank connection (Open Finance, via Pluggy) needs a real Brazilian bank account,
   so it is not connected in the demo account. It is optional.

Purchases: the app does not sell anything and shows no prices. When an account has
no active subscription it shows "Assinatura inválida" with a button that opens our
website (app.vantapp.com.br/assinar) in the system browser, where the subscription
is purchased. Users who already subscribe just log in.

Permissions: location (optional, "Caça-Sinal" and local weather: suggests nearby
selling spots), microphone (only when the user taps to talk to the AI mentor),
camera/photos (profile picture and receipts).

AI features and consent (Guidelines 5.1.1(i) and 5.1.2(i)):
- Right after the first login the app shows "Seus dados, com transparência". It has a separate
  section "INTELIGÊNCIA ARTIFICIAL" that names the two recipients (Anthropic and OpenAI) and the
  kinds of data sent, a link "Ver o que é enviado e pra quem" (each feature,
  the data it sends and to which company), and a checkbox that is UNCHECKED by default:
  "Autorizo a VANT a enviar meus dados a essas empresas de IA pra usar essas funções."
- Nothing is sent to any AI service unless that box is checked. The rule is enforced on our
  server, not only in the app. Tapping "Concordo e continuar" without checking the box keeps the
  whole app working, with the AI features off.
- The choice can be changed at any time in "Perfil" > "Minha Conta" > "INTELIGÊNCIA ARTIFICIAL" >
  "Usar IA na VANT".
- With this build the screen appears on the first login of the demo account.
- Privacy policy: https://app.vantapp.com.br/privacidade (updated 26/11/2026).

Support: https://app.vantapp.com.br/suporte · suporte@vantapp.com.br

---

## Notas para o build com assinatura Apple (`VITE_COBRANCA_LOJA_IOS=apple`, 27/11/2026)

Com esse build, o parágrafo "Purchases" acima **sai** e entra este (colar em inglês). Contas: ver
`apple-assinaturas.md` §5 — `revisao.compra@vant.com.br` no campo "Sign-in required".

> Purchases (Guidelines 3.1.1 and 3.1.2): on iPhone the subscriptions are sold only through In-App
> Purchase. There is no link to an external purchase and no other payment method in this build.
>
> To test a purchase, sign in with the account in the sign-in fields (revisao.compra@vant.com.br).
> It has no paid plan: while its free trial runs, open "Vender" and tap "Ver planos"; when the
> trial is over, the plans screen ("Eleve o nível das suas vendas.") opens by itself. Plans: Essencial (monthly),
> Pro (monthly) and Pro (annual), one subscription group. The screen shows
> the price and period from the App Store, the auto-renewal terms, "Restaurar compras", and links to
> the Terms of Use (https://app.vantapp.com.br/termos) and Privacy Policy
> (https://app.vantapp.com.br/privacidade). After the purchase the plan is unlocked automatically;
> "Gerenciar assinatura na Apple" opens the subscription management.
>
> To see every feature without buying, use the second account revisao.apple@vant.com.br (password
> in the notes field below): it has complimentary access, so it shows "Sua conta já tem acesso"
> instead of the plans.
>
> Customers who already subscribe on our website keep their access when they sign in; the app does
> not offer them a second subscription.

Conferir no TestFlight, antes de colar: o caminho "Vender" › "Ver planos" existe para a
`revisao.compra` durante o teste (é a vitrine do Pro). Se não aparecer, trocar a frase pelo caminho
real.

Campo de senha da segunda conta: colocar a senha da `revisao.apple` no fim das notas (o campo
"Sign-in required" só aceita uma conta).

## Antes de enviar
- [x] Conta demo `revisao@vantapp.com.br` com Pro de cortesia, fora do ranking e 3 semanas de dados (23/10/2026)
- [x] Nada no app da loja mostra preço nem checkout (modelo Néctar, 23/10/2026); o botão "Assinar" abre o site
- [x] X1: só pontos no app da loja (22/10/2026, `x1-loja.ts`) — sem carteira nem aposta
- [x] Páginas públicas /suporte e /excluir-conta (23/10/2026)
- [ ] Testar excluir conta numa conta descartável
- [x] Textos de permissão em português no iPhone (localização, microfone, câmera, fotos) — conferido 23/10/2026

## Reenvio depois da recusa de 26/11 (5.1.1(i) / 5.1.2(i))

### O que mudou em 26/11
- Consentimento de IA por versão do texto, conferido no servidor (migração
  `20261126160000_consentimento_ia_versao`). Sem "Permitir" num texto que vale, nenhuma função
  envia dado a IA.
- **Só dois provedores de IA (decisão do Rick): Anthropic e OpenAI.** A Anthropic é a primeira em
  todo texto, análise, recomendação, Mentor, Missão de Lucro e Coach. A OpenAI faz a voz do Mentor
  (ouvir e falar), as imagens do Estúdio de Marca e é a reserva em texto e leitura de documento.
  Google (Gemini), Cerebras e a voz do Edge (Microsoft) saíram de todas as funções.
- Texto de divulgação `2026-11-28`: cita só os dois provedores e ganhou a linha "Importar
  histórico". Quem autorizou o texto `2026-11-27` **não é perguntado de novo** (tudo que
  autorizou continua igual ou diminuiu); para essa pessoa a OpenAI não entra como reserva de texto
  e a importação de histórico pede a autorização quando ela usa.
- "Importar histórico" (`import-financial-pdf`) existia só em produção, mandava o arquivo ao
  Gemini e não conferia o consentimento. Entrou no repositório com o portão.
- `smooth-worker` (cópia antiga dos relatórios, só em produção, Gemini sem portão): aposentada.
- A análise de bug por IA (`analisar-bug`) está desligada.
- A `verificar-deposito` não é republicada: em produção ela é a versão fechada do X1 (não usa IA)
  e a main ainda tem o leitor antigo (PR #111 em aberto).

### Checklist final (nesta ordem)
1. [ ] PR desta rodada na main e site no ar (a política cita só Anthropic e OpenAI).
2. [ ] Funções republicadas, fixadas no commit da main: bright-action, generate-insights,
       objetivo-lucro-ia, verificar-extrato, extrato-analisar, nota-ler, estudio-arte, defcon-coach,
       clima-vendedor, analisar-anomalia, analisar-bug, import-financial-pdf, smooth-worker.
3. [ ] Teste real com a conta de teste do Google (`revisao@vantapp.com.br`), devolvida ao estado
       original depois: sem autorização nada sai; texto de 27/11 libera a Anthropic e bloqueia a
       importação; texto atual libera tudo; recusa e revogação bloqueiam na hora. Conferir na
       conta da OpenAI quais modelos de texto e de transcrição a chave aceita.
4. [ ] **Apagar no painel do Supabase os segredos `GEMINI_API_KEY` e `CEREBRAS_API_KEY`** (e os
       `GEMINI_*`/`CEREBRAS_*`/`EDGE_TTS_*` que existirem). Sem a chave, nenhuma função, nem uma
       antiga esquecida, consegue chamar esses provedores. Só o Rick consegue fazer.
5. [ ] **Build novo do iOS (12), gerado da main depois do passo 1.** Os builds 10 e 11 carregam
       textos antigos de divulgação: não servem.
6. [ ] No TestFlight, com uma conta que NÃO seja a da Apple: a tela "Seus dados, com
       transparência" aparece com a caixa de IA desmarcada e cita só Anthropic e OpenAI; aceitar
       sem marcar deixa a IA desligada; marcar liga; Perfil > Minha Conta > "Usar IA na VANT"
       desliga e liga de novo; o Mentor ouve e fala.
7. [ ] Conta do App Store Connect: **`revisao.apple@vant.com.br`** (as sessões dela vêm da rede
       da Apple, 17.x.x.x, em iPhone; a `revisao@vantapp.com.br` é a do Google Play). Conferir no
       campo "App Review Information" que é essa mesma. Estado dela em 26/11: assinatura ativa,
       Pro, Termos e IA respondidos no texto de 23/11. Com o build novo ela vê a tela de Termos
       com a caixa de IA desmarcada. **Não precisa zerar nada.**
8. [ ] Ninguém entra na conta da Apple com o build novo antes da Apple. Se alguém aceitar os
       Termos nela, a tela não aparece mais para o revisor; aí rodar o bloco abaixo.
9. [ ] A conta da Apple foi criada em 23/11 e tem pouco histórico (1 dia de vendas). As notas não
       prometem "três semanas de dados".
10. [ ] No App Store Connect: selecionar o build novo, colar a resposta abaixo no Resolution
        Center e enviar para revisão. Só com a autorização do Rick.

```sql
-- SÓ se alguém tiver aceitado os Termos na conta da Apple depois de 26/11: volta ao estado
-- "ainda não viu o texto atual" (não apaga nada; a resposta antiga de IA já não vale)
update public.profiles set termos_aceitos_versao = '2026-11-23'
 where email = 'revisao.apple@vant.com.br' and termos_aceitos_versao >= '2026-11-26';
```
Se a IA também tiver sido autorizada nela no texto novo, desligar em Perfil > Minha Conta > "Usar IA na VANT"
(a revogação vale na hora no servidor) antes de mandar para a revisão.

Resposta para o Resolution Center (colar em inglês):

> Thank you for the review. We changed the app and our servers:
> 1. Before any personal data is sent to a third-party AI service, the user sees a disclosure that
>    names every recipient, the data each feature sends and the purpose, with a checkbox that is
>    unchecked by default. We also reduced the recipients to two: Anthropic and OpenAI.
> 2. Consent is enforced on our servers: without it, no AI request is processed. Consent is tied to
>    the version of the disclosure, so it is asked again whenever a recipient or a kind of data is
>    added.
> 3. Users can withdraw consent at any time in Perfil > Minha Conta > "Usar IA na VANT". The
>    app remains fully usable without AI.
> 4. The privacy policy (https://app.vantapp.com.br/privacidade) lists the same recipients, data and
>    legal basis.
> With the new build the disclosure appears on the first login of the demo account.
