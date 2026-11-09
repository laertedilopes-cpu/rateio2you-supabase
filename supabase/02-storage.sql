-- =========================================================
-- rateio2you — imagens dos produtos e banners
-- ---------------------------------------------------------
-- Rode este arquivo DEPOIS de 01-schema.sql, no SQL Editor.
-- Ele cria o bucket "product-images" e libera:
--   • leitura pública das fotos (necessário para a loja);
--   • envio/alteração/exclusão somente para o administrador.
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  8388608,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 8388608,
      allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif'];

drop policy if exists "rateio2you images public read" on storage.objects;
drop policy if exists "rateio2you images admin insert" on storage.objects;
drop policy if exists "rateio2you images admin update" on storage.objects;
drop policy if exists "rateio2you images admin delete" on storage.objects;

create policy "rateio2you images public read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "rateio2you images admin insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "rateio2you images admin update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "rateio2you images admin delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_admin());
