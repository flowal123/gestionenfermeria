-- ==================================================================
-- GuardiaApp — Migración de datos: Feedback Marzo 2026
-- Ejecutar en: Supabase > SQL Editor
-- Tabla principal: funcionarios (tipo='fijo' | 'suplente')
-- ==================================================================
-- INSTRUCCIONES:
--   1. Ejecutar el PASO 1 primero (columnas nuevas)
--   2. Ejecutar los pasos 2-8 en orden
--   3. En cada UPDATE verás "X rows affected" — si es 0, revisar
--      que el apellido/nombre coincida con lo que está en tu BD
-- ==================================================================


-- ----------------------------------------------------------------
-- PASO 1: Nuevas columnas en la tabla funcionarios
-- (idempotente — se puede ejecutar más de una vez sin problemas)
-- ----------------------------------------------------------------
ALTER TABLE funcionarios
  ADD COLUMN IF NOT EXISTS fecha_ingreso        date,
  ADD COLUMN IF NOT EXISTS alerta_ingreso_dias  integer DEFAULT 45,
  ADD COLUMN IF NOT EXISTS disponibilidad       text,
  ADD COLUMN IF NOT EXISTS regime               text,
  ADD COLUMN IF NOT EXISTS sched_note           text,
  ADD COLUMN IF NOT EXISTS programa             text,
  ADD COLUMN IF NOT EXISTS le_random            boolean DEFAULT false,
  -- Suplente con asignación de titularidad momentánea (interinato)
  -- sector_id ya almacena el sector asignado; este flag lo activa en planilla
  ADD COLUMN IF NOT EXISTS titularidad_temp     boolean DEFAULT false;


-- ----------------------------------------------------------------
-- PASO 2: Nuevos sectores
-- ----------------------------------------------------------------
INSERT INTO sectores (nombre, codigo)
SELECT 'TISANERÍA', 'TIS'
WHERE NOT EXISTS (SELECT 1 FROM sectores WHERE nombre = 'TISANERÍA');

INSERT INTO sectores (nombre, codigo)
SELECT 'BQ', 'BQ'
WHERE NOT EXISTS (SELECT 1 FROM sectores WHERE nombre = 'BQ');


-- ----------------------------------------------------------------
-- PASO 3: CLASIFICACIÓN SIN SECTOR — asignar sectores a fijos
-- ⚠ Si algún UPDATE devuelve 0 rows, verificar nombre exacto con:
--   SELECT id, apellido, nombre FROM funcionarios WHERE tipo='fijo';
-- ----------------------------------------------------------------

-- Lorena Prieu → PROGRAMAS (oncología)
UPDATE funcionarios SET
  sector_id = (SELECT id FROM sectores WHERE nombre = 'PROGRAMAS' LIMIT 1),
  programa  = 'oncología'
WHERE tipo = 'fijo'
  AND apellido ILIKE 'PRIEU';

-- Eugenia Cibils → PROGRAMAS (salud renal)
-- Nota: puede estar guardada como "CIBILS, MARIA EUGENIA" o "CIBILS, EUGENIA"
UPDATE funcionarios SET
  sector_id = (SELECT id FROM sectores WHERE nombre = 'PROGRAMAS' LIMIT 1),
  programa  = 'salud renal'
WHERE tipo = 'fijo'
  AND apellido ILIKE 'CIBILS';

-- Elida → TISANERÍA
UPDATE funcionarios SET
  sector_id = (SELECT id FROM sectores WHERE nombre = 'TISANERÍA' LIMIT 1)
WHERE tipo = 'fijo'
  AND nombre ILIKE 'ELIDA';

-- Silvana → TISANERÍA
UPDATE funcionarios SET
  sector_id = (SELECT id FROM sectores WHERE nombre = 'TISANERÍA' LIMIT 1)
WHERE tipo = 'fijo'
  AND nombre ILIKE 'SILVANA';

-- Fiorella García → BQ
UPDATE funcionarios SET
  sector_id = (SELECT id FROM sectores WHERE nombre = 'BQ' LIMIT 1)
WHERE tipo = 'fijo'
  AND apellido ILIKE 'GARCIA'
  AND nombre   ILIKE 'FIORELLA';

-- Analía Huart → BQ
UPDATE funcionarios SET
  sector_id = (SELECT id FROM sectores WHERE nombre = 'BQ' LIMIT 1)
WHERE tipo = 'fijo'
  AND apellido ILIKE 'HUART';


