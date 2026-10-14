#!/bin/bash
# Testes de concorrência: N conexões simultâneas contra a mesma linha.
P="psql ${PGURL:--h /tmp -p 54329 -U postgres} -d t1 -tA -q"
N=20
"$(dirname "$0")/run-setup.sh" >/dev/null || exit 1   # banco limpo
falhou=0
ok() { if [ "$1" = "$2" ]; then echo "PASS  $3 ($1)"; else echo "FALHOU $3: esperado $2, veio $1"; falhou=1; fi; }
abre() { $P -c "update senha_desafios set criado_em = criado_em - interval '2 hours'" >/dev/null; }
novo() { local id; id=$($P -c "select gen_random_uuid()"); echo "$id|$($P -c "select codigo from public.senha_desafio_criar('$id', '52998224725')")"; }

# 1. mesmo código certo, 20 ao mesmo tempo → exatamente 1 token
abre; IFS='|' read -r D C <<<"$(novo)"
for i in $(seq $N); do $P -c "select status from public.senha_desafio_verificar('$D', '$C')" > ${TMPDIR:-/tmp}/c1.$i & done; wait
ok "$(cat ${TMPDIR:-/tmp}/c1.* | grep -c '^ok$')" 1 "20 confirmacoes simultaneas do mesmo codigo: 1 ok"

# 2. mesmo token, 20 trocas ao mesmo tempo → exatamente 1 consumo
abre; IFS='|' read -r D C <<<"$(novo)"
T=$($P -c "select troca_token from public.senha_desafio_verificar('$D', '$C')")
for i in $(seq $N); do $P -c "select count(*) from public.senha_troca_consumir('$T')" > ${TMPDIR:-/tmp}/c2.$i & done; wait
ok "$(cat ${TMPDIR:-/tmp}/c2.* | grep -c '^1$')" 1 "20 trocas simultaneas com o mesmo token: 1 consumo"

# 3. 20 códigos errados ao mesmo tempo → tentativas para em 5
abre; IFS='|' read -r D C <<<"$(novo)"
W=$([ "$C" = "000000" ] && echo 111111 || echo 000000)
for i in $(seq $N); do $P -c "select status from public.senha_desafio_verificar('$D', '$W')" > ${TMPDIR:-/tmp}/c3.$i & done; wait
ok "$(cat ${TMPDIR:-/tmp}/c3.* | sort | uniq -c | tr -s ' ' | tr '\n' ';')" " 1 bloqueado; 4 errado; 15 invalido;" "20 erros simultaneos: 4 errado, 1 bloqueia, resto invalido"
ok "$($P -c "select tentativas from senha_desafios where id = '$D'")" 5 "tentativas nunca passa de 5"

# 4. 10 reenvios simultâneos → só 1 desafio fica valendo
abre
for i in $(seq 10); do $P -c "select count(*) from public.senha_desafio_criar(gen_random_uuid(), '52998224725')" > /dev/null & done; wait
ok "$($P -c "select count(*) from senha_desafios d join profiles p using (user_id) where p.cpf = '52998224725' and d.invalidado_em is null and d.troca_usada_em is null and d.consumido_em is null")" 1 "10 reenvios simultaneos: 1 desafio valido"

# 5. confirmar o código antigo × reenviar, ao mesmo tempo (30 rodadas)
#    regra: no fim, nunca sobra token utilizável do desafio antigo.
sobra=0
for r in $(seq 30); do
  abre; IFS='|' read -r D C <<<"$(novo)"
  $P -c "select troca_token from public.senha_desafio_verificar('$D', '$C')" > ${TMPDIR:-/tmp}/c5.tok &
  $P -c "select count(*) from public.senha_desafio_criar(gen_random_uuid(), '52998224725')" > /dev/null &
  wait
  T=$(cat ${TMPDIR:-/tmp}/c5.tok)
  if [ -n "$T" ]; then n=$($P -c "select count(*) from public.senha_troca_consumir('$T')"); [ "$n" != "0" ] && sobra=$((sobra+1)); fi
done
ok "$sobra" 0 "30 rodadas confirmar x reenviar: token antigo nunca sobrevive ao reenvio"

# 6. confirmar × trocar e-mail, ao mesmo tempo (30 rodadas)
vaza=0
for r in $(seq 30); do
  $P -c "update profiles set email = 'ana@ex.com', email_verificado_em = now(), email_verificado_por = 'codigo' where cpf = '52998224725'" >/dev/null
  abre; IFS='|' read -r D C <<<"$(novo)"
  $P -c "select troca_token from public.senha_desafio_verificar('$D', '$C')" > ${TMPDIR:-/tmp}/c6.tok &
  $P -c "set request.jwt.claims = '{\"role\":\"authenticated\",\"sub\":\"00000000-0000-0000-0000-00000000000a\"}'; set role authenticated; update profiles set email = 'mudou$r@ex.com' where user_id = auth.uid()" >/dev/null &
  wait
  T=$(cat ${TMPDIR:-/tmp}/c6.tok)
  if [ -n "$T" ]; then n=$($P -c "select count(*) from public.senha_troca_consumir('$T')"); [ "$n" != "0" ] && vaza=$((vaza+1)); fi
done
ok "$vaza" 0 "30 rodadas confirmar x trocar e-mail: nenhum token vale depois da troca"
$P -c "update profiles set email = 'ana@ex.com', email_verificado_em = now(), email_verificado_por = 'codigo' where cpf = '52998224725'" >/dev/null

# 7. confirmação de e-mail (código) 20× ao mesmo tempo → 1 ok
$P -c "update profiles set email_verificado_em = null, email_verificado_por = null where cpf = '39053344705'; delete from email_codigos where user_id = '00000000-0000-0000-0000-00000000000c'; insert into email_codigos (user_id, email, codigo_hash, expira_em, tipo) values ('00000000-0000-0000-0000-00000000000c', (select email from profiles where cpf = '39053344705'), 'HC', now() + interval '15 minutes', 'codigo')" >/dev/null
for i in $(seq $N); do $P -c "select public.email_confirmar_codigo('00000000-0000-0000-0000-00000000000c', 'HC')" > ${TMPDIR:-/tmp}/c7.$i & done; wait
ok "$(cat ${TMPDIR:-/tmp}/c7.* | grep -c '^ok$')" 1 "20 confirmacoes de e-mail simultaneas: 1 ok"

rm -f ${TMPDIR:-/tmp}/c[0-9].*
exit $falhou
