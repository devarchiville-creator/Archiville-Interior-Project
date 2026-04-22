
-- Projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  current_stage text not null default 'upload',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects enable row level security;
create policy "own_projects_select" on public.projects for select using (auth.uid() = user_id);
create policy "own_projects_insert" on public.projects for insert with check (auth.uid() = user_id);
create policy "own_projects_update" on public.projects for update using (auth.uid() = user_id);
create policy "own_projects_delete" on public.projects for delete using (auth.uid() = user_id);

-- Project assets
create table public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- floor_plan | pov_sketch | selected_pov | refined_2d | region_edit | final_output
  file_url text,
  storage_path text,
  version_number int not null default 1,
  parent_asset_id uuid references public.project_assets(id) on delete set null,
  metadata_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.project_assets enable row level security;
create policy "own_assets_select" on public.project_assets for select using (auth.uid() = user_id);
create policy "own_assets_insert" on public.project_assets for insert with check (auth.uid() = user_id);
create policy "own_assets_update" on public.project_assets for update using (auth.uid() = user_id);
create policy "own_assets_delete" on public.project_assets for delete using (auth.uid() = user_id);
create index on public.project_assets(project_id);

-- Generation jobs
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid references public.project_assets(id) on delete set null,
  stage text not null,
  status text not null default 'queued', -- queued | processing | completed | failed
  prompt_text text,
  request_payload_json jsonb default '{}'::jsonb,
  response_payload_json jsonb default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.generation_jobs enable row level security;
create policy "own_jobs_select" on public.generation_jobs for select using (auth.uid() = user_id);
create policy "own_jobs_insert" on public.generation_jobs for insert with check (auth.uid() = user_id);
create policy "own_jobs_update" on public.generation_jobs for update using (auth.uid() = user_id);

-- Project prompts log
create table public.project_prompts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  stage text not null,
  prompt_text text not null,
  variables_json jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.project_prompts enable row level security;
create policy "own_prompts_select" on public.project_prompts for select using (auth.uid() = user_id);
create policy "own_prompts_insert" on public.project_prompts for insert with check (auth.uid() = user_id);

-- Update timestamp trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger projects_updated before update on public.projects
for each row execute function public.set_updated_at();
create trigger jobs_updated before update on public.generation_jobs
for each row execute function public.set_updated_at();

-- Storage buckets
insert into storage.buckets (id, name, public) values
  ('floor-plans', 'floor-plans', true),
  ('generated-images', 'generated-images', true)
on conflict (id) do nothing;

create policy "floor_plans_read" on storage.objects for select using (bucket_id = 'floor-plans');
create policy "floor_plans_user_write" on storage.objects for insert with check (
  bucket_id = 'floor-plans' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "floor_plans_user_update" on storage.objects for update using (
  bucket_id = 'floor-plans' and auth.uid()::text = (storage.foldername(name))[1]
);
create policy "floor_plans_user_delete" on storage.objects for delete using (
  bucket_id = 'floor-plans' and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "generated_read" on storage.objects for select using (bucket_id = 'generated-images');
create policy "generated_user_write" on storage.objects for insert with check (
  bucket_id = 'generated-images' and auth.uid()::text = (storage.foldername(name))[1]
);