-- ----------------------------------------------------------------
-- PASO 4: Regímenes y schedules especiales en fijos existentes
-- ----------------------------------------------------------------

-- Florencia Rodríguez → régimen 4x1
UPDATE funcionarios SET
  regime = '4x1'
WHERE tipo = 'fijo'
  AND apellido ILIKE 'RODRIGUEZ'
  AND nombre   ILIKE 'FLORENCIA';

-- Aníbal (ecoestrés) → L-V excepto miércoles + 4to sábado del mes
UPDATE funcionarios SET
  sched_note = '4to sáb + L-V exc. mié'
WHERE tipo = 'fijo'
  AND nombre ILIKE 'ANIBAL%';

-- Javier Rodríguez → domingo a lunes, descansa sábados
UPDATE funcionarios SET
  turno_fijo = 'DOM',
  sched_note = 'dom-lun, desc. sáb'
WHERE tipo = 'fijo'
  AND apellido ILIKE 'RODRIGUEZ'
  AND nombre   ILIKE 'JAVIER';

-- María Caballero → tarde L-V
UPDATE funcionarios SET
  turno_fijo = 'T',
  sched_note = 'tarde L-V'
WHERE apellido ILIKE 'CABALLERO'
  AND nombre   ILIKE '%MARIA%';

-- Zunino → tarde (Aguada Park)
UPDATE funcionarios SET
  turno_fijo = 'T',
  clinica_id = (SELECT id FROM clinicas WHERE nombre ILIKE '%AGUADA%' LIMIT 1)
WHERE apellido ILIKE 'ZUNINO';

-- Carol Da Silva → tarde
UPDATE funcionarios SET
  turno_fijo = 'T'
WHERE apellido ILIKE 'DA SILVA'
  AND nombre   ILIKE 'CAROL';


-- ----------------------------------------------------------------
-- PASO 5: Marcar le_random = true para fijos con turno L-S
-- (la generación automática les asignará 1 LE aleatorio por período)
-- Se excluyen regímenes especiales como 4x1
-- ----------------------------------------------------------------
UPDATE funcionarios SET
  le_random = true
WHERE tipo = 'fijo'
  AND turno_fijo IN ('M','MS','MC','MG','MU','MD','T','TS','TC','TG','TU','TD','RS')
  AND (regime IS NULL OR regime NOT IN ('4x1'));


-- ----------------------------------------------------------------
-- PASO 6: SUPLENTES — agregar disponibilidad a los existentes
-- Valores posibles: 'tarde-vespertino' | 'total' | 'mañana-tarde'
-- ----------------------------------------------------------------
UPDATE funcionarios SET disponibilidad = 'tarde-vespertino'
  WHERE tipo = 'suplente' AND apellido ILIKE 'MACHADO';

UPDATE funcionarios SET disponibilidad = 'tarde-vespertino'
  WHERE tipo = 'suplente' AND apellido ILIKE 'CIBILS';

UPDATE funcionarios SET disponibilidad = 'tarde-vespertino'
  WHERE tipo = 'suplente' AND apellido ILIKE 'FORNASIER';

UPDATE funcionarios SET disponibilidad = 'total'
  WHERE tipo = 'suplente' AND nombre ILIKE 'JOSELYN';

-- N. OJEDA y ME. CIBILS: suplentes con titularidad momentánea
-- Se actualizan como suplentes pero con titularidad_temp=true y sector asignado
UPDATE funcionarios SET
  disponibilidad   = 'tarde-vespertino',
  titularidad_temp = true,
  sector_id        = (SELECT id FROM sectores WHERE nombre = 'CPB' LIMIT 1)
WHERE tipo = 'suplente' AND apellido ILIKE 'OJEDA';

UPDATE funcionarios SET
  disponibilidad   = 'tarde-vespertino',
  titularidad_temp = true,
  programa         = 'salud renal',
  sector_id        = (SELECT id FROM sectores WHERE nombre = 'PROGRAMAS' LIMIT 1)
WHERE tipo = 'suplente' AND apellido ILIKE 'CIBILS';

UPDATE funcionarios SET disponibilidad = 'tarde-vespertino'
  WHERE tipo = 'suplente' AND apellido ILIKE 'DENIS';

UPDATE funcionarios SET disponibilidad = 'tarde-vespertino'
  WHERE tipo = 'suplente' AND apellido ILIKE 'FERNANDEZ';

