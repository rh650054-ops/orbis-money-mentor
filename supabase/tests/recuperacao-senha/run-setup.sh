#!/bin/bash
# recria o banco de teste: stub → migrações antigas → seed → migração nova (2x)
P="psql ${PGURL:--h /tmp -p 54329 -U postgres} -v ON_ERROR_STOP=1 -q"
M="$(cd "$(dirname "$0")/../../migrations" && pwd)"
cd "$(dirname "$0")"
$P -c 'drop database if exists t1' -c 'create database t1' || exit 1
for f in stub.sql $M/20260929160000_email_verificado_recuperacao_senha.sql $M/20261008133500_email_confirmar_por_recuperacao.sql seed.sql; do
  $P -d t1 -f $f || { echo "FALHOU $f"; exit 1; }
done
$P -d t1 -1 -f $M/20261011140000_recuperacao_senha_por_codigo.sql 2>&1 | grep -v NOTICE || true
$P -d t1 -1 -f $M/20261011140000_recuperacao_senha_por_codigo.sql 2>&1 | grep -v NOTICE || true
