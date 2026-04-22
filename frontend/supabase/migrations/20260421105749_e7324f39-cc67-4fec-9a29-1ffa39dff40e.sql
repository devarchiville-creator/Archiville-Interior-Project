
-- Fix function search_path
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at = now(); return new; end; $$;

-- Restrict bucket listing to the owner's folder (public URLs still resolve)
drop policy if exists "floor_plans_read" on storage.objects;
drop policy if exists "generated_read" on storage.objects;

create policy "floor_plans_owner_list" on storage.objects for select using (
  bucket_id = 'floor-plans' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "generated_owner_list" on storage.objects for select using (
  bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]
);
