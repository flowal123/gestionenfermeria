-- Migration: tabla generaciones para persistir historial de planillas en Supabase
-- Run in Supabase SQL editor

create table if not exists generaciones (
  id          uuid        primary key default gen_random_uuid(),
  mes         text        not null,
  mes_num     int         not null check (mes_num between 1 and 12),
  anio        int         not null,
  estado      text        not null default 'borrador'
              check (estado in ('borrador','aprobada','cancelada')),
  func_count  int         not null default 0,
  alertas_7   int         not null default 0,
  created_at  timestamptz not null default now(),
  created_by  text
);

-- Permissive policy for authenticated users (adjust per your RLS setup)
alter table generaciones enable row level security;
create policy "authenticated_all" on generaciones
  for all using (auth.role() = 'authenticated');
