-- ==================================================================
-- GuardiaApp — Migrar usuarios existentes al formato username
-- Ejecutar en: Supabase > SQL Editor
-- ==================================================================
-- Convierte cuentas con email real (admin@mp-enfermeria.com, etc.)
-- al nuevo formato: username@guardiapp.app
--
-- El username se deriva del prefijo del email original.
-- Ej: admin@mp-enfermeria.com → admin@guardiapp.app
--     supervisora@mp-enfermeria.com → supervisora@guardiapp.app
--     enfermera@mp-enfermeria.com → enfermera@guardiapp.app
--
-- Los emails personales se cargan después con la lista que provea el admin.
-- ==================================================================

-- ----------------------------------------------------------------
-- PASO 1: Actualizar auth.users (tabla interna de Supabase Auth)
-- ----------------------------------------------------------------

UPDATE auth.users
SET
  email              = split_part(email, '@', 1) || '@guardiapp.app',
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at         = NOW()
WHERE email NOT LIKE '%@guardiapp.app';

-- ----------------------------------------------------------------
-- PASO 2: Sincronizar tabla pública usuarios
-- ----------------------------------------------------------------

UPDATE usuarios u
SET email = au.email
FROM auth.users au
WHERE
  -- Matchear por el prefijo del email (parte antes del @)
  split_part(u.email, '@', 1) = split_part(au.email, '@', 1)
  AND au.email LIKE '%@guardiapp.app'
  AND u.email NOT LIKE '%@guardiapp.app';

-- ----------------------------------------------------------------
-- VERIFICACIÓN — ejecutar para confirmar que todo quedó bien
-- ----------------------------------------------------------------

SELECT
  au.email        AS auth_email,
  u.email         AS usuarios_email,
  u.rol,
  u.activo,
  f.apellido || ', ' || COALESCE(f.nombre,'') AS funcionario
FROM auth.users au
JOIN usuarios u ON split_part(au.email,'@',1) = split_part(u.email,'@',1)
LEFT JOIN funcionarios f ON f.id = u.funcionario_id
WHERE au.email LIKE '%@guardiapp.app'
ORDER BY u.rol;
