/**
 * rls/clinicas.test.js
 * Policy: SELECT = true (sin restricción de rol — lectura pública para authenticated)
 * Nota: anon probablemente bloqueado por la configuración de Supabase anon key
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, supervisorClient, nurseAClient, anonClientFactory, expectBlocked, expectAllowed } from '../helpers/clients.js';
import { seedAll, cleanAll } from '../helpers/seed.js';

let admin, supervisor, nurseA;

beforeAll(async () => {
  await seedAll();
  ({ client: admin }      = await adminClient());
  ({ client: supervisor } = await supervisorClient());
  ({ client: nurseA }     = await nurseAClient());
});

afterAll(cleanAll);

describe('clinicas SELECT', () => {

  it('admin puede leer clínicas', async () => {
    const res = await admin.from('clinicas').select('id, nombre').limit(10);
    expectAllowed(res, 'admin SELECT clinicas');
  });

  it('supervisor puede leer clínicas', async () => {
    const res = await supervisor.from('clinicas').select('id, nombre').limit(10);
    expectAllowed(res);
  });

  it('nurse puede leer clínicas', async () => {
    const res = await nurseA.from('clinicas').select('id, nombre').limit(10);
    expectAllowed(res);
  });

  it('anon NO puede leer clínicas', async () => {
    const anon = anonClientFactory();
    const res = await anon.from('clinicas').select('id').limit(1);
    expectBlocked(res);
  });

});

describe('clinicas INSERT/UPDATE/DELETE', () => {

  it('nurse NO puede insertar clínicas', async () => {
    const res = await nurseA.from('clinicas').insert({ nombre: 'TEST_HACK', codigo: 'THK' });
    expectBlocked(res);
  });

  it('supervisor NO puede insertar clínicas', async () => {
    const res = await supervisor.from('clinicas').insert({ nombre: 'TEST_HACK_SUP', codigo: 'THS' });
    expectBlocked(res);
  });

});
