# Homologação final das assinaturas Apple (27/11/2026)

Build 15 (`cdd0aa4`) no TestFlight, funções `apple-webhook`, `apple-conciliar` e `apple-validar`
fixadas em `d9f0cc5`. Preços Apple decididos: Essencial R$ 29,90/mês · Pro mensal R$ 49,90/mês ·
Pro anual R$ 399,90/ano. Nada aqui gera build, muda preço ou envia para revisão.

## Como ler cada passo
Você faz a ação no iPhone com a conta `teste.sandbox.rick@vant.com.br`; eu confiro no banco e nos
logs. Toda ação gera uma notificação V2 nova.

**Sandbox não reenvia notificação.** Em Sandbox a Apple tenta enviar uma vez só; em produção ela
reenvia em 1, 12, 24, 48 e 72 h. Por isso a notificação da compra de 12h19 (que bateu no 401 da
manhã) não vai chegar nunca. Ela não faz falta: a compra entrou pelo app e o cron confere com a Apple.

**Antes de começar:** em Ajustes › App Store › Conta Sandbox › Gerenciar, ajustar a taxa de
renovação para a mais rápida disponível. Assim a renovação e a expiração acontecem em minutos.

## Estado de partida (conferido 27/11 15h)
- 1 assinatura Sandbox: Pro anual, ativa, renova automaticamente, vence 28/11 12h18
  (transação `2000001272303760`, recuperada às 13h53 pelo app).
- Direitos da conta: plano, Pro e Pro anual. Sem cortesia, demo ou Hotmart.
- Receita Apple de novembro: zero (Sandbox fica fora). Hotmart: 87 pagamentos, R$ 2.973,83 bruto.

## Roteiro

| # | Você faz no iPhone | Eu confiro | Esperado |
|---|---|---|---|
| 1 | Nada (cron das xx:23) | log do `apple-conciliar`, `conferida_em` | API da Apple responde com JWT válido; assinatura conferida |
| 2 | Gerenciar assinatura na Apple › trocar para **Pro mensal** | `apple_eventos` | `DID_CHANGE_RENEWAL_PREF`; Pro anual continua até o vencimento |
| 3 | Esperar a renovação | eventos, `apple_assinaturas`, `apple_transacoes` | `DID_RENEW` com o produto novo; transação nova; direitos de Pro (sem Pro anual) |
| 4 | Trocar para **Essencial** (rebaixamento) e esperar a renovação | idem | `DID_CHANGE_RENEWAL_PREF` (DOWNGRADE) e depois `DID_RENEW` Essencial; sai o Pro |
| 5 | Sair da conta, entrar de novo, tocar **Restaurar compras** | log do `apple-validar` | "restaurada", nenhuma transação duplicada |
| 6 | Gerenciar › **Cancelar assinatura** | eventos, `renova` | `DID_CHANGE_RENEWAL_STATUS` (AUTO_RENEW_DISABLED); acesso segue até o vencimento |
| 7 | Esperar o vencimento | eventos, perfil | `EXPIRED` (VOLUNTARY); plano deixa de valer; paywall volta |
| 8 | — | foto da Hotmart, `receita_apple`, `receita_por_origem` | Hotmart igual; Apple Sandbox fora de faturamento, MRR e comissões |

Não fazer compra nova fora do roteiro. Uma troca de plano não é compra nova: a Apple só muda o que
será cobrado na próxima renovação (rebaixamento ou mudança de duração) ou cobra a diferença na hora
(subida de nível).

## Conta de revisão para compras
Ver `apple-assinaturas.md` §5 e `revisao-apple.md`. Resumo: `revisao.compra@vant.com.br` criada como
cliente comum, depois sem demo e sem cortesia, teste encerrado, registrada como conta de teste
Sandbox e fora de ranking, CRM e indicadores. O revisor compra em Sandbox, e só conta registrada
recebe acesso.

## Riscos abertos para a submissão
1. **Revisor comprando numa conta não registrada.** A compra é gravada, mas não libera acesso. O app
   mostra "Assinatura ativa" (porque o servidor respondeu "gravada") e o paywall continua. Mitigação
   atual: notas indicam a `revisao.compra`. Correção possível (exige build): o app só dizer "ativa"
   quando a resposta do servidor trouxer `acesso.plano = true`.
2. **Notificação de compra em Sandbox perdida** quando o webhook falha: sem reenvio em Sandbox.
   Coberto pelo `apple-validar` (app) e pelo `apple-conciliar` (cron).
