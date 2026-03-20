/**
 * rls/licencias.test.js
 * Policy:
 *   SELECT: admin/supervisor ó propio funcionario_id ó suplente_id
 *   INSERT: admin/supervisor
 *   UPDATE: admin/supervisor
 *   DELETE: admin/supervisor (si existe; si no, solo via service_role)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, supervisorClient, nurseAClient, nurseBClient, expectBlocked, expectAllowed, serviceClient } from '../helpers/clients.js';
import { seedAll, cleanAll, TEST } from '../helpers/seed.js';

let admin, supervisor, nurseA, nurseB;

beforeAll(async () => {
  await seedAll();
  ({ client: admin }      = await adminClient());
  ({ client: supervisor } = await supervisorClient());
  ({ client: nurseA }     = await nurseAClient());
  ({ client: nurseB }     = await nurseBClient());
});

afterAll(cleanAll);

// ── SELECT ───────────────────────────────────────────────
describe('licencias SELECT', () => {

  it('admin ve todas las licencias', async () => {
    const res = await admin.from('licencias').select('id, tipo, estado').limit(20);
    expectAllowed(res, 'admin SELECT licencias');
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('supervisor ve todas las licencias', async () => {
    const res = await supervisor.from('licencias').select('id, tipo').limit(20);
    expectAllowed(res);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('nurse A ve su propia licencia', async () => {
    const res = await nurseA.from('licencias')
      .select('id, tipo')
      .eq('id', TEST.licencia);
    expectAllowed(res);
    expect(res.data.length).toBe(1);
  });

  it('nurse B NO ve la licencia de nurse A', async () => {
    const res = await nurseB.from('licencias')
      .select('id')
      .eq('id', TEST.licencia);
    expectAllowed(res); // no es error, RLS filtra
    expect(res.data.length).toBe(0);
  });

  it('nurse A ve su licencia cuando es suplente asignado', async () => {
    // Crear licencia con suplente_id = funcNurseA
    const svc = serviceClient();
    const { data: lic } = await svc.from('licencias').insert({
      funcionario_id: TEST.funcNurseB,
      tipo: 'LAR',
      fecha_desde: '2099-07-01',
      fecha_hasta: '2099-07-05',
      genera_vacante: false,
      estado: 'activa',
      suplente_id: TEST.funcNurseA,
    }).select('id').single();

    const res = await nurseA.from('licencias').select('id').eq('id', lic.id);
    expectAllowed(res);
    expect(res.data.length).toBe(1);

    await svc.from('licencias').delete().eq('id', lic.id);
  });

});

// ── INSERT ───────────────────────────────────────────────
describe('licencias INSERT', () => {

  it('admin puede insertar una licencia', async () => {
    const res = await admin.from('licencias').insert({
      funcionario_id: TEST.funcNurseA,
      tipo: 'LAR',
      fecha_desde: '2099-08-01',
      fecha_hasta: '2099-08-03',
      genera_vacante: false,
      estado: 'activa',
    }).select('id').single();
    expectAllowed(res, 'admin INSERT licencia');
    await serviceClient().from('licencias').delete().eq('id', res.data.id);
  });

  it('supervisor puede insertar una licencia', async () => {
    const res = await supervisor.from('licencias').insert({
      funcionario_id: TEST.funcNurseA,
      tipo: 'LAR',
      fecha_desde: '2099-09-01',
      fecha_hasta: '2099-09-03',
      genera_vacante: false,
      estado: 'activa',
    }).select('id').single();
    expectAllowed(res, 'supervisor INSERT licencia');
    await serviceClient().from('licencias').delete().eq('id', res.data.id);
  });

  it('nurse NO puede insertar licencias', async () => {
    const res = await nurseA.from('licencias').insert({
      funcionario_id: TEST.funcNurseA,
      tipo: 'LAR',
      fecha_desde: '2099-10-01',
      fecha_hasta: '2099-10-03',
      genera_vacante: false,
      estado: 'activa',
    });
    expectBlocked(res);
  });

});

// ── UPDATE ───────────────────────────────────────────────
describe('licencias UPDATE', () => {

  it('admin puede actualizar una licencia', async () => {
    const res = await admin.from('licencias')
      .update({ estado: 'cancelada' })
      .eq('id', TEST.licencia);
    expectAllowed(res, 'admin UPDATE licencia');
    await serviceClient().from('licencias').update({ estado: 'activa' }).eq('id', TEST.licencia);
  });

  it('supervisor puede actualizar una licencia', async () => {
    const res = await supervisor.from('licencias')
      .update({ genera_vacante: true })
      .eq('id', TEST.licencia);
    expectAllowed(res, 'supervisor UPDATE licencia');
    await serviceClient().from('licencias').update({ genera_vacante: false }).eq('id', TEST.licencia);
  });

  it('nurse NO puede actualizar licencias', async () => {
    const res = await nurseA.from('licencias')
      .update({ estado: 'cancelada' })
      .eq('id', TEST.licencia);
    // USING falla → 0 rows, no es error
    expect(res.error).toBeNull();
    const check = await serviceClient().from('licencias').select('estado').eq('id', TEST.licencia).single();
    expect(check.data?.estado).toBe('activa');
  });

});