UPDATE funcionarios SET disponibilidad = 'mañana-tarde'
  WHERE tipo = 'suplente' AND apellido ILIKE 'MILA';

UPDATE funcionarios SET disponibilidad = 'mañana-tarde'
  WHERE tipo = 'suplente' AND apellido ILIKE 'SAMURIO';

UPDATE funcionarios SET disponibilidad = 'total'
  WHERE tipo = 'suplente' AND apellido ILIKE 'BARRETO';

-- C. PEREZ (tarde-vespertino) — apellido sin tilde
UPDATE funcionarios SET disponibilidad = 'tarde-vespertino'
  WHERE tipo = 'suplente' AND apellido ILIKE 'PEREZ' AND nombre ILIKE 'C%';

UPDATE funcionarios SET disponibilidad = 'tarde-vespertino'
  WHERE tipo = 'suplente' AND apellido ILIKE 'MORALES';

UPDATE funcionarios SET disponibilidad = 'total'
  WHERE tipo = 'suplente' AND apellido ILIKE 'ABREU';

UPDATE funcionarios SET disponibilidad = 'total'
  WHERE tipo = 'suplente' AND apellido ILIKE 'GONZALEZ';

-- F. PÉREZ (total) — apellido con tilde; si no matchea probar sin tilde
UPDATE funcionarios SET disponibilidad = 'total'
  WHERE tipo = 'suplente'
    AND (apellido ILIKE 'PÉREZ' OR apellido ILIKE 'PEREZ')
    AND nombre ILIKE 'F%';

UPDATE funcionarios SET disponibilidad = 'tarde-vespertino'
  WHERE tipo = 'suplente' AND apellido ILIKE 'ANDRADA';


-- ----------------------------------------------------------------
-- PASO 7: Insertar nuevos suplentes (solo si no existen ya)
-- ----------------------------------------------------------------

-- G. FORNASIER
INSERT INTO funcionarios (apellido, nombre, tipo, activo, disponibilidad, horas_semana, horas_dia)
SELECT 'FORNASIER', 'G.', 'suplente', true, 'tarde-vespertino', 36, 6
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE apellido ILIKE 'FORNASIER' AND tipo = 'suplente'
);

-- JOSELYN CASTRO
INSERT INTO funcionarios (apellido, nombre, tipo, activo, disponibilidad, horas_semana, horas_dia)
SELECT 'CASTRO', 'JOSELYN', 'suplente', true, 'total', 36, 6
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE nombre ILIKE 'JOSELYN' AND tipo = 'suplente'
);

-- A. ABREU
INSERT INTO funcionarios (apellido, nombre, tipo, activo, disponibilidad, horas_semana, horas_dia)
SELECT 'ABREU', 'A.', 'suplente', true, 'total', 36, 6
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE apellido ILIKE 'ABREU' AND tipo = 'suplente'
);

-- M. GONZALEZ
INSERT INTO funcionarios (apellido, nombre, tipo, activo, disponibilidad, horas_semana, horas_dia)
SELECT 'GONZALEZ', 'M.', 'suplente', true, 'total', 36, 6
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE apellido ILIKE 'GONZALEZ' AND tipo = 'suplente'
);

-- F. PÉREZ  (apellido con tilde; probar ambas variantes si falla)
INSERT INTO funcionarios (apellido, nombre, tipo, activo, disponibilidad, horas_semana, horas_dia)
SELECT 'PÉREZ', 'F.', 'suplente', true, 'total', 36, 6
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios
  WHERE (apellido ILIKE 'PÉREZ' OR apellido ILIKE 'PEREZ')
    AND nombre ILIKE 'F%'
    AND tipo = 'suplente'
);

-- ANDRADA
INSERT INTO funcionarios (apellido, nombre, tipo, activo, disponibilidad, horas_semana, horas_dia)
SELECT 'ANDRADA', '', 'suplente', true, 'tarde-vespertino', 36, 6
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE apellido ILIKE 'ANDRADA' AND tipo = 'suplente'
);


-- ----------------------------------------------------------------
-- PASO 8: Insertar nuevos fijos (solo si no existen ya)
-- Completar clinica_id / sector_id luego si no se resuelven por nombre
-- ----------------------------------------------------------------

