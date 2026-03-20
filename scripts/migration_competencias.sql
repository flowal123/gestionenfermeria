-- Migration: Add competencias column to funcionarios
-- Run this in Supabase SQL Editor

ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS competencias jsonb DEFAULT '[]'::jsonb;

-- Optional: verify sectores table has expected columns
-- SELECT id, nombre, codigo FROM sectores ORDER BY nombre;
