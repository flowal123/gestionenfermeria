/**
 * rls/usuarios.test.js
 * Policy: SELECT admin ó email=propio | UPDATE admin | INSERT admin (E2)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, supervisorClient, nurseAClient, anonClientFactory, serviceClient, expectBlocked, expectAllowed } from '../helpers/clients.js';
import { seedAll, cleanAll, TEST } from '../helpers/seed.js';

let admin, supervisor, nurseA;

beforeAll(async () => {
  await seedAll();
  ({ client: admin }      = await adminClient());
  ({ client: supervisor } = await supervisorClient());
  ({ client: nurseA }     = await nurseAClient());
});

afterAll(async () => {
  await cleanAll();
});

// ── SELECT ───────────────────────────────────────────────
describe('usuarios SELECT', () => {

  it('admin ve todos los usuarios', async () => {
    const res = await admin.from('usuarios').select('id, email, rol');
    expectAllowed(res, 'admin SELECT usuarios');
    expect(res.data.length).toBeGreaterThan(1);
  });

  it('supervisor solo ve su propio registro', async () => {
    const res = await supervisor.from('usuarios').select('id, email, rol');
    expectAllowed(res);
    expect(res.data.length).toBe(1);
    expect(res.data[0].email).toBe(process.env.TEST_SUPERVISOR_EMAIL);
  });

  it('nurse solo ve su propio registro', async () => {
    const res = await nurseA.from('usuarios').select('id, email, rol');
    expectAllowed(res);
    expect(res.data.length).toBe(1);
    expect(res.data[0].email).toBe(process.env.TEST_NURSE_A_EMAIL);
  });

  it('nurse NO ve el registro del admin', async () => {
    const res = await nurseA.from('usuarios')
      .select('id, email')
      .eq('email', process.env.TEST_ADMIN_EMAIL);
    expectAllowed(res);
    expect(res.data.length).toBe(0);
  });

  it('anon no puede hacer SELECT en usuarios', async () => {
    const anon = anonClientFactory();
    const res = await anon.from('usuarios').select('id');
    expectBlocked(res);
  });

});

// ── INSERT ───────────────────────────────────────────────
describe('usuarios INSERT', () => {

  it('admin puede insertar un usuario (E2: policy admin)', async () => {
    const email = `test_insert_${Date.now()}@guardiapp.app`;
    const res = await admin.from('usuarios').insert({
      email, rol: 'nurse', activo: true,
    }).select('id').single();
    expectAllowed(res, 'admin INSERT usuarios');
    // cleanup
    const svc = serviceClient();
    await svc.from('usuarios').delete().eq('email', email);
  });

  it('supervisor NO puede insertar usuarios', async () => {
    const res = await supervisor.from('usuarios').insert({
      email: `bloqueado_${Date.now()}@guardiapp.app`, rol: 'nurse', activo: true,
    });
    expectBlocked(res);
  });

  it('nurse NO puede insertar usuarios', async () => {
    const res = await nurseA.from('usuarios').insert({
      email: `bloqueado_${Date.now()}@guardiapp.app`, rol: 'nurse', activo: true,
    });
    expectBlocked(res);
  });

  it('nurse NO puede escalarse a admin via INSERT', async () => {
    const res = await nurseA.from('usuarios').insert({
      email: `escalada_${Date.now()}@guardiapp.app`, rol: 'admin', activo: true,
    });
    expectBlocked(res);
  });

});

// ── UPDATE ───────────────────────────────────────────────
describe('usuarios UPDATE', () => {

  it('admin puede cambiar activo de otro usuario', async () => {
    // Usar nurse B (creado por seed)
    const res = await admin.from('usuarios')
      .update({ activo: true })
      .eq('email', process.env.TEST_NURSE_B_EMAIL);
    expectAllowed(res, 'admin UPDATE usuarios');
  });

  it('nurse NO puede modificar otro usuario', async () => {
    const res = await nurseA.from('usuarios')
      .update({ activo: false })
      .eq('email', process.env.TEST_ADMIN_EMAIL);
    // RLS: la fila no pasa el USING → 0 filas actualizadas (no es error)
    expect(res.error).toBeNull();
    // Verificar que el admin sigue activo
    const check = await admin.from('usuarios')
      .select('activo').eq('email', process.env.TEST_ADMIN_EMAIL).single();
    expect(check.data?.activo).toBe(true);
  });

});
