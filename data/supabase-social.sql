-- Comunidad de Arnés (Fase 6, bloque 3): perfil público, publicaciones, «me gusta» y reportes.
-- Cómo usarlo: Supabase → tu proyecto → SQL Editor → pega todo → Run. Se puede correr más de una vez.
-- Seguridad: cada quien solo crea, cambia o borra lo suyo (RLS). Leer la galería no pide cuenta.
-- Los contadores de «me gusta» y el ocultamiento por reportes los lleva la base, no la app.

-- 1. Perfil público ---------------------------------------------------------------------------
create table if not exists public.perfil_publico (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_.]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 400),
  avatar text check (avatar is null or char_length(avatar) <= 120000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.perfil_publico enable row level security;
drop policy if exists "perfiles: cualquiera los ve" on public.perfil_publico;
drop policy if exists "perfiles: crear el mío" on public.perfil_publico;
drop policy if exists "perfiles: editar el mío" on public.perfil_publico;
drop policy if exists "perfiles: borrar el mío" on public.perfil_publico;
create policy "perfiles: cualquiera los ve" on public.perfil_publico for select to anon, authenticated using (true);
create policy "perfiles: crear el mío" on public.perfil_publico for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "perfiles: editar el mío" on public.perfil_publico for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "perfiles: borrar el mío" on public.perfil_publico for delete to authenticated using ((select auth.uid()) = user_id);

-- 2. Publicaciones -----------------------------------------------------------------------------
create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('estilo','personaje','criatura','objeto','escenario','vineta','pagina')),
  title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 600),
  data jsonb not null check (pg_column_size(data) < 3000000),
  thumb text check (thumb is null or char_length(thumb) <= 200000),
  visibility text not null default 'publico' check (visibility in ('publico','enlace')),
  remix text not null default 'no' check (remix in ('no','si')),
  remix_of uuid references public.publicaciones(id) on delete set null,
  hidden boolean not null default false,
  likes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists publicaciones_galeria on public.publicaciones (kind, created_at desc) where visibility = 'publico' and not hidden;
create index if not exists publicaciones_autor on public.publicaciones (user_id, created_at desc);
create index if not exists publicaciones_remix on public.publicaciones (remix_of);
alter table public.publicaciones enable row level security;
drop policy if exists "publicaciones: se ven" on public.publicaciones;
drop policy if exists "publicaciones: publicar lo mío" on public.publicaciones;
drop policy if exists "publicaciones: editar lo mío" on public.publicaciones;
drop policy if exists "publicaciones: borrar lo mío" on public.publicaciones;
-- lo oculto por reportes solo lo ve su autor; lo de «solo con enlace» se abre si tienes el enlace (no sale en la galería)
create policy "publicaciones: se ven" on public.publicaciones for select to anon, authenticated using (not hidden or (select auth.uid()) = user_id);
create policy "publicaciones: publicar lo mío" on public.publicaciones for insert to authenticated with check ((select auth.uid()) = user_id and not hidden and likes = 0);
create policy "publicaciones: editar lo mío" on public.publicaciones for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "publicaciones: borrar lo mío" on public.publicaciones for delete to authenticated using ((select auth.uid()) = user_id);
-- el autor puede cambiar título, texto, datos, miniatura, visibilidad y permiso de mezcla; no sus «me gusta» ni si está oculta
revoke update on public.publicaciones from anon, authenticated;
grant update (title, description, data, thumb, visibility, remix, updated_at) on public.publicaciones to authenticated;

-- 3. Me gusta ----------------------------------------------------------------------------------
create table if not exists public.me_gusta (
  pub_id uuid not null references public.publicaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pub_id, user_id)
);
create index if not exists me_gusta_usuario on public.me_gusta (user_id);
alter table public.me_gusta enable row level security;
drop policy if exists "me gusta: se ven" on public.me_gusta;
drop policy if exists "me gusta: dar el mío" on public.me_gusta;
drop policy if exists "me gusta: quitar el mío" on public.me_gusta;
create policy "me gusta: se ven" on public.me_gusta for select to anon, authenticated using (true);
create policy "me gusta: dar el mío" on public.me_gusta for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "me gusta: quitar el mío" on public.me_gusta for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.contar_me_gusta() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then update public.publicaciones set likes = likes + 1 where id = new.pub_id;
  elsif tg_op = 'DELETE' then update public.publicaciones set likes = greatest(0, likes - 1) where id = old.pub_id; end if;
  return null;
end; $$;
drop trigger if exists me_gusta_cuenta on public.me_gusta;
create trigger me_gusta_cuenta after insert or delete on public.me_gusta for each row execute function public.contar_me_gusta();

-- 4. Reportes: nadie los lee desde la app; con 3 reportes distintos la publicación se oculta
--    hasta que la revises en Supabase (Table Editor → publicaciones → hidden = false)
create table if not exists public.reportes (
  id bigserial primary key,
  pub_id uuid not null references public.publicaciones(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (pub_id, user_id)
);
alter table public.reportes enable row level security;
drop policy if exists "reportes: enviar el mío" on public.reportes;
create policy "reportes: enviar el mío" on public.reportes for insert to authenticated with check ((select auth.uid()) = user_id);

create or replace function public.ocultar_por_reportes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reportes where pub_id = new.pub_id) >= 3 then
    update public.publicaciones set hidden = true where id = new.pub_id;
  end if;
  return null;
end; $$;
drop trigger if exists reportes_ocultan on public.reportes;
create trigger reportes_ocultan after insert on public.reportes for each row execute function public.ocultar_por_reportes();

-- Las funciones de los disparadores no se llaman desde la app
revoke execute on function public.contar_me_gusta() from public, anon, authenticated;
revoke execute on function public.ocultar_por_reportes() from public, anon, authenticated;
