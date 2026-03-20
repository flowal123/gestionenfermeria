/**
 * clients.js — Supabase client factory por rol
 *
 * Los JWT se generan UNA VEZ en vitest.globalSetup.js (4 signInWithPassword totales
 * para toda la suite) y se leen desde .sessions.json.
 * Esto evita el rate-limit de Supabase Auth por múltiples logins consecutivos.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const URL  = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;
const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !ANON) throw new Error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en .env');
if (!SVC)          throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en .env');

// ---------- helpers internos ----------

function anonClient() {
  return createClient(URL, ANON);
}

/** Lee .sessions.json generado por globalSetup y devuelve un cliente autenticado */
function clientFromSession(role) {
  let sessions;
  try {
    sessions = JSON.parse(readFileSync(join(__dir, '../.sessions.json'), 'utf8'));
  } catch {
    throw new Error(`clients.js: no se encontró .sessions.json — ¿corrió globalSetup? (rol: ${role})`);
  }

  const sess = sessions[role];
  if (!sess) throw new Error(`clients.js: sesión no encontrada para rol "${role}"`);

  // Pasar el JWT directamente como header — no requiere red, no consume rate-limit
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${sess.access_token}` } },
  });
  return { client };
}

// ---------- exports por rol ----------

export async function adminClient()      { return clientFromSession('admin'); }
export async function supervisorClient() { return clientFromSession('supervisor'); }
export async function nurseAClient()     { return clientFromSession('nurseA'); }
export async function nurseBClient()     { return clientFromSession('nurseB'); }

export function anonClientFactory() {
  return anonClient();
}

/** Service-role client — bypassa RLS, solo para seed/cleanup */
export function serviceClient() {
  if (!SVC) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada');
  return createClient(URL, SVC, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Helpers de aserción para RLS
 * isBlocked: true si Supabase retornó error de RLS (42501) o datos vacíos en SELECT
 */
export function expectBlocked(result) {
  const { data, error } = result;
  if (error) {
    // RLS insert/update/delete violations
    const isRLS =
      error.code === '42501' ||
      error.message?.toLowerCase().includes('row-level security') ||
      error.message?.toLowerCase().includes('violates row-level') ||
      error.message?.toLowerCase().includes('permission denied');
    if (!isRLS) throw new Error(`Error inesperado (no RLS): ${error.message}`);
    return; // bloqueado correctamente
  }
  // SELECT filtrado → devuelve array vacío, no error
  if (Array.isArray(data) && data.length === 0) return;
  throw new Error(`Se esperaba bloqueo RLS pero la operación fue exitosa: ${JSON.stringify(data)}`);
}

export function expectAllowed(result, label = '') {
  if (result.error) {
    throw new Error(`Se esperaba éxito${label ? ' en ' + label : ''} pero falló: ${result.error.message}`);
  }
}
