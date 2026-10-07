# Notas pro revisor (App Review / Play)

Colar no campo "Notes" do App Store Connect (e em "Instruções de acesso" no Play Console).

---

VANT is a sales and money-management app for street vendors in Brazil (people who
sell at traffic lights, beaches and events). The UI is in Brazilian Portuguese.

Demo account (login uses a Brazilian CPF number instead of e-mail):
- CPF: [preencher — conta demo criada só pra revisão]
- Password: [preencher]

The demo account has an active VANT Pro subscription and sample data, so every
feature is visible without paying.

How to test the core flow:
1. Log in with the CPF and password above.
2. Tap "Vender" and then "Ativar Modo Foco" — this is the main feature: register
   sales with one tap and track the hourly goal.
3. "Ranking" shows the vendor leaderboard.
4. "Financeiro" shows income/expenses. Bank connection (Open Finance via Pluggy)
   requires a real Brazilian bank account, so it is pre-connected in the demo account.
5. The AI mentor is the chat button; it answers in Portuguese.

Subscriptions are sold only through In-App Purchase on iOS. Account deletion:
"Minha Conta" > "Excluir minha conta".

Location is used for local weather at the vendor's spot and to suggest selling
spots; microphone only when the user taps to talk to the mentor; camera only to
photograph receipts.

---

## Antes de enviar
- [ ] Criar a conta demo (CPF fictício válido), com Pro ativo e dados de exemplo
- [ ] Conferir que nada no app iOS mostra Hotmart, preço fora da Apple ou "assine no site"
- [ ] Testar excluir conta numa conta descartável
- [ ] X1: decidir se fica de fora no app da loja (ver `privacidade-e-dados.md`)
