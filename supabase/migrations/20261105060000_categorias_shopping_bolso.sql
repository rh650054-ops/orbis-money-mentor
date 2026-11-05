-- 04/11/2026 (Rick: "preciso que arrumemos as categorias"; audit FIN2 + FIN3).
--  FIN2: Pluggy's generic "Shopping" category was mapped to "Roupas e calçados", so supermarkets, OXXO,
--        packaging, AutoPass and any small store landed there (~3.300 entries). The edge code now maps
--        "Shopping" to "Compras no débito" and learned merchant rules for supermarkets, packaging and AutoPass.
--  FIN3: Mercado Pago "bolsos" (Transferência para o / do bolso …) and "renda variável" are the seller's own
--        money moving between pockets, but counted as Pix to people (spending) AND as income (~R$ 190 mil).
-- This fixes the entries already saved. What the seller chose by hand (confianca 'usuario' or a fixed
-- category) is never touched.

-- 1) pockets / investments → his own money (both directions)
update public.extrato_lancamentos l
   set categoria = 'transferencia_propria', esfera = 'pessoal', confianca = 'regra'
 where l.confianca <> 'usuario' and not coalesce(l.categoria_fixa, false)
   and l.categoria <> 'transferencia_propria'
   and (upper(coalesce(l.comerciante, '')) || ' ' || coalesce(l.descricao_norm, ''))
       ~ '\m(TRANSFERENCIA (PARA O|DO|NO) BOLSO|RENDA (VARIAVEL|FIXA))\M';

-- 2) "Roupas" that came only from Pluggy's "Shopping" → the right place
with x as (
  select l.id, upper(coalesce(l.comerciante, '')) || ' ' || coalesce(l.descricao_norm, '') as t
    from public.extrato_lancamentos l
   where l.tipo = 'saida' and l.categoria = 'roupas' and l.confianca = 'padrao'
     and l.pluggy_tx_id is not null and not coalesce(l.categoria_fixa, false)
),
nova as (
  select x.id,
         case
           when x.t ~ '\m(SUPERM\w*|HIPERM\w*|MINIMERCADO|MERCADINHO|MERCEARIA|ATACAD\w*|ASSAI|CARREFOUR|OXXO|HORTIFRUTI|SACOLAO|SONDA)\M' then 'mercado'
           when x.t ~ '\m(EMBALAGE\w*|DESCARTAVE\w*)\M' then 'insumos'
           when x.t ~ '\mAUTOPASS\M' then 'onibus'
           when x.t ~ '\m(ROUPA\w*|MODA|CALCAD\w*|CONFEC\w*|BOUTIQUE|JOIA\w*|TENIS|YOUCOM|HERING|ZARA|RENNER|RIACHUELO|SHEIN|SHOPEE|CEA|MARISA|CENTAURO|NETSHOES)\M' then 'roupas'
           else 'compras_debito'
         end as cat
    from x
)
update public.extrato_lancamentos l
   set categoria = n.cat,
       esfera = coalesce((select c.esfera_padrao from public.extrato_categorias c where c.slug = n.cat and c.user_id is null), l.esfera)
  from nova n
 where l.id = n.id and n.cat <> 'roupas';