-- Zunino — Aguada Park, tarde
INSERT INTO funcionarios (apellido, nombre, tipo, activo, turno_fijo, horas_semana, horas_dia, clinica_id)
SELECT 'ZUNINO', '', 'fijo', true, 'T', 36, 6,
  (SELECT id FROM clinicas WHERE nombre ILIKE '%AGUADA%' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE apellido ILIKE 'ZUNINO'
);

-- Carol Da Silva — tarde
INSERT INTO funcionarios (apellido, nombre, tipo, activo, turno_fijo, horas_semana, horas_dia)
SELECT 'DA SILVA', 'CAROL', 'fijo', true, 'T', 36, 6
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE apellido ILIKE 'DA SILVA' AND nombre ILIKE 'CAROL'
);

-- Aníbal (ecoestrés)
INSERT INTO funcionarios (apellido, nombre, tipo, activo, turno_fijo, horas_semana, horas_dia, sched_note)
SELECT 'ANIBAL', '', 'fijo', true, 'M', 36, 6, '4to sáb + L-V exc. mié'
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE nombre ILIKE 'ANIBAL%' OR apellido ILIKE 'ANIBAL%'
);

-- Javier Rodríguez — dom-lun, desc. sáb
INSERT INTO funcionarios (apellido, nombre, tipo, activo, turno_fijo, horas_semana, horas_dia, sched_note)
SELECT 'RODRIGUEZ', 'JAVIER', 'fijo', true, 'DOM', 36, 6, 'dom-lun, desc. sáb'
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE apellido ILIKE 'RODRIGUEZ' AND nombre ILIKE 'JAVIER'
);

-- Elida — TISANERÍA (si no existe como fijo)
INSERT INTO funcionarios (apellido, nombre, tipo, activo, turno_fijo, horas_semana, horas_dia, sector_id)
SELECT 'ELIDA', '', 'fijo', true, 'M', 36, 6,
  (SELECT id FROM sectores WHERE nombre = 'TISANERÍA' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE nombre ILIKE 'ELIDA'
);

-- Silvana — TISANERÍA (si no existe como fijo)
INSERT INTO funcionarios (apellido, nombre, tipo, activo, turno_fijo, horas_semana, horas_dia, sector_id)
SELECT 'SILVANA', '', 'fijo', true, 'M', 36, 6,
  (SELECT id FROM sectores WHERE nombre = 'TISANERÍA' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE nombre ILIKE 'SILVANA'
);

-- Fiorella García — BQ
INSERT INTO funcionarios (apellido, nombre, tipo, activo, turno_fijo, horas_semana, horas_dia, sector_id)
SELECT 'GARCIA', 'FIORELLA', 'fijo', true, 'M', 36, 6,
  (SELECT id FROM sectores WHERE nombre = 'BQ' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE apellido ILIKE 'GARCIA' AND nombre ILIKE 'FIORELLA'
);

-- Analía Huart — BQ
INSERT INTO funcionarios (apellido, nombre, tipo, activo, turno_fijo, horas_semana, horas_dia, sector_id)
SELECT 'HUART', 'ANALIA', 'fijo', true, 'M', 36, 6,
  (SELECT id FROM sectores WHERE nombre = 'BQ' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM funcionarios WHERE apellido ILIKE 'HUART'
);


-- ----------------------------------------------------------------
-- VERIFICACIÓN FINAL — ejecutar después de los pasos anteriores
-- para confirmar que todo quedó aplicado correctamente
-- ----------------------------------------------------------------

-- Ver nuevos sectores
SELECT id, nombre, codigo FROM sectores ORDER BY nombre;

-- Ver funcionarios fijos con datos nuevos
SELECT f.apellido, f.nombre, f.turno_fijo, f.regime, f.sched_note, f.programa, f.le_random,
       s.nombre AS sector
FROM funcionarios f
LEFT JOIN sectores s ON s.id = f.sector_id
WHERE f.tipo = 'fijo'
ORDER BY f.apellido;

-- Ver suplentes con disponibilidad y titularidad
SELECT f.apellido, f.nombre, f.disponibilidad, f.titularidad_temp,
       s.nombre AS sector_temp
FROM funcionarios f
LEFT JOIN sectores s ON s.id = f.sector_id
WHERE f.tipo = 'suplente'
ORDER BY f.apellido;

-- Ver funcionarios fijos sin sector asignado (deberían ser 0)
SELECT f.apellido, f.nombre FROM funcionarios f
WHERE f.tipo = 'fijo' AND f.activo = true AND f.sector_id IS NULL
ORDER BY f.apellido;
