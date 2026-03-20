/**
 * auth/login.test.js
 * Valida el flujo de autenticación + resolución de rol post-login
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const URL  = process.env.SUPABASE_URL;
const ANON = process.env.SUPABASE_ANON_KEY;

function freshClient() {
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// -------------------------------------------------------
describe('Auth — login válido por rol', () => {

  it('admin puede iniciar sesión', async () => {
    const sb = freshClient();
    const { data, error } = await sb.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASS,
    });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
  });

  it('supervisor puede iniciar sesión', async () => {
    const sb = freshClient();
    const { error } = await sb.auth.signInWithPassword({
      email: process.env.TEST_SUPERVISOR_EMAIL,
      password: process.env.TEST_SUPERVISOR_PASS,
    });
    expect(error).toBeNull();
  });

  it('nurse puede iniciar sesión', async () => {
    const sb = freshClient();
    const { error } = await sb.auth.signInWithPassword({
      email: process.env.TEST_NURSE_A_EMAIL,
      password: process.env.TEST_NURSE_A_PASS,
    });
    expect(error).toBeNull();
  });

});

// -------------------------------------------------------
describe('Auth — post-login: resolución de rol desde tabla usuarios', () => {

  it('admin obtiene rol=admin desde tabla usuarios', async () => {
    const sb = freshClient();
    await sb.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASS,
    });
    const { data, error } = await sb.from('usuarios')
      .select('rol, activo')
      .eq('email', process.env.TEST_ADMIN_EMAIL)
      .eq('activo', true)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.rol).toBe('admin');
  });

  it('supervisor obtiene rol=supervisor', async () => {
    const sb = freshClient();
    await sb.auth.signInWithPassword({
      email: process.env.TEST_SUPERVISOR_EMAIL,
      password: process.env.TEST_SUPERVISOR_PASS,
    });
    const { data, error } = await sb.from('usuarios')
      .select('rol')
      .eq('email', process.env.TEST_SUPERVISOR_EMAIL)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.rol).toBe('supervisor');
  });

  it('nurse obtiene rol=nurse', async () => {
    const sb = freshClient();
    await sb.auth.signInWithPassword({
      email: process.env.TEST_NURSE_A_EMAIL,
      password: process.env.TEST_NURSE_A_PASS,
    });
    const { data, error } = await sb.from('usuarios')
      .select('rol')
      .eq('email', process.env.TEST_NURSE_A_EMAIL)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.rol).toBe('nurse');
  });

});

// -------------------------------------------------------
describe('Auth — logins inválidos', () => {

  it('contraseña incorrecta → error', async () => {
    const sb = freshClient();
    const { error } = await sb.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL,
      password: 'contraseña_incorrecta_999!',
    });
    expect(error).not.toBeNull();
  });

  it('usuario inexistente → error', async () => {
    const sb = freshClient();
    const { error } = await sb.auth.signInWithPassword({
      email: 'no_existe_jamás@guardiapp.app',
      password: 'cualquiercosa',
    });
    expect(error).not.toBeNull();
  });

  it('usuario sin registro en tabla usuarios → no puede usar la app', async () => {
    // Si no hay registro en usuarios, el SELECT post-login devuelve null
    // y la app rechaza el acceso. Este test valida que la query retorna null.
    const sb = freshClient();
    await sb.auth.signInWithPassword({
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASS,
    });
    // Buscar un email que NO existe en usuarios
    const { data } = await sb.from('usuarios')
      .select('rol')
      .eq('email', 'fantasma@guardiapp.app')
      .maybeSingle();
    expect(data).toBeNull();
  });

});
