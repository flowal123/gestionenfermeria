-- ==================================================================
-- GuardiaApp — Creación de usuarios del sistema
-- Ejecutar en: Supabase > SQL Editor
-- ==================================================================
-- ESQUEMA DE AUTENTICACIÓN:
--   - Los usuarios ingresan con un NOMBRE DE USUARIO (no email)
--   - Internamente, Supabase Auth usa: usuario@guardiapp.app
--   - El email personal del funcionario (en funcionarios.email)
--     es solo para notificaciones y NO se usa para ingresar al sistema
--
-- Ejemplo: usuario "garcia_565" → Supabase Auth usa garcia_565@guardiapp.app
--          La enfermera ingresa escribiendo "garcia_565" en el login
--
-- Para roles admin/supervisor con email corporativo real,
-- se puede usar el email directamente como usuario.
--
-- PASOS:
--   1. PASO 1: Crear usuarios en auth.users (autenticación)
--   2. PASO 2: Registrar roles en la tabla pública `usuarios`
--   3. PASO 3 (opcional): Vincular cada usuario a su funcionario
--   4. VERIFICACIÓN final
--
-- CONTRASEÑA TEMPORAL: GuardiaApp2026!
--   Cambiar después del primer ingreso desde el app o desde
--   Supabase Dashboard > Authentication > Users
-- ==================================================================


-- ----------------------------------------------------------------
-- PASO 1: Crear usuarios en auth.users
-- (idempotente — el WHERE NOT EXISTS evita duplicados)
-- ----------------------------------------------------------------

-- ADMIN / GERENCIA
-- Username: admin  → ingresa como "admin" en el login
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'admin@guardiapp.app',
  crypt('GuardiaApp2026!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Administrador"}'::jsonb,
  false, '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@guardiapp.app'
);

-- SUPERVISOR 1
-- Username: supervisora  → ingresa como "supervisora" en el login
-- (actualizar el username según corresponda, ej: "lorenzo" o "garcia")
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'supervisora@guardiapp.app',
  crypt('GuardiaApp2026!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Supervisora"}'::jsonb,
  false, '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'supervisora@guardiapp.app'
);

-- ENFERMERA DE PRUEBA
-- Username: garcia_565  → ingresa como "garcia_565" en el login
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(), 'authenticated', 'authenticated',
  'garcia_565@guardiapp.app',
  crypt('GuardiaApp2026!', gen_salt('bf')),
  NOW(), NOW(), NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"nombre":"Enfermera"}'::jsonb,
  false, '', ''
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'garcia_565@guardiapp.app'
);


-- ----------------------------------------------------------------
-- PASO 2: Registrar roles en la tabla pública `usuarios`
-- Vincula cada auth.user con su rol en el sistema
-- ----------------------------------------------------------------

INSERT INTO usuarios (email, rol, activo)
SELECT 'admin@guardiapp.app', 'admin', true
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE email = 'admin@guardiapp.app'
);

INSERT INTO usuarios (email, rol, activo)
SELECT 'supervisora@guardiapp.app', 'supervisor', true
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE email = 'supervisora@guardiapp.app'
);

INSERT INTO usuarios (email, rol, activo)
SELECT 'garcia_565@guardiapp.app', 'nurse', true
WHERE NOT EXISTS (
  SELECT 1 FROM usuarios WHERE email = 'garcia_565@guardiapp.app'
);


-- ----------------------------------------------------------------
-- PASO 3 (opcional): Vincular usuario a funcionario
-- Esto permite que el app muestre el nombre real y sector
-- en la barra lateral al iniciar sesión.
--
-- Reemplazar 'APELLIDO_AQUI' con el apellido exacto del funcionario.
-- ----------------------------------------------------------------

-- Ejemplo: vincular supervisora a su registro de funcionaria
-- UPDATE usuarios
--   SET funcionario_id = (
--     SELECT id FROM funcionarios
--     WHERE apellido ILIKE 'APELLIDO_AQUI' AND tipo = 'fijo'
--     LIMIT 1
--   )
-- WHERE email = 'supervisora@guardiapp.app';

-- Ejemplo: vincular enfermera de prueba
-- UPDATE usuarios
--   SET funcionario_id = (
--     SELECT id FROM funcionarios
--     WHERE apellido ILIKE 'APELLIDO_AQUI' AND tipo = 'fijo'
--     LIMIT 1
--   )
-- WHERE email = 'garcia_565@guardiapp.app';


-- ----------------------------------------------------------------
-- VERIFICACIÓN
-- ----------------------------------------------------------------

-- Ver usuarios auth creados
SELECT id, email, email_confirmed_at, created_at
FROM auth.users
WHERE email LIKE '%mp-enfermeria%'
ORDER BY created_at DESC;

-- Ver registros en tabla usuarios con su funcionario vinculado
SELECT
  u.email,
  u.rol,
  u.activo,
  u.funcionario_id,
  f.apellido || ', ' || COALESCE(f.nombre, '') AS funcionario,
  s.nombre AS sector
FROM usuarios u
LEFT JOIN funcionarios f ON f.id = u.funcionario_id
LEFT JOIN sectores s     ON s.id = f.sector_id
ORDER BY u.rol, u.email;
