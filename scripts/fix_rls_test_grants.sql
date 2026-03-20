-- ==================================================================
-- fix_rls_test_grants.sql
-- Corrige GRANTs faltantes, constraints y políticas RLS
-- Ejecutar en: Supabase > SQL Editor
-- ==================================================================

-- ── PASO 0: Diagnóstico ───────────────────────────────────────────
-- Ver policies y GRANTs actuales antes de hacer cambios:

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('generaciones', 'usuarios', 'licencias', 'sectores', 'clinicas')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

SELECT tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('sectores', 'clinicas', 'generaciones', 'usuarios', 'licencias')
ORDER BY tablename, policyname;


-- ── PASO 1: Expandir constraint de licencias.estado ───────────────
-- El constraint actual no incluye 'pendiente' pero la app lo necesita
ALTER TABLE licencias DROP CONSTRAINT IF EXISTS licencias_estado_check;
ALTER TABLE licencias
  ADD CONSTRAINT licencias_estado_check
  CHECK (estado IN ('activa', 'pendiente', 'cancelada'));


-- ── PASO 2: GRANTs faltantes ──────────────────────────────────────

-- DELETE en generaciones (admin tiene policy pero le falta el GRANT de tabla)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE generaciones TO authenticated;

-- INSERT en usuarios (admin tiene policy pero le falta el GRANT de tabla)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE usuarios TO authenticated;

-- INSERT en licencias para supervisor
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE licencias TO authenticated;


-- ── PASO 3: Bloquear anon en sectores ────────────────────────────
-- Eliminar TODAS las policies SELECT en sectores y recrear
-- una que solo permita authenticated

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'sectores' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON sectores', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "sectores_select_authenticated" ON sectores
  FOR SELECT TO authenticated USING (true);


-- ── PASO 4: Bloquear anon en clinicas ────────────────────────────

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'clinicas' AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON clinicas', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "clinicas_select_authenticated" ON clinicas
  FOR SELECT TO authenticated USING (true);


-- ── VERIFICACIÓN FINAL ────────────────────────────────────────────

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('generaciones', 'usuarios', 'licencias', 'sectores', 'clinicas')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

SELECT tablename, policyname, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('sectores', 'clinicas', 'generaciones', 'usuarios', 'licencias')
ORDER BY tablename, policyname;

-- Verificar constraint de licencias
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'licencias_estado_check';
