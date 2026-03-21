-- ==================================================================
-- fix_rls_mantenimiento.sql
-- GRANTs y políticas RLS para tablas del módulo Mantenimiento:
--   clinicas, sectores, motivos_licencia
-- También: columnas nuevas en sectores y generaciones
-- Ejecutar en: Supabase > SQL Editor
-- ==================================================================


-- ── PASO 1: Columnas nuevas ────────────────────────────────────────

-- Asociar sectores a clínicas
ALTER TABLE sectores
  ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES clinicas(id);

-- Registrar clínica en historial de generaciones
ALTER TABLE generaciones
  ADD COLUMN IF NOT EXISTS clinica_id uuid REFERENCES clinicas(id);

-- Tabla de motivos de licencia especial (idempotente)
CREATE TABLE IF NOT EXISTS motivos_licencia (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  descripcion text NOT NULL,
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Vincular motivo en licencias
ALTER TABLE licencias
  ADD COLUMN IF NOT EXISTS motivo_id uuid REFERENCES motivos_licencia(id);


-- ── PASO 2: GRANTs de tabla ────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE clinicas         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE sectores         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE motivos_licencia TO authenticated;


-- ── PASO 3: RLS habilitado ─────────────────────────────────────────

ALTER TABLE clinicas         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sectores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE motivos_licencia ENABLE ROW LEVEL SECURITY;


-- ── PASO 4: Policies de lectura (todos los autenticados) ──────────

-- Limpiar policies SELECT previas en clinicas
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'clinicas' AND cmd = 'SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON clinicas', pol.policyname); END LOOP;
END $$;

CREATE POLICY "clinicas_select_auth" ON clinicas
  FOR SELECT TO authenticated USING (true);

-- Limpiar policies SELECT previas en sectores
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'sectores' AND cmd = 'SELECT'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON sectores', pol.policyname); END LOOP;
END $$;

CREATE POLICY "sectores_select_auth" ON sectores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "motivos_select_auth" ON motivos_licencia
  FOR SELECT TO authenticated USING (true);


-- ── PASO 5: Policies de escritura (solo admin y supervisor) ────────

-- Helper: verifica que el usuario autenticado tenga rol admin o supervisor
-- Usa auth_user_id para evitar depender del email

-- CLINICAS
DROP POLICY IF EXISTS "clinicas_write_admin" ON clinicas;
CREATE POLICY "clinicas_write_admin" ON clinicas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_user_id = auth.uid()
        AND rol IN ('admin', 'supervisor')
        AND activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_user_id = auth.uid()
        AND rol IN ('admin', 'supervisor')
        AND activo = true
    )
  );

-- SECTORES
DROP POLICY IF EXISTS "sectores_write_admin" ON sectores;
CREATE POLICY "sectores_write_admin" ON sectores
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_user_id = auth.uid()
        AND rol IN ('admin', 'supervisor')
        AND activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_user_id = auth.uid()
        AND rol IN ('admin', 'supervisor')
        AND activo = true
    )
  );

-- MOTIVOS_LICENCIA
DROP POLICY IF EXISTS "motivos_write_admin" ON motivos_licencia;
CREATE POLICY "motivos_write_admin" ON motivos_licencia
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_user_id = auth.uid()
        AND rol IN ('admin', 'supervisor')
        AND activo = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE auth_user_id = auth.uid()
        AND rol IN ('admin', 'supervisor')
        AND activo = true
    )
  );


-- ── VERIFICACIÓN ───────────────────────────────────────────────────

SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_name IN ('clinicas', 'sectores', 'motivos_licencia')
  AND grantee = 'authenticated'
ORDER BY table_name, privilege_type;

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE tablename IN ('clinicas', 'sectores', 'motivos_licencia')
ORDER BY tablename, policyname;
