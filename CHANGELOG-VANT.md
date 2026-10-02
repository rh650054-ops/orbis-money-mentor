# CHANGELOG — VANT

Registro do que mudou no app, em português, do mais novo pro mais antigo.

## 02/10/2026 — Sala de Competição: versões A e B unificadas

**O que mudou pro vendedor**
- Arena: dois botões lado a lado, **DESAFIAR 1×1** e **ABRIR SALA**.
- **SUAS LUTAS DE HOJE · N ROLANDO** mostra tudo de uma vez: chamados pra sala, salas em que você está e todos os X1 ativos do dia.
- Salas abertas da galera aparecem no feed **LUTAS AO VIVO** com o chip **ENTRAR**.
- Novo modo **Chamar mais** (`/x1/sala/:id/chamar`): grade de vendedores sem quem já está na sala ou já foi chamado, com botão de **link** pra copiar/compartilhar.
- Placar da sala: saldo da carteira no topo, linha treme quando alguém vende, quem te chamou, lista de chamados que ainda não entraram, card "VOCÊ LEVOU R$ X" quando a sala fecha, confirmação antes de sair.
- Textos corrigidos: "1 golpe" no singular; quando você é o 2º, a frase não repete a mesma diferença duas vezes.

**Por dentro**
- Uma lib só: `src/components/x1/x1-sala-lib.ts` (a `sala-lib.ts` da versão B não entrou). Ganhou `horaBRT`, `aindaEntra`, `aindaSai`; erro de rede agora aparece como mensagem em vez de "sala não existe"; sala fechada usa a posição gravada pelo banco.
- Telas `X1.tsx`, `X1Sala.tsx`, `X1SalaNova.tsx` vieram da versão B, adaptadas pra lib da A (+ rótulos de acessibilidade da A).
- Rota nova `/x1/sala/:id/chamar` no `router.tsx`.
- Migration única `20261002180000_x1_sala.sql`: texto alinhado com o que já está no banco (`coalesce(ver,false)` / `coalesce(bal,0)` em `x1_sala_criar` e `x1_sala_entrar`). **Já aplicada — não reaplicar.** A `20261002120000_x1_salas.sql` da B não entrou.
- Testes: 5 passando em `x1-sala-lib.test.ts` (novo: posição do banco vale na sala fechada). `tsc`: 67 erros, igual à base, nenhum nos arquivos da Sala. `eslint`: 0 erros.
