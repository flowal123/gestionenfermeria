/**
 * rls/turnos.test.js
 * Policy:
 *   SELECT: authenticated (SELECT=true)
 *   INSERT: admin/supervisor
 *   UPDATE: admin/supervisor
 *   DELETE: admin/supervisor
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
describe('turnos SELECT', () => {

  it('admin puede leer turnos', async () => {
    const res = await admin.from('turnos').select('funcionario_id, fecha, codigo').limit(10);
    expectAllowed(res, 'admin SELECT turnos');
  });

  it('supervisor puede leer turnos', async () => {
    const res = await supervisor.from('turnos').select('funcionario_id, fecha').limit(10);
    expectAllowed(res);
  });

  it('nurse puede leer turnos (SELECT=true authenticated)', async () => {
    const res = await nurseA.from('turnos')
      .select('funcionario_id, fecha, codigo')
      .eq('funcionario_id', TEST.turno?.funcionario_id ?? 0)
      .eq('fecha', '2099-01-15');
    expectAllowed(res);
    if (TEST.turno) expect(res.data.length).toBeGreaterThan(0);
  });

  it('anon NO puede leer turnos', async () => {
    const anon = anonClientFactory();
    const res = await anon.from('turnos').select('funcionario_id').limit(1);
    expectBlocked(res);
  });

});

// ── INSERT ───────────────────────────────────────────────
describe('turnos INSERT', () => {

  it('admin puede insertar un turno', async () => {
    if (!TEST.funcNurseA) return;
    const res = await admin.from('turnos').upsert({
      funcionario_id: TEST.funcNurseA,
      fecha: '2099-06-20',
      codigo: 'N',
    }, { onConflict: 'funcionario_id,fecha' }).select('funcionario_id, fecha');
    expectAllowed(res, 'admin INSERT turno');
    await serviceClient().from('turnos')
      .delete().eq('funcionario_id', TEST.funcNurseA).eq('fecha', '2099-06-20');
  });

  it('supervisor puede insertar un turno', async () => {
    if (!TEST.funcNurseA) return;
    const res = await supervisor.from('turnos').upsert({
      funcionario_id: TEST.funcNurseA,
      fecha: '2099-06-21',
      codigo: 'T',
    }, { onConflict: 'funcionario_id,fecha' }).select('funcionario_id, fecha');
    expectAllowed(res, 'supervisor INSERT turno');
    await serviceClient().from('turnos')
      .delete().eq('funcionario_id', TEST.funcNurseA).eq('fecha', '2099-06-21');
  });

  it('nurse NO puede insertar turnos', async () => {
    if (!TEST.funcNurseA) return;
    const res = await nurseA.from('turnos').insert({
      funcionario_id: TEST.funcNurseA,
      fecha: '2099-06-22',
      codigo: 'M',
    });
    expectBlocked(res);
  });

});

// ── UPDATE ───────────────────────────────────────────────
describe('turnos UPDATE', () => {

  it('admin puede actualizar un turno', async () => {
    if (!TEST.turno) return;
    const res = await admin.from('turnos')
      .update({ codigo: 'T' })
      .eq('funcionario_id', TEST.turno.funcionario_id)
      .eq('fecha', '2099-01-15');
    expectAllowed(res, 'admin UPDATE turno');
    await serviceClient().from('turnos').update({ codigo: 'M' })
      .eq('funcionario_id', TEST.turno.funcionario_id).eq('fecha', '2099-01-15');
  });

  it('supervisor puede actualizar un turno', async () => {
    if (!TEST.turno) return;
    const res = await supervisor.from('turnos')
      .update({ codigo: 'N' })
      .eq('funcionario_id', TEST.turno.funcionario_id)
      .eq('fecha', '2099-01-15');
    expectAllowed(res, 'supervisor UPDATE turno');
    await serviceClient().from('turnos').update({ codigo: 'M' })
      .eq('funcionario_id', TEST.turno.funcionario_id).eq('fecha', '2099-01-15');
  });

  it('nurse NO puede actualizar turnos', async () => {
    if (!TEST.turno) return;
    const res = await nurseA.from('turnos')
      .update({ codigo: 'N' })
      .eq('funcionario_id', TEST.turno.funcionario_id)
      .eq('fecha', '2099-01-15');
    expect(res.error).toBeNull();
    const check = await serviceClient().from('turnos').select('codigo')
      .eq('funcionario_id', TEST.turno.funcionario_id).eq('fecha', '2099-01-15').single();
    expect(check.data?.codigo).toBe('M');
  });

});

// ── DELETE ───────────────────────────────────────────────
describe('turnos DELETE', () => {

  it('nurse NO puede eliminar turnos', async () => {
    if (!TEST.turno) return;
    const res = await nurseA.from('turnos').delete()
      .eq('funcionario_id', TEST.turno.funcionario_id).eq('fecha', '2099-01-15');
    expect(res.error).toBeNull();
    const check = await serviceClient().from('turnos').select('codigo')
      .eq('funcionario_id', TEST.turno.funcionario_id).eq('fecha', '2099-01-15').maybeSingle();
    expect(check.data).not.toBeNull(); // sigue existiendo
  });

  it('admin puede eliminar un turno', async () => {
    if (!TEST.funcNurseA) return;
    await serviceClient().from('turnos').upsert({
      funcionario_id: TEST.funcNurseA,
      fecha: '2099-06-30',
      codigo: 'M',
    }, { onConflict: 'funcionario_id,fecha' });

    const res = await admin.from('turnos').delete()
      .eq('funcionario_id', TEST.funcNurseA).eq('fecha', '2099-06-30');
    expectAllowed(res, 'admin DELETE turno');

    const check = await serviceClient().from('turnos').select('codigo')
      .eq('funcionario_id', TEST.funcNurseA).eq('fecha', '2099-06-30').maybeSingle();
    expect(check.data).toBeNull();
  });

});
