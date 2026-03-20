-- ============================================================
-- Migration: codigos_turno
-- Tabla de códigos de turno con flag es_laboral
-- Los códigos con es_laboral=true son contados como día trabajado
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS codigos_turno (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo      text NOT NULL UNIQUE,
  descripcion text,
  es_laboral  boolean NOT NULL DEFAULT true,
  color       text,   -- hex opcional para UI (ej. '#0891B2')
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE codigos_turno ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública codigos_turno" ON codigos_turno FOR SELECT USING (true);
CREATE POLICY "Admin gestiona codigos_turno"  ON codigos_turno FOR ALL   USING (auth.role() = 'authenticated');

-- ============================================================
-- Seed: códigos laborales (es_laboral = true)
-- ============================================================
INSERT INTO codigos_turno (codigo, descripcion, es_laboral, color) VALUES
  ('M',   'Mañana',                  true,  '#0891B2'),
  ('MS',  'Mañana Sábado',           true,  '#0891B2'),
  ('MC',  'Mañana Compensatorio',    true,  '#0EA5E9'),
  ('MG',  'Mañana Guardia',          true,  '#0891B2'),
  ('MO',  'Mañana Ordinaria',        true,  '#0891B2'),
  ('MU',  'Mañana Urgente',          true,  '#DC2626'),
  ('MD',  'Mañana Domingo',          true,  '#0891B2'),
  ('T',   'Tarde',                   true,  '#7C3AED'),
  ('TS',  'Tarde Sábado',            true,  '#7C3AED'),
  ('TC',  'Tarde Compensatorio',     true,  '#8B5CF6'),
  ('TG',  'Tarde Guardia',           true,  '#7C3AED'),
  ('TO',  'Tarde Ordinaria',         true,  '#7C3AED'),
  ('TU',  'Tarde Urgente',           true,  '#DC2626'),
  ('TD',  'Tarde Domingo',           true,  '#7C3AED'),
  ('N',   'Noche',                   true,  '#1E3A5F'),
  ('NS',  'Noche Sábado',            true,  '#1E3A5F'),
  ('NG',  'Noche Guardia',           true,  '#1E3A5F'),
  ('NO',  'Noche Ordinaria',         true,  '#1E3A5F'),
  ('NU',  'Noche Urgente',           true,  '#DC2626'),
  ('ND',  'Noche Domingo',           true,  '#1E3A5F'),
  ('V',   'Vespertino',              true,  '#059669'),
  ('VO',  'Vespertino Ordinario',    true,  '#059669'),
  ('VU',  'Vespertino Urgente',      true,  '#DC2626'),
  ('VD',  'Vespertino Domingo',      true,  '#059669'),
  ('RS',  'Retén / Presencia',       true,  '#F59E0B'),
  ('CPB', 'Cambio Puesto Bajo',      true,  '#6B7280'),
  ('GINE','Ginecología',             true,  '#EC4899'),
  ('AXO', 'Axología',                true,  '#6B7280'),
  ('H',   'Horas Extra',             true,  '#F97316'),
  ('AP',  'Apoyo',                   true,  '#6B7280'),
  ('U1',  'Urgencia 1',              true,  '#DC2626'),
  ('U2',  'Urgencia 2',              true,  '#DC2626'),
  ('DOM', 'Domingo',                 true,  '#0891B2'),
  ('PSR', 'Presencia',               true,  '#6B7280'),
  ('O',   'Otro',                    true,  '#6B7280'),
  ('CG',  'Cobertura Guardia',       true,  '#0891B2'),
  ('CWM', 'Coworking Mañana',        true,  '#0891B2'),
  ('ES',  'Especialidad',            true,  '#6B7280'),
  ('CWT', 'Coworking Tarde',         true,  '#7C3AED'),
  ('FI',  'Formación Interna',       true,  '#0891B2'),
  ('BSE', 'Baja Sueldo Empresa',     true,  '#6B7280'),
  ('BPS', 'Baja BPS',                true,  '#6B7280'),
  ('LM',  'Licencia Médica',         true,  '#6B7280'),
  ('CMP', 'Cumpleaños',              true,  '#F59E0B'),
  ('NC',  'Noche Compensatorio',     true,  '#1E3A5F'),
  ('I',   'Interno',                 true,  '#6B7280'),
  ('E',   'Especial',                true,  '#6B7280')
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================
-- Seed: códigos NO laborales (es_laboral = false)
-- ============================================================
INSERT INTO codigos_turno (codigo, descripcion, es_laboral, color) VALUES
  ('LAR',        'Licencia Anual Reglamentaria', false, '#94A3B8'),
  ('LE',         'Licencia Especial',             false, '#94A3B8'),
  ('F',          'Franco / Día libre',            false, '#94A3B8'),
  ('DXF',        'Descanso x Franco',             false, '#94A3B8'),
  ('CPL',        'Compensatorio Libre',           false, '#94A3B8'),
  ('LX1',        'Licencia Extra 1',              false, '#94A3B8'),
  ('LX2',        'Licencia Extra 2',              false, '#94A3B8'),
  ('LX3',        'Licencia Extra 3',              false, '#94A3B8'),
  ('LX4',        'Licencia Extra 4',              false, '#94A3B8'),
  ('LXE',        'Licencia Extra Especial',       false, '#94A3B8'),
  ('NO CONVOCAR','No Convocar',                   false, '#EF4444'),
  ('MAT',        'Maternidad',                    false, '#94A3B8'),
  ('PAT',        'Paternidad',                    false, '#94A3B8'),
  ('CERT',       'Certificado Médico',            false, '#F59E0B')
ON CONFLICT (codigo) DO NOTHING;
