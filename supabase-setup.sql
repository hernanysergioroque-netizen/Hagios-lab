-- HAGIOS Lab: base de dados Supabase/PostgreSQL
-- Executa todo este ficheiro no SQL Editor do teu projecto Supabase.

create extension if not exists pgcrypto;

create table if not exists public.hagios_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text not null default '',
  category text not null default 'Outro',
  image_url text not null default '',
  project_url text not null default '',
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_public_order_idx
  on public.projects (is_published, created_at desc);

alter table public.projects enable row level security;
alter table public.hagios_admins enable row level security;

-- A função verifica a lista privada de administradores sem expor essa lista ao público.
create or replace function public.is_hagios_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.hagios_admins a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_hagios_admin() from public;
grant execute on function public.is_hagios_admin() to anon, authenticated;

-- Limpa políticas anteriores com estes nomes para permitir reexecutar o script.
drop policy if exists "Anyone can read published projects" on public.projects;
drop policy if exists "Admins can read all projects" on public.projects;
drop policy if exists "Admins can insert projects" on public.projects;
drop policy if exists "Admins can update projects" on public.projects;
drop policy if exists "Admins can delete projects" on public.projects;
drop policy if exists "No public access to admin list" on public.hagios_admins;

create policy "Anyone can read published projects"
  on public.projects for select to anon, authenticated
  using (is_published = true);
create policy "Admins can read all projects"
  on public.projects for select to authenticated
  using (public.is_hagios_admin());
create policy "Admins can insert projects"
  on public.projects for insert to authenticated
  with check (public.is_hagios_admin());
create policy "Admins can update projects"
  on public.projects for update to authenticated
  using (public.is_hagios_admin()) with check (public.is_hagios_admin());
create policy "Admins can delete projects"
  on public.projects for delete to authenticated
  using (public.is_hagios_admin());

-- A tabela de administradores não tem políticas de leitura/escrita para clientes.
-- A função security definer acima é a única forma usada pela política para a consultar.
create policy "No public access to admin list"
  on public.hagios_admins for all to anon, authenticated
  using (false) with check (false);

grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;

-- PASSO FINAL DE SEGURANÇA: depois de criares a tua conta em Authentication > Users,
-- copia o UUID do utilizador e executa a linha abaixo substituindo o UUID de exemplo.
-- Não actives signup público; cria a conta de administrador manualmente no painel Supabase.
-- insert into public.hagios_admins (user_id) values ('COLOCA-AQUI-O-UUID-DO-UTILIZADOR');
