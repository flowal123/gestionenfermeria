-- Migration: Extend cambios.estado CHECK constraint
-- Adds: aceptado_receptor, rechazado_receptor
-- Run in Supabase SQL editor

-- Drop existing constraint (name may vary — adjust if needed)
ALTER TABLE cambios DROP CONSTRAINT IF EXISTS cambios_estado_check;

-- Re-add with all valid states
ALTER TABLE cambios
  ADD CONSTRAINT cambios_estado_check
  CHECK (estado IN ('pendiente', 'aceptado_receptor', 'rechazado_receptor', 'aprobado', 'rechazado'));

-- Ensure alertas table has funcionario_id column (nullable = broadcast when NULL)
ALTER TABLE alertas
  ADD COLUMN IF NOT EXISTS funcionario_id uuid REFERENCES funcionarios(id) ON DELETE CASCADE;

-- Index for fast per-user alert queries
CREATE INDEX IF NOT EXISTS idx_alertas_funcionario_id ON alertas(funcionario_id);
