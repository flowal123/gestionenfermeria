/**
 * rls/funcionarios.test.js
 * Policy: SELECT=true | INSERT=admin | UPDATE=admin/supervisor
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, supervisorClient, nurseAClient, anonClientFactory, expectBlocked, expectAllowed, serviceClient } from '../helpers/clients.js';
import { seedAll, cleanAll } from '../helpers/seed.js';

let admin, supervisor, nurseA;

beforeAll(async () => {
  await seedAll();
  ({ client: admin }      = await adminClient());
  ({ client: supervisor } = await supervisorClient());
  ({ client: nurseA }     = await nurseAClient());
});

afterAll(cleanAll);

describe('funcionarios SELECT', () => {

  it('admin puede leer todos los funcionarios', async () => {
    const res = await admin.from('funcionarios').select('id, apellido').limit(5);
    expectAllowed(res);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('supervisor puede leer todos los funcionarios', async () => {
    const res = await supervisor.from('funcionarios').select('id').limit(5);
    expectAllowed(res);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('nurse puede leer funcionarios (SELECT=true)', async () => {
    const res = await nurseA.from('funcionarios').select('id, apellido').limit(5);
    expectAllowed(res);
    expect(res.data.length).toBeGreaterThan(0);
  });

  it('anon NO puede leer funcionarios', async () => {
    const anon = anonClientFactory();
    const res = await anon.from('funcionarios').select('id').limit(1);
    expectBlocked(res);
  });

});

describe('funcionarios INSERT', () => {

  it('admin puede crear un funcionario', async () => {
    const res = await admin.from('funcionarios').insert({
      apellido: 'TEST_INSERT', nombre: 'Borrar',
      tipo: 'fijo', activo: true, horas_semana: 36, horas_dia: 6, turno_fijo: 'M',
    }).select('id').single();
    expectAllowed(res, 'admin INSERT funcionario');
    await serviceClient().from('funcionarios').delete().eq('id', res.data.id);
  });

  it('supervisor NO puede crear funcionarios', async () => {
    const res = await supervisor.from('funcionarios').insert({
      apellido: 'TEST_BLOCKED', nombre: 'Borrar',
      tipo: 'fijo', activo: true, horas_semana: 36, horas_dia: 6, turno_fijo: 'M',
    });
    expectBlocked(res);
  });

  it('nurse NO puede crear funcionarios', async () => {
    const res = await nurseA.from('funcionarios').insert({
      apellido: 'TEST_BLOCKED', nombre: 'Borrar',
      tipo: 'fijo', activo: true, horas_semana: 36, horas_dia: 6, turno_fijo: 'M',
    });
    expectBlocked(res);
  });

});

describe('funcionarios UPDATE', () => {

  it('admin puede actualizar un funcionario', async () => {
    const { data: f } = await serviceClient().from('funcionarios')
      .insert({ apellido: 'TEST_UPD', nombre: 'X', tipo: 'fijo', activo: true, horas_semana: 36, horas_dia: 6, turno_fijo: 'M' })
      .select('id').single();

    const res = await admin.from('funcionarios')
      .update({ nombre: 'Actualizado' }).eq('id', f.id);
    expectAllowed(res, 'admin UPDATE funcionario');
    await serviceClient().from('funcionarios').delete().eq('id', f.id);
  });

  it('supervisor puede actualizar un funcionario', async () => {
    const { data: f } = await serviceClient().from('funcionarios')
      .insert({ apellido: 'TEST_UPD_SUP', nombre: 'X', tipo: 'fijo', activo: true, horas_semana: 36, horas_dia: 6, turno_fijo: 'M' })
      .select('id').single();

    const res = await supervisor.from('funcionarios')
      .update({ nombre: 'Actualizado por sup' }).eq('id', f.id);
    expectAllowed(res, 'supervisor UPDATE funcionario');
    await serviceClient().from('funcionarios').delete().eq('id', f.id);
  });

  it('nurse NO puede actualizar funcionarios', async () => {
    const { data: f } = await serviceClient().from('funcionarios')
      .insert({ apellido: 'TEST_NO_UPD', nombre: 'X', tipo: 'fijo', activo: true, horas_semana: 36, horas_dia: 6, turno_fijo: 'M' })
      .select('id').single();

    const res = await nurseA.from('funcionarios')
      .update({ nombre: 'Hackeado' }).eq('id', f.id);
    expect(res.error).toBeNull(); // RLS filtra → 0 rows, no error
    const check = await serviceClient().from('funcionarios').select('nombre').eq('id', f.id).single();
    expect(check.data?.nombre).toBe('X'); // no cambió
    await serviceClient().from('funcionarios').delete().eq('id', f.id);
  });

});
