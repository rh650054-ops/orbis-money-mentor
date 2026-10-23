# Notas pro revisor (App Review / Play)

Colar no campo "Notes" do App Store Connect (e em "Instruções de acesso" no Play Console).
A conta e a senha vão nos campos próprios de "Sign-in required" (Apple) e
"Instruções de acesso" (Google), não no texto abaixo.

---

VANT is a sales and money-management app for street vendors in Brazil (people who
sell at traffic lights, beaches and events). The UI is in Brazilian Portuguese.

Demo account: on the login screen tap "E-mail" (next to "CPF") and use
revisao@vantapp.com.br with the password provided in the sign-in fields.
It has an active subscription and three weeks of sample data, so every feature is
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

Support: https://app.vantapp.com.br/suporte · suporte@vantapp.com.br

---

## Antes de enviar
- [x] Conta demo `revisao@vantapp.com.br` com Pro de cortesia, fora do ranking e 3 semanas de dados (23/10/2026)
- [x] Nada no app da loja mostra preço nem checkout (modelo Néctar, 23/10/2026); o botão "Assinar" abre o site
- [x] X1: só pontos no app da loja (22/10/2026, `x1-loja.ts`) — sem carteira nem aposta
- [x] Páginas públicas /suporte e /excluir-conta (23/10/2026)
- [ ] Testar excluir conta numa conta descartável
- [x] Textos de permissão em português no iPhone (localização, microfone, câmera, fotos) — conferido 23/10/2026
