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
  section "INTELIGÊNCIA ARTIFICIAL" that names the four recipients (Anthropic, OpenAI, Google,
  Cerebras) and the kinds of data sent, a link "Ver o que é enviado e pra quem" (each feature,
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

## Antes de enviar
- [x] Conta demo `revisao@vantapp.com.br` com Pro de cortesia, fora do ranking e 3 semanas de dados (23/10/2026)
- [x] Nada no app da loja mostra preço nem checkout (modelo Néctar, 23/10/2026); o botão "Assinar" abre o site
- [x] X1: só pontos no app da loja (22/10/2026, `x1-loja.ts`) — sem carteira nem aposta
- [x] Páginas públicas /suporte e /excluir-conta (23/10/2026)
- [ ] Testar excluir conta numa conta descartável
- [x] Textos de permissão em português no iPhone (localização, microfone, câmera, fotos) — conferido 23/10/2026

## Reenvio depois da recusa de 26/11 (5.1.1(i) / 5.1.2(i))

### O que mudou no servidor e no app em 26/11
- Consentimento de IA por versão do texto, conferido no servidor (migração
  `20261126160000_consentimento_ia_versao`, PR #363). Sem "Permitir" no texto atual, nenhuma função
  envia dado a IA.
- Segunda rodada (mesmo dia): a Missão de Lucro e a Mensagem do DEFCON estavam sem IA porque a
  conta da Cerebras ficou sem cota (HTTP 402) e a chave do Gemini está no plano gratuito de 20
  pedidos por dia (HTTP 429). A Anthropic passou a ser a primeira nas duas. Como o texto dizia,
  função por função, quem recebe, as duas linhas passaram a citar a Anthropic e a versão do
  consentimento subiu para `2026-11-27`: **todo mundo autoriza a IA de novo**. Os Termos
  continuam na versão `2026-11-26`.
- A análise de bug por IA (`analisar-bug`) foi desligada: o relato não tem conta por trás, então
  não há autorização para conferir, e filtro de texto não é garantia de anonimização.
- A `verificar-deposito` não é republicada: em produção ela é a versão fechada do X1 (não usa IA)
  e a main ainda tem o leitor antigo (PR #111 em aberto).

### Checklist final (nesta ordem)
1. [ ] **Gemini no plano pago** (Google AI Studio > faturamento do projeto da chave). No plano
       gratuito o Google pode usar o que recebe para melhorar produtos, e a nossa política diz que
       não. Só o Rick consegue fazer. Sem isso, a frase da política sobre o Google não é verdade.
2. [ ] PR desta rodada na main e site no ar (a política mostra a Anthropic nas duas linhas).
3. [ ] Funções de IA republicadas, fixadas no commit da main: bright-action, generate-insights,
       objetivo-lucro-ia, verificar-extrato, extrato-analisar, nota-ler, estudio-arte, defcon-coach,
       clima-vendedor, analisar-anomalia, analisar-bug.
4. [ ] Teste real com a conta de teste do Google (`revisao@vantapp.com.br`), devolvida ao estado
       original depois: autorização antiga bloqueia; autorização atual libera e a Missão e o
       Coach respondem pela Anthropic; recusa e revogação bloqueiam na hora.
5. [ ] **Build novo do iOS, gerado da main depois do passo 2.** O build 10 (26/11) carrega o texto
       de 26/11 e grava a versão antiga: não serve mais. Usar o build seguinte.
6. [ ] No TestFlight, com uma conta que NÃO seja a da Apple: a tela "Seus dados, com
       transparência" aparece com a caixa de IA desmarcada; aceitar sem marcar deixa a IA
       desligada; marcar liga; Perfil > Minha Conta > "Usar IA na VANT" desliga e liga de novo;
       "Ver o que é enviado e pra quem" mostra a Anthropic em "Objetivo de lucro" e "Mensagem do
       DEFCON".
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
>    names every recipient (Anthropic, OpenAI, Google and Cerebras), the data each feature sends and
>    the purpose, with a checkbox that is unchecked by default.
> 2. Consent is enforced on our servers: without it, no AI request is processed. Consent is tied to
>    the version of the disclosure, so it is asked again whenever the recipients or the data change.
> 3. Users can withdraw consent at any time in Perfil > Minha Conta > "Usar IA na VANT". The
>    app remains fully usable without AI.
> 4. The privacy policy (https://app.vantapp.com.br/privacidade) lists the same recipients, data and
>    legal basis.
> With the new build the disclosure appears on the first login of the demo account.
