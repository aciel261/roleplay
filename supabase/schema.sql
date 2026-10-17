-- Jalankan SELURUH file ini di Supabase: SQL Editor > New query > Run
-- Aman dijalankan ulang.

-- 1) Tabel -------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  name       text,
  role       text not null default 'member' check (role in ('member','leader')),
  created_at timestamptz not null default now()
);

-- ringkasan per peserta (untuk "Rekap tim")
create table if not exists public.runs (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  n          int,
  best       int,
  avg        int,
  last       int,
  last_scen  text,
  last_at    bigint,
  role       text,
  updated_at timestamptz not null default now()
);

-- setiap hasil latihan (nilai + transkrip disimpan di kolom data)
create table if not exists public.run_items (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         text not null,
  at         bigint not null,
  data       jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists run_items_user_at_idx on public.run_items (user_id, at desc);

-- 2) Fungsi bantu --------------------------------------------------------
create or replace function public.is_leader()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'leader');
$$;

-- profil dibuat otomatis saat user daftar
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3) Row Level Security --------------------------------------------------
alter table public.profiles  enable row level security;
alter table public.runs      enable row level security;
alter table public.run_items enable row level security;

drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_leader());
-- sengaja TIDAK ada policy insert/update untuk profiles: user tidak bisa mengangkat dirinya jadi leader.

drop policy if exists "runs_select" on public.runs;
create policy "runs_select" on public.runs
  for select to authenticated using (user_id = auth.uid() or public.is_leader());
drop policy if exists "runs_insert" on public.runs;
create policy "runs_insert" on public.runs
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "runs_update" on public.runs;
create policy "runs_update" on public.runs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "items_select" on public.run_items;
create policy "items_select" on public.run_items
  for select to authenticated using (user_id = auth.uid() or public.is_leader());
drop policy if exists "items_insert" on public.run_items;
create policy "items_insert" on public.run_items
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "items_update" on public.run_items;
create policy "items_update" on public.run_items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) Jadikan dirimu Leader (ganti emailnya, jalankan SETELAH kamu daftar di aplikasi) ---
-- update public.profiles set role = 'leader' where email = 'emailkamu@perusahaan.com';

-- 5) OPSIONAL: hanya izinkan email domain tertentu mendaftar ---------------------------
-- create or replace function public.restrict_signup_domain()
-- returns trigger language plpgsql as $$
-- begin
--   if split_part(lower(new.email),'@',2) not in ('perusahaan.com') then
--     raise exception 'Pendaftaran hanya untuk email perusahaan';
--   end if;
--   return new;
-- end $$;
-- drop trigger if exists restrict_signup on auth.users;
-- create trigger restrict_signup before insert on auth.users
--   for each row execute function public.restrict_signup_domain();
