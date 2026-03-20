/**
 * rls/sectores.test.js
 * Policy:
 *   SELECT: authenticated (SELECT=true); anon bloqueado
 *   INSERT: admin
 *   UPDATE: admin
 *   DELETE: admin
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, supervisorClient, nurseAClient, anonClientFactory, expectBlocked, expectAllowed, serviceClient } from '../helpers/clients.js';
import { seedAll, cleanAll, TEST } from '../helpers/seed.js';

let admin, supervisor, nurseA;

beforeAll(async () => {
  await seedAll();
  ({ client: admin }      = await adminClient());
  ({ client: supervisor } = await supervisorClient());
  ({ client: nurseA }     = await nurseAClient());
});

afterAll(cleanAll);

// ── SELECT ───────────────────────────────────────────────
describe('sectores SELECT', () => {

  it('admin puede leer sectores', async () => {
    const res = await admin.from('sectores').select('id, nombre, codigo').limit(10);
    expectAllowed(res, 'admin SELECT sectores');
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('supervisor puede leer sectores', async () => {
    const res = await supervisor.from('sectores').select('id, nombre').limit(10);
    expectAllowed(res);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('nurse puede leer sectores (SELECT=true authenticated)', async () => {
    const res = await nurseA.from('sectores').select('id, nombre').limit(10);
    expectAllowed(res);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('anon NO puede leer sectores', async () => {
    const anon = anonClientFactory();
    const res = await anon.from('sectores').select('id').limit(1);
    expectBlocked(res);
  });

});

// ── INSERT ───────────────────────────────────────────────
describe('sectores INSERT', () => {

  it('admin puede crear un sector', async () => {
    const res = await admin.from('sectores').insert({
      nombre: 'TEST_INSERT_SECTOR',
      codigo: 'TIS',
    }).select('id').single();
    expectAllowed(res, 'admin INSERT sector');
    await serviceClient().from('sectores').delete().eq('id', res.data.id);
  });

  it('supervisor NO puede crear sectores', async () => {
    const res = await supervisor.from('sectores').insert({
      nombre: 'TEST_BLOCKED_SECTOR',
      codigo: 'TBK',
    });
    expectBlocked(res);
  });

  it('nurse NO puede crear sectores', async () => {
    const res = await nurseA.from('sectores').insert({
      nombre: 'TEST_BLOCKED_N_SECTOR',
      codigo: 'TBN',
    });
    expectBlocked(res);
  });

});

// ── UPDATE ───────────────────────────────────────────────
describe('sectores UPDATE', () => {

  it('admin puede actualizar un sector', async () => {
    const res = await admin.from('sectores')
      .update({ nombre: 'TEST_SECTOR_UPD' })
      .eq('id', TEST.sector);
    expectAllowed(res, 'admin UPDATE sector');
    await serviceClient().from('sectores').update({ nombre: 'TEST_SECTOR' }).eq('id', TEST.sector);
  });

  it('supervisor NO puede actualizar sectores', async () => {
    const res = await supervisor.from('sectores')
      .update({ nombre: 'HACKED' })
      .eq('id', TEST.sector);
    expect(res.error).toBeNull();
    const check = await serviceClient().from('sectores').select('nombre').eq('id', TEST.sector).single();
    expect(check.data?.nombre).toBe('TEST_SECTOR');
  });

  it('nurse NO puede actualizar sectores', async () => {
    const res = await nurseA.from('sectores')
      .update({ nombre: 'HACKED' })
      .eq('id', TEST.sector);
    expect(res.error).toBeNull();
    const check = await serviceClient().from('sectores').select('nombre').eq('id', TEST.sector).single();
    expect(check.data?.nombre).toBe('TEST_SECTOR');
  });

});

// ── DELETE ───────────────────────────────────────────────
describe('sectores DELETE', () => {

  it('nurse NO puede eliminar sectores', async () => {
    const res = await nurseA.from('sectores').delete().eq('id', TEST.sector);
    expect(res.error).toBeNull();
    const check = await serviceClient().from('sectores').select('id').eq('id', TEST.sector).single();
    expect(check.data?.id).toBe(TEST.sector);
  });

  it('admin puede eliminar un sector', async () => {
    const { data: tmp } = await serviceClient().from('sectores').insert({
      nombre: 'TEST_DEL_SECTOR', codigo: 'TDL',
    }).select('id').single();

    const res = await admin.from('sectores').delete().eq('id', tmp.id);
    expectAllowed(res, 'admin DELETE sector');

    const check = await serviceClient().from('sectores').select('id').eq('id', tmp.id).maybeSingle();
    expect(check.data).toBeNull();
  });

});
