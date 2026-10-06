-- ============================================================
-- KIT DO PARCEIRO PRO COMERCIAL (Yan) — 06/10/2026
-- Rick: "como o Yan vai preparar o link pros influenciadores? tem um modelo mais prático?"
-- Antes: só o dono via a aba Afiliados; criar exigia inventar o código, copiar 2 links
-- separados, escrever a mensagem na mão e lembrar de criar o cupom na Hotmart.
-- Agora o comercial (is_orbis_crm) também:
--   • sugere/checa o código (crm_parceiro_codigo_livre);
--   • cria o parceiro com WhatsApp e @ (crm_parceiro_criar) — só CRIA: não sobrescreve
--     parceiro existente nem mexe em percentual (isso continua só do dono);
--   • lista os parceiros sem dinheiro (crm_parceiros_kit) pra reenviar o kit;
--   • marca que o cupom já foi criado na Hotmart (crm_parceiro_cupom_ok).
-- Comissão, pagamento e bloqueio continuam só do dono (crm_afiliados etc.).
-- Achado no teste: o crm_afiliado_salvar antigo chamava gen_random_bytes sem o schema
-- (a função mora em extensions) e quebrava ao criar código novo. Aqui usa extensions.
-- ============================================================

alter table public.parceiros add column if not exists whatsapp text;
alter table public.parceiros add column if not exists instagram text;
alter table public.parceiros add column if not exists cupom_hotmart_ok boolean not null default false;
alter table public.parceiros add column if not exists criado_por uuid;

create or replace function public.crm_parceiro_codigo_livre(p_code text)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare v text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if not public.is_orbis_crm() then raise exception 'sem acesso'; end if;
  if length(v) < 3 then return false; end if;
  return not exists (select 1 from public.parceiros where upper(code) = v or lower(slug) = lower(v));
end $$;

-- dados que a mensagem de boas-vindas precisa (percentuais e dia do Pix vêm da config)
create or replace function public.crm_parceiro_json(r public.parceiros)
returns jsonb language sql stable security definer set search_path to 'public' as $$
  select jsonb_build_object(
    'code', r.code, 'nome', r.nome, 'status', r.status,
    'whatsapp', r.whatsapp, 'instagram', r.instagram, 'cupom_hotmart_ok', r.cupom_hotmart_ok,
    'link', coalesce(public.parc_cfg('dominio')#>>'{}', 'https://app.orbis.inf.br') || '/r/' || r.slug,
    'painel', coalesce(public.parc_cfg('dominio')#>>'{}', 'https://app.orbis.inf.br') || '/parceiro/?t=' || r.token,
    'pct_primeira', coalesce(r.pct_recorrente, 10) + coalesce(r.pct_bonus_primeira, 5),
    'pct_recorrente', coalesce(r.pct_recorrente, 10),
    'dia_pagamento', coalesce(public.parc_cfg_num('dia_pagamento'), 10)::int,
    'criado_em', to_char(coalesce(r.entrou_em, r.created_at) at time zone 'America/Sao_Paulo', 'DD/MM/YYYY'));
$$;

create or replace function public.crm_parceiro_criar(
  p_nome text, p_code text, p_whatsapp text default null, p_instagram text default null, p_pix text default null
) returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_zap text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
  v_ig text := nullif(lower(regexp_replace(btrim(coalesce(p_instagram, '')), '^@+', '')), '');
  r public.parceiros%rowtype;
begin
  if not public.is_orbis_crm() then raise exception 'sem acesso'; end if;
  if coalesce(btrim(p_nome), '') = '' then raise exception 'nome obrigatório'; end if;
  if length(v_code) < 3 or length(v_code) > 20 then raise exception 'o código precisa ter de 3 a 20 letras ou números'; end if;
  if exists (select 1 from public.parceiros where upper(code) = v_code or lower(slug) = lower(v_code)) then
    raise exception 'o código % já existe — escolha outro', v_code;
  end if;
  -- celular BR sem DDI vira 55 + número (o wa.me precisa do país)
  if v_zap is not null and length(v_zap) in (10, 11) then v_zap := '55' || v_zap; end if;
  if v_zap is not null and length(v_zap) not between 12 and 13 then raise exception 'WhatsApp inválido — use DDD + número'; end if;

  insert into public.parceiros (code, nome, tipo, comissao, recorrente, token, slug, status, nivel,
                                pct_recorrente, pct_bonus_primeira, pix_chave, entrou_em, whatsapp, instagram, criado_por)
  values (v_code, btrim(p_nome), 'afiliado',
          coalesce(public.parc_cfg_num('pct_recorrente_padrao'), 10), true,
          encode(extensions.gen_random_bytes(24), 'hex'), lower(v_code), 'ativo', 'parceiro',
          coalesce(public.parc_cfg_num('pct_recorrente_padrao'), 10),
          coalesce(public.parc_cfg_num('pct_bonus_primeira'), 5),
          nullif(btrim(p_pix), ''), now(), v_zap, v_ig, auth.uid())
  returning * into r;
  return public.crm_parceiro_json(r);
end $$;

-- lista pro comercial: contato e links, SEM nenhum número de dinheiro
create or replace function public.crm_parceiros_kit()
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.is_orbis_crm() then raise exception 'sem acesso'; end if;
  return coalesce((select jsonb_agg(public.crm_parceiro_json(p) order by coalesce(p.entrou_em, p.created_at) desc)
                     from public.parceiros p where p.tipo = 'afiliado'), '[]'::jsonb);
end $$;

create or replace function public.crm_parceiro_contato(p_code text, p_whatsapp text, p_instagram text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare v_zap text := nullif(regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g'), '');
begin
  if not public.is_orbis_crm() then raise exception 'sem acesso'; end if;
  if v_zap is not null and length(v_zap) in (10, 11) then v_zap := '55' || v_zap; end if;
  update public.parceiros set
    whatsapp = coalesce(v_zap, whatsapp),
    instagram = coalesce(nullif(lower(regexp_replace(btrim(coalesce(p_instagram, '')), '^@+', '')), ''), instagram),
    atualizado_em = now()
   where upper(code) = upper(p_code);
end $$;

create or replace function public.crm_parceiro_cupom_ok(p_code text, p_ok boolean)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_orbis_crm() then raise exception 'sem acesso'; end if;
  update public.parceiros set cupom_hotmart_ok = coalesce(p_ok, false), atualizado_em = now() where upper(code) = upper(p_code);
end $$;

revoke all on function public.crm_parceiro_json(public.parceiros) from public, anon, authenticated;
grant execute on function public.crm_parceiro_codigo_livre(text) to authenticated;
grant execute on function public.crm_parceiro_criar(text, text, text, text, text) to authenticated;
grant execute on function public.crm_parceiros_kit() to authenticated;
grant execute on function public.crm_parceiro_contato(text, text, text) to authenticated;
grant execute on function public.crm_parceiro_cupom_ok(text, boolean) to authenticated;
revoke execute on function public.crm_parceiro_codigo_livre(text) from anon;
revoke execute on function public.crm_parceiro_criar(text, text, text, text, text) from anon;
revoke execute on function public.crm_parceiros_kit() from anon;
revoke execute on function public.crm_parceiro_contato(text, text, text) from anon;
revoke execute on function public.crm_parceiro_cupom_ok(text, boolean) from anon;
