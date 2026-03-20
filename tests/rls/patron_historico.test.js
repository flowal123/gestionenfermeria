/**
 * rls/patron_historico.test.js
 * Policy:
 *   SELECT: admin/supervisor ó propio funcionario_id
 *   INSERT/UPDATE/DELETE: admin/supervisor
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, supervisorClient, nurseAClient, nurseBClient, expectBlocked, expectAllowed, serviceClient } from '../helpers/clients.js';
import { seedAll, cleanAll, TEST } from '../helpers/seed.js';

let admin, supervisor, nurseA, nurseB;
let testPatronId = null;

beforeAll(async () => {
  await seedAll();
  ({ client: admin }      = await adminClient());
  ({ client: supervisor } = await supervisorClient());
  ({ client: nurseA }     = await nurseAClient());
  ({ client: nurseB }     = await nurseBClient());

  // Insertar registro de prueba via service_role (si nurse A tiene funcId)
  if (TEST.funcNurseA) {
    const { data } = await serviceClient().from('patron_historico').insert({
      funcionario_id: TEST.funcNurseA,
      patron: [],
      vigente_desde: '2099-01-01',
      vigente_hasta: '2099-05-31',
      turno_fijo: 'M',
    }).select('id').single();
    testPatronId = data?.id ?? null;
  }
});

afterAll(async () => {
  if (testPatronId) {
    await serviceClient().from('patron_historico').delete().eq('id', testPatronId);
  }
  await cleanAll();
});

// ── SELECT ───────────────────────────────────────────────
describe('patron_historico SELECT', () => {

  it('admin ve todos los registros de patron_historico', async () => {
    const res = await admin.from('patron_historico').select('id').limit(20);
    expectAllowed(res, 'admin SELECT patron_historico');
  });

  it('supervisor ve todos los registros de patron_historico', async () => {
    const res = await supervisor.from('patron_historico').select('id').limit(20);
    expectAllowed(res);
  });

  it('nurse A ve su propio patron_historico', async () => {
    if (!testPatronId) return;
    const res = await nurseA.from('patron_historico')
      .select('id, turno_fijo')
      .eq('id', testPatronId);
    expectAllowed(res);
    expect(res.data.length).toBe(1);
  });

  it('nurse B NO ve el patron_historico de nurse A', async () => {
    if (!testPatronId) return;
    const res = await nurseB.from('patron_historico')
      .select('id')
      .eq('id', testPatronId);
    expectAllowed(res); // no error, RLS filtra
    expect(res.data.length).toBe(0);
  });

});

// ── INSERT ───────────────────────────────────────────────
describe('patron_historico INSERT', () => {

  it('admin puede insertar en patron_historico', async () => {
    if (!TEST.funcNurseA) return;
    const res = await admin.from('patron_historico').insert({
      funcionario_id: TEST.funcNurseA,
      patron: [],
      vigente_desde: '2099-06-01',
      vigente_hasta: '2099-06-30',
      turno_fijo: 'N',
    }).select('id').single();
    expectAllowed(res, 'admin INSERT patron_historico');
    await serviceClient().from('patron_historico').delete().eq('id', res.data.id);
  });

  it('supervisor puede insertar en patron_historico', async () => {
    if (!TEST.funcNurseA) return;
    const res = await supervisor.from('patron_historico').insert({
      funcionario_id: TEST.funcNurseA,
      patron: [],
      vigente_desde: '2099-07-01',
      vigente_hasta: '2099-07-31',
      turno_fijo: 'T',
    }).select('id').single();
    expectAllowed(res, 'supervisor INSERT patron_historico');
    await serviceClient().from('patron_historico').delete().eq('id', res.data.id);
  });

  it('nurse NO puede insertar en patron_historico', async () => {
    if (!TEST.funcNurseA) return;
    const res = await nurseA.from('patron_historico').insert({
      funcionario_id: TEST.funcNurseA,
      patron: [],
      vigente_desde: '2099-08-01',
      vigente_hasta: '2099-08-31',
      turno_fijo: 'M',
    });
    expectBlocked(res);
  });

});

// ── UPDATE ───────────────────────────────────────────────
describe('patron_historico UPDATE', () => {

  it('admin puede actualizar patron_historico', async () => {
    if (!testPatronId) return;
    const res = await admin.from('patron_historico')
      .update({ turno_fijo: 'T' })
      .eq('id', testPatronId);
    expectAllowed(res, 'admin UPDATE patron_historico');
    await serviceClient().from('patron_historico').update({ turno_fijo: 'M' }).eq('id', testPatronId);
  });

  it('nurse NO puede actualizar patron_historico', async () => {
    if (!testPatronId) return;
    const res = await nurseA.from('patron_historico')
      .update({ turno_fijo: 'N' })
      .eq('id', testPatronId);
    expect(res.error).toBeNull();
    const check = await serviceClient().from('patron_historico').select('turno_fijo').eq('id', testPatronId).single();
    expect(check.data?.turno_fijo).toBe('M');
  });

});
