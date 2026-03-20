-- Migration: Gestión de contraseñas de usuarios
-- Ejecutar en Supabase SQL Editor

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON usuarios(auth_user_id);

COMMENT ON COLUMN usuarios.must_change_password IS 'Si true, el usuario debe cambiar su contraseña al próximo login';
COMMENT ON COLUMN usuarios.auth_user_id IS 'UUID del usuario en Supabase Auth (auth.users.id)';
