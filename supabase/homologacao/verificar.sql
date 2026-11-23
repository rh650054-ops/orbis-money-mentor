-- One row per database object of the structure: kind, name, md5 of its full definition. Same query on
-- production and on staging; any difference is reported by name. The staging marker table is ignored.
with mk as (select to_regclass('public.ambiente_homologacao') oid),
rel as (select c.oid, c.relname, c.relkind, c.relrowsecurity, c.relacl from pg_class c where c.relnamespace = 'public'::regnamespace and c.oid is distinct from (select oid from mk)),
o as (
  select 'T'::text k, r.relname::text n, r.relrowsecurity::text || '|' || coalesce((select string_agg(a.attname || ' ' || format_type(a.atttypid, a.atttypmod) || case when a.attnotnull then ' nn' else '' end || coalesce(' d=' || pg_get_expr(d.adbin, d.adrelid), '') || case when a.attgenerated <> '' then ' g' else '' end || case when a.attidentity <> '' then ' i' || a.attidentity::text else '' end, ',' order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum where a.attrelid = r.oid and a.attnum > 0 and not a.attisdropped), '') v
    from rel r where r.relkind in ('r', 'p')
  union all select 'F', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', replace(pg_get_functiondef(p.oid), E'\r', '') from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
  union all select 'P', tablename || '.' || policyname, cmd || '|' || permissive || '|' || array_to_string(roles, ',') || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '') from pg_policies where schemaname = 'public' and tablename <> 'ambiente_homologacao'
  union all select 'I', i.indexrelid::regclass::text, pg_get_indexdef(i.indexrelid) from pg_index i join rel r on r.oid = i.indrelid
  union all select 'G', r.relname || '.' || t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t join rel r on r.oid = t.tgrelid where not t.tgisinternal
  union all select 'V', r.relname, r.relkind::text || coalesce(array_to_string(c.reloptions, ','), '') || '|' || pg_get_viewdef(r.oid) from rel r join pg_class c on c.oid = r.oid where r.relkind in ('v', 'm')
  union all select 'C', r.relname || '.' || k.conname, pg_get_constraintdef(k.oid) from pg_constraint k join rel r on r.oid = k.conrelid
  union all select 'E', t.typname, (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum where enumtypid = t.oid) from pg_type t where t.typnamespace = 'public'::regnamespace and t.typtype = 'e'
  union all select 'S', r.relname, coalesce((select d.refobjid::regclass::text || '.' || d.refobjsubid from pg_depend d where d.objid = r.oid and d.deptype in ('a', 'i') and d.classid = 'pg_class'::regclass and d.refclassid = 'pg_class'::regclass), '-') from rel r where r.relkind = 'S'
  union all select 'X', n.nspname || '.' || c.relname || '.' || t.tgname, pg_get_triggerdef(t.oid) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('auth', 'storage') and not t.tgisinternal and t.tgfoid in (select oid from pg_proc where pronamespace = 'public'::regnamespace)
  union all select 'B', id, name || '|' || public::text || '|' || coalesce(file_size_limit::text, '') || '|' || coalesce(array_to_string(allowed_mime_types, ','), '') from storage.buckets
  union all select 'Q', tablename || '.' || policyname, cmd || '|' || permissive || '|' || array_to_string(roles, ',') || '|' || coalesce(qual, '') || '|' || coalesce(with_check, '') from pg_policies where schemaname = 'storage'
  union all select 'U', schemaname || '.' || tablename, pubname from pg_publication_tables where pubname = 'supabase_realtime'
  union all select 'A', r.relname, r.relkind::text || '|' || coalesce((select string_agg(coalesce(g.rolname, 'public') || ':' || x.privilege_type, ',' order by coalesce(g.rolname, 'public'), x.privilege_type)
      from aclexplode(r.relacl) x left join pg_roles g on g.oid = x.grantee where x.grantee = 0 or g.rolname in ('anon', 'authenticated', 'service_role')), '')
    from rel r where r.relkind in ('r', 'p', 'v', 'm', 'S')
  union all select 'R', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', p.prosecdef::text || '|' || coalesce((select string_agg(coalesce(g.rolname, 'public'), ',' order by coalesce(g.rolname, 'public'))
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) x left join pg_roles g on g.oid = x.grantee where x.privilege_type = 'EXECUTE' and (x.grantee = 0 or g.rolname in ('anon', 'authenticated', 'service_role'))), '')
    from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
)
select k, n, left(md5(coalesce(v, '')), 16) h from o
