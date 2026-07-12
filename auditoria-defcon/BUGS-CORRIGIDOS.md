# DEFCON 4 — Bugs CORRIGIDOS (07/07/2026)

Cada item: sintoma pro usuário → causa → o que foi feito. Todos validados com `tsc` limpo.

---

## 1. [CRÍTICO] Mercadoria some ao corrigir a quantidade no loadout
**Arquivo:** `src/components/defcon/DefconLoadoutManager.tsx` + `useDefconLoadout.updateQty`

**Sintoma:** o vendedor toca no campo de quantidade da mercadoria pra trocar o número,
limpa o campo pra digitar outro valor, e o **produto some** da lista do dia. Além disso
a digitação ficava lenta (cada dígito gravava no banco + recarregava).

**Causa:** o `<input type=number>` era controlado e disparava `updateQty(id, parseInt(...) || 0)`
a cada tecla. Ao limpar o campo, `parseInt("")` → `NaN` → `|| 0` → `updateQty(id, 0)`, e
`updateQty` com `qty <= 0` faz `DELETE` do produto. Cada dígito ainda disparava um `UPDATE`
+ `reload()`.

**Correção:** criado o componente `QtyField` com **estado local (string)**. O valor só é
gravado no banco no `onBlur` ou ao apertar Enter. Campo vazio/inválido **volta ao valor
atual — nunca deleta**. Deletar mercadoria continua só pelo botão X. Fim da gravação a
cada tecla.

---

## 2. [MÉDIO] Vazamento de timers do SmartNotification entre blocos
**Arquivo:** `src/components/defcon/DefconSmartNotification.tsx`

**Sintoma:** ao trocar de bloco (running → intervalo/fim), timers de 12s continuavam
rodando e tentavam atualizar um componente já desmontado (warning no console + timers
órfãos acumulando durante o dia).

**Causa:** o `Map` de `setTimeout` (`timersRef`) nunca era limpo no unmount.

**Correção:** adicionado `useEffect` de cleanup que faz `clearTimeout` de todos os timers
e limpa o Map quando o componente desmonta.

---

## 3. [MÉDIO] Data errada no PDF/arte perto da meia-noite (fuso)
**Arquivo:** `src/components/defcon/DefconEndScreen.tsx` + `src/shared/lib/date-utils.ts`

**Sintoma:** o cabeçalho dos PDFs de relatório e a data nas artes de compartilhamento
podiam mostrar o **dia errado** à noite (o nome do arquivo usava a data BR, mas o cabeçalho
usava a data do aparelho em UTC).

**Causa:** `new Date().toLocaleDateString("pt-BR", ...)` usa o fuso do dispositivo; perto
da meia-noite no Brasil (UTC-3) a data UTC já virou o dia seguinte.

**Correção:** criado `getBrazilDateLabel(withYear)` em `date-utils` (usa `America/Sao_Paulo`)
e trocadas as 3 ocorrências no EndScreen.

---

## 4. [MÉDIO] "Ontem" calculado no fuso errado no relatório do dia
**Arquivo:** `src/components/defcon/DefconDayReport.tsx`

**Sintoma:** a comparação "Hoje X / Ontem Y" pegava a sessão do dia errado (ou não achava)
depois das ~21h.

**Causa:** `new Date() - 1 dia` + `toISOString()` em UTC, mesmo problema de fuso do #3.

**Correção:** trocado por `getBrazilDateDaysAgo(1)` (aritmética de calendário na data BR).

---

## 5. [MÉDIO/UX] Métrica "Abordagens por venda" (de hoje) sumia sem sessão de ontem
**Arquivo:** `src/components/defcon/DefconDayReport.tsx`

**Sintoma:** a métrica de HOJE "👥 Abordagens por venda" só aparecia se existisse sessão
de ONTEM. No 1º dia (ou após um dia parado) ela simplesmente sumia.

**Causa:** a linha estava aninhada dentro da condição `approachDiff !== null && yesterdayApproaches !== null`.

**Correção:** a métrica de hoje agora fica **sempre visível**; só a *comparação com ontem*
depende da existência da sessão de ontem.

---

## 6. [BAIXO/limpeza] Import morto removido
**Arquivo:** `src/pages/DefconChallenge.tsx`

`DefconDayReport` era importado mas **nunca renderizado** (o `switch` de fases usa
`DefconEndScreen`). Import removido. O componente foi mantido e corrigido (itens #4 e #5)
caso seja religado no futuro.

---

**Nota de método:** só foram corrigidos bugs de **baixo risco e alto valor**, sem tocar no
caminho crítico de sincronização de dinheiro (o app está no ar com dinheiro real durante o
lançamento). Bugs que exigem mudança de banco/refatoração de sync estão em `NAO-CORRIGIDOS.md`
com a recomendação exata.
