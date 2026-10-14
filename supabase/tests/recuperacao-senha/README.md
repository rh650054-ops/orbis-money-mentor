# Testes da recuperação de senha por código (banco)

Postgres 16 local com um stub mínimo do Supabase (roles, `auth.*`, travas reais de `profiles`).

```bash
./run-setup.sh                                   # recria o banco t1 e aplica a migração 2x (idempotência)
psql -h /tmp -p 54329 -U postgres -d t1 -f tests.sql   # 48 casos
./concorrencia.sh                                # recria o banco e roda 8 casos com 20 conexões simultâneas
```
`PGURL` troca a conexão (padrão: socket em /tmp, porta 54329).
