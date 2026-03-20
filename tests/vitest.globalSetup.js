/**
 * vitest.globalSetup.js — corre UNA VEZ antes de toda la suite.
 *
 * Para cada rol:
 *   1. Intenta login directo → si funciona, listo.
 *   2. Si falla, intenta crear el usuario via Admin API (si no existía).
 *   3. Si ya existe pero no puede loguearse, busca su ID paginando
 *      y lo repara con updateUserById (recrea auth.identities correctamente).
 *   4. Si todo falla, lanza error con el SQL exacto a ejecutar en Supabase.
 */
import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dir = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dir, '.sessions.json');

/** Busca un usuario por email paginando de a 50 (evita el error con pages grandes) */
async function findUserByEmail(svc, email) {
  let page = 1;
  while (true) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 50 });
    if (error || !data?.users?.length) break;
    const found = data.users.find(u => u.email === email);
    if (found) return found;
    if (data.users.length < 50) break; // última página
    page++;
    if (page > 40) break; // límite de seguridad (~2000 usuarios)
  }
  return null;
}

async function ensureAuthUser(label, email, password, svc, URL, ANON) {
  const anon = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

  // ── Intento 1: login directo ──────────────────────────────
  {
    const { data, error } = await anon().auth.signInWithPassword({ email, password });
    if (!error) return { access_token: data.session.access_token, refresh_token: data.session.refresh_token };
    console.log(`  [setup] ${label}: login inicial falló (${error.message}) → reparando...`);
  }

  // ── Intento 2: crear usuario (funciona si no existe en auth) ──
  {
    const { data, error: createErr } = await svc.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (!createErr) {
      console.log(`  [setup] ${label}: creado via Admin API ✓`);
      const { data: d2, error: e2 } = await anon().auth.signInWithPassword({ email, password });
      if (!e2) return { access_token: d2.session.access_token, refresh_token: d2.session.refresh_token };
      throw new Error(`${label}: usuario creado pero login sigue fallando: ${e2.message}`);
    }
    // createUser falló → el usuario ya existe con auth roto
  }

  // ── Intento 3: buscar ID y reparar con updateUserById ─────
  {
    const existing = await findUserByEmail(svc, email);
    if (existing) {
      const { error: updErr } = await svc.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
      });
      if (!updErr) {
        console.log(`  [setup] ${label}: reparado via updateUserById ✓`);
        const { data: d3, error: e3 } = await anon().auth.signInWithPassword({ email, password });
        if (!e3) return { access_token: d3.session.access_token, refresh_token: d3.session.refresh_token };
        throw new Error(`${label}: reparado pero login sigue fallando: ${e3.message}`);
      }
    }
  }

  // ── Todo falló — instrucciones manuales ───────────────────
  throw new Error(
    `\n\nNo se pudo autenticar ${label} (${email}).\n` +
    `Ejecutá este SQL en Supabase → SQL Editor y volvé a correr npm test:\n\n` +
    `  -- Reparar contraseña\n` +
    `  UPDATE auth.users\n` +
    `  SET encrypted_password = crypt('${password}', gen_salt('bf')),\n` +
    `      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),\n` +
    `      updated_at = NOW()\n` +
    `  WHERE email = '${email}';\n\n` +
    `  -- Reparar identidades (requeridas para signInWithPassword)\n` +
    `  INSERT INTO auth.identities\n` +
    `    (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)\n` +
    `  SELECT gen_random_uuid(), id,\n` +
    `    jsonb_build_object('sub', id::text, 'email', email),\n` +
    `    'email', NOW(), NOW(), NOW()\n` +
    `  FROM auth.users WHERE email = '${email}'\n` +
    `  AND NOT EXISTS (\n` +
    `    SELECT 1 FROM auth.identities WHERE user_id = auth.users.id AND provider = 'email'\n` +
    `  );\n`
  );
}

export async function setup() {
  dotenv.config({ path: join(__dir, '.env') });

  const URL  = process.env.SUPABASE_URL;
  const ANON = process.env.SUPABASE_ANON_KEY;
  const SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!URL || !ANON || !SVC) {
    throw new Error('globalSetup: faltan variables de entorno (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY)');
  }

  const svc = createClient(URL, SVC, { auth: { persistSession: false, autoRefreshToken: false } });

  const roles = [
    ['admin',      process.env.TEST_ADMIN_EMAIL,      process.env.TEST_ADMIN_PASS],
    ['supervisor', process.env.TEST_SUPERVISOR_EMAIL, process.env.TEST_SUPERVISOR_PASS],
    ['nurseA',     process.env.TEST_NURSE_A_EMAIL,    process.env.TEST_NURSE_A_PASS],
    ['nurseB',     process.env.TEST_NURSE_B_EMAIL,    process.env.TEST_NURSE_B_PASS],
  ];

  const sessions = {};
  for (const [role, email, password] of roles) {
    sessions[role] = await ensureAuthUser(role, email, password, svc, URL, ANON);
  }

  writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2));
  console.log('globalSetup ✓ — sesiones guardadas');
}

export async function teardown() {
  if (existsSync(SESSION_FILE)) unlinkSync(SESSION_FILE);
}
