/**
 * rls/generaciones.test.js
 * Policy:
 *   SELECT: admin/supervisor
 *   INSERT: admin
 *   UPDATE: admin
 *   DELETE: admin
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, supervisorClient, nurseAClient, expectBlocked, expectAllowed, serviceClient } from '../helpers/clients.js';
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
describe('generaciones SELECT', () => {

  it('admin ve todas las generaciones', async () => {
    const res = await admin.from('generaciones').select('id, mes, estado').limit(10);
    expectAllowed(res, 'admin SELECT generaciones');
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('supervisor ve todas las generaciones', async () => {
    const res = await supervisor.from('generaciones').select('id, mes, estado').limit(10);
    expectAllowed(res);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('nurse NO ve generaciones', async () => {
    const res = await nurseA.from('generaciones').select('id').limit(10);
    // RLS bloquea → error 42501 o array vacío dependiendo de cómo esté definida la policy
    // Si hay USING(false) → error; si hay no policy → blocked
    expectBlocked(res);
  });

});

// ── INSERT ───────────────────────────────────────────────
describe('generaciones INSERT', () => {

  it('admin puede insertar una generación', async () => {
    const res = await admin.from('generaciones').insert({
      mes: 'TEST_INS 2099',
      mes_num: 2,
      anio: 2099,
      estado: 'borrador',
      func_count: 0,
      alertas_7: 0,
    }).select('id').single();
    expectAllowed(res, 'admin INSERT generacion');
    await serviceClient().from('generaciones').delete().eq('id', res.data.id);
  });

  it('supervisor NO puede insertar generaciones', async () => {
    const res = await supervisor.from('generaciones').insert({
      mes: 'TEST_BLOCKED 2099',
      mes_num: 3,
      anio: 2099,
      estado: 'borrador',
      func_count: 0,
      alertas_7: 0,
    });
    expectBlocked(res);
  });

  it('nurse NO puede insertar generaciones', async () => {
    const res = await nurseA.from('generaciones').insert({
      mes: 'TEST_BLOCKED_N 2099',
      mes_num: 4,
      anio: 2099,
      estado: 'borrador',
      func_count: 0,
      alertas_7: 0,
    });
    expectBlocked(res);
  });

});

// ── UPDATE ───────────────────────────────────────────────
describe('generaciones UPDATE', () => {

  it('admin puede aprobar una generación', async () => {
    const res = await admin.from('generaciones')
      .update({ estado: 'aprobada' })
      .eq('id', TEST.generacion);
    expectAllowed(res, 'admin UPDATE generacion');
    // Restaurar
    await serviceClient().from('generaciones').update({ estado: 'borrador' }).eq('id', TEST.generacion);
  });

  it('supervisor NO puede actualizar generaciones', async () => {
    const res = await supervisor.from('generaciones')
      .update({ estado: 'aprobada' })
      .eq('id', TEST.generacion);
    // 0 rows updated (USING falla) — no es error, pero no cambia
    expect(res.error).toBeNull();
    const check = await serviceClient().from('generaciones').select('estado').eq('id', TEST.generacion).single();
    expect(check.data?.estado).toBe('borrador');
  });

  it('nurse NO puede actualizar generaciones', async () => {
    const res = await nurseA.from('generaciones')
      .update({ estado: 'aprobada' })
      .eq('id', TEST.generacion);
    expect(res.error).toBeNull();
    const check = await serviceClient().from('generaciones').select('estado').eq('id', TEST.generacion).single();
    expect(check.data?.estado).toBe('borrador');
  });

});

// ── DELETE ───────────────────────────────────────────────
describe('generaciones DELETE', () => {

  it('nurse NO puede eliminar generaciones', async () => {
    const res = await nurseA.from('generaciones').delete().eq('id', TEST.generacion);
    // USING falla → 0 rows, no error
    expect(res.error).toBeNull();
    const check = await serviceClient().from('generaciones').select('id').eq('id', TEST.generacion).single();
    expect(check.data?.id).toBe(TEST.generacion); // sigue existiendo
  });

  it('supervisor NO puede eliminar generaciones', async () => {
    const res = await supervisor.from('generaciones').delete().eq('id', TEST.generacion);
    expect(res.error).toBeNull();
    const check = await serviceClient().from('generaciones').select('id').eq('id', TEST.generacion).single();
    expect(check.data?.id).toBe(TEST.generacion);
  });

  it('admin puede eliminar una generación', async () => {
    // Crear una generación temporal
    const { data: tmp } = await serviceClient().from('generaciones').insert({
      mes: 'TEST_DEL 2099', mes_num: 5, anio: 2099,
      estado: 'borrador', func_count: 0, alertas_7: 0,
    }).select('id').single();

    const res = await admin.from('generaciones').delete().eq('id', tmp.id);
    expectAllowed(res, 'admin DELETE generacion');

    const check = await serviceClient().from('generaciones').select('id').eq('id', tmp.id).maybeSingle();
    expect(check.data).toBeNull();
  });

});
