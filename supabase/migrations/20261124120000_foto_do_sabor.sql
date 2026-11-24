-- 24/11/2026: a flavour's own photo (optional). Purely additive: one nullable column, no row changed.
-- Access stays the table's current owner-only policy (product_variants_own: user_id = auth.uid()), and
-- the files stay in the product-photos bucket, where each seller can only write in his own folder.
-- Rollback: alter table public.product_variants drop column photo_url;
alter table public.product_variants
  add column if not exists photo_url text
  check (photo_url is null or (char_length(photo_url) <= 1000 and photo_url like 'https://%'));
comment on column public.product_variants.photo_url is 'Public URL of the flavour''s own photo (bucket product-photos); null = use the product photo.';
