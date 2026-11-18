-- Arnés · esquema de la nube (Supabase). Ya está aplicado en el proyecto "Arnes".
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
create policy "ver mis proyectos"    on public.projects for select to authenticated using ((select auth.uid()) = user_id);
create policy "crear mis proyectos"  on public.projects for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "editar mis proyectos" on public.projects for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "borrar mis proyectos" on public.projects for delete to authenticated using ((select auth.uid()) = user_id);

-- Perfil: expresiones y poses guardadas
create table if not exists public.profiles (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "ver mi perfil"    on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "crear mi perfil"  on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "editar mi perfil" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.projects, public.profiles from anon;
grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update on public.profiles to authenticated;
