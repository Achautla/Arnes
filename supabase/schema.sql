-- Arnés · esquema de la nube (Supabase)
-- Córrelo una vez en el editor SQL de tu proyecto de Supabase.
create table if not exists public.projects (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null default 'Mi proyecto',
  vinetas     integer not null default 0,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists projects_user_idx on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

-- Cada persona solo ve y cambia sus propios proyectos
create policy "ver mis proyectos"    on public.projects for select using ((select auth.uid()) = user_id);
create policy "crear mis proyectos"  on public.projects for insert with check ((select auth.uid()) = user_id);
create policy "editar mis proyectos" on public.projects for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "borrar mis proyectos" on public.projects for delete using ((select auth.uid()) = user_id);
