/**
 * seed.js — Creación y limpieza de datos de prueba con service_role
 *
 * Todos los registros se crean con prefijo TEST_ o tags específicos
 * para poder limpiarlos sin afectar datos de producción.
 */
import { serviceClient } from './clients.js';

const svc = serviceClient();

// IDs en memoria durante la sesión de tests
export const TEST = {
  funcNurseA:       null,  // funcionario vinculado a nurse A (ya existe)
  funcNurseB:       null,  // creado por seed
  funcAdmin:        null,  // funcionario vinculado a admin
  funcSupervisor:   null,
  _tempFuncNurseA:  null,  // funcionario temporal creado si nurseA no tiene uno
  licencia:         null,
  cambio:           null,
  alerta:           null,
  turno:            null,
  generacion:       null,
  sector:           null,
  nurseAuthId:      null,  // auth.uid de nurse B
};

// -------------------------------------------------------
// SEED PRINCIPAL
// -------------------------------------------------------
export async function seedAll() {
  await seedUsuarios();   // asegura registros en usuarios para que auth_rol() funcione
  await seedNurseB();
  await seedFuncionarios();
  await seedSector();
  await seedTurno();
  await seedLicencia();
  await seedCambio();
  await seedAlerta();
  await seedGeneracion();
}

// -------------------------------------------------------
// Asegurar registros en `usuarios` para los 3 usuarios pre-existentes
// Esto es necesario para que auth_rol() devuelva el rol correcto en RLS
// -------------------------------------------------------
export async function seedUsuarios() {
  const records = [
    { email: process.env.TEST_ADMIN_EMAIL,      rol: 'admin',      activo: true },
    { email: process.env.TEST_SUPERVISOR_EMAIL, rol: 'supervisor',  activo: true },
    { email: process.env.TEST_NURSE_A_EMAIL,    rol: 'nurse',      activo: true },
  ];
  for (const rec of records) {
    if (!rec.email) continue;
    const { error } = await svc.from('usuarios').upsert(rec, { onConflict: 'email' });
    if (error) throw new Error(`seedUsuarios (${rec.email}): ${error.message}`);
  }
}

// -------------------------------------------------------
// AUTH: nurse B es creada por globalSetup — aquí solo gestionamos las tablas
// -------------------------------------------------------

/** Busca un usuario por email paginando (evita el error con perPage grandes) */
async function findAuthUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 50 });
    if (error || !data?.users?.length) break;
    const found = data.users.find(u => u.email === email);
    if (found) return found;
    if (data.users.length < 50) break;
    page++;
    if (page > 40) break;
  }
  return null;
}

export async function seedNurseB() {
  const email = process.env.TEST_NURSE_B_EMAIL;

  // Resolver el auth.uid de nurse B (necesario para cleanAll)
  const found = await findAuthUserByEmail(email);
  if (found) TEST.nurseAuthId = found.id;

  // Asegurar funcionario para nurse B
  const { data: funcB, error: fErr } = await svc.from('funcionarios').insert({
    apellido: 'TEST_NURSEB',
    nombre: 'Test',
    tipo: 'fijo',
    activo: true,
    horas_semana: 36,
    horas_dia: 6,
    turno_fijo: 'M',
  }).select('id').single();
  if (fErr) throw new Error(`seedNurseB funcionario: ${fErr.message}`);
  TEST.funcNurseB = funcB.id;

  // Crear/actualizar registro en usuarios
  const { error: uErr } = await svc.from('usuarios').upsert({
    email, rol: 'nurse', activo: true, funcionario_id: TEST.funcNurseB,
  }, { onConflict: 'email' });
  if (uErr) throw new Error(`seedNurseB usuarios: ${uErr.message}`);
}

// -------------------------------------------------------
// Obtener IDs de funcionarios vinculados a los usuarios de prueba.
// Si nurseA no tiene funcionario_id, se crea uno temporal para la sesión de tests.
// -------------------------------------------------------
export async function seedFuncionarios() {
  const emails = [
    process.env.TEST_ADMIN_EMAIL,
    process.env.TEST_SUPERVISOR_EMAIL,
    process.env.TEST_NURSE_A_EMAIL,
  ];
  const { data, error } = await svc.from('usuarios')
    .select('email, funcionario_id')
    .in('email', emails);
  if (error) throw new Error(`seedFuncionarios: ${error.message}`);

  for (const u of data || []) {
    if (u.email === process.env.TEST_ADMIN_EMAIL)      TEST.funcAdmin = u.funcionario_id;
    if (u.email === process.env.TEST_SUPERVISOR_EMAIL) TEST.funcSupervisor = u.funcionario_id;
    if (u.email === process.env.TEST_NURSE_A_EMAIL)    TEST.funcNurseA = u.funcionario_id;
  }

  // Si nurseA no tiene funcionario_id, crear uno temporal y vincularlo
  if (!TEST.funcNurseA) {
    const { data: fA, error: fErr } = await svc.from('funcionarios').insert({
      apellido: 'TEST_NURSEA',
      nombre: 'Test',
      tipo: 'fijo',
      activo: true,
      horas_semana: 36,
      horas_dia: 6,
      turno_fijo: 'M',
    }).select('id').single();
    if (fErr) throw new Error(`seedFuncionarios tempNurseA: ${fErr.message}`);
    TEST.funcNurseA = fA.id;
    TEST._tempFuncNurseA = fA.id;

    // Vincular en usuarios
    const { error: uErr } = await svc.from('usuarios')
      .update({ funcionario_id: fA.id })
      .eq('email', process.env.TEST_NURSE_A_EMAIL);
    if (uErr) throw new Error(`seedFuncionarios update nurseA: ${uErr.message}`);
  }
}

// -------------------------------------------------------
// Sector de prueba
// -------------------------------------------------------
export async function seedSector() {
  const { data, error } = await svc.from('sectores')
    .insert({ nombre: 'TEST_SECTOR', codigo: 'TST' })
    .select('id').single();
  if (error) throw new Error(`seedSector: ${error.message}`);
  TEST.sector = data.id;
}

// -------------------------------------------------------
// Turno de prueba (para nurse A)
// -------------------------------------------------------
export async function seedTurno() {
  if (!TEST.funcNurseA) return;
  const { data, error } = await svc.from('turnos')
    .upsert({ funcionario_id: TEST.funcNurseA, fecha: '2099-01-15', codigo: 'M', sector_id: null },
             { onConflict: 'funcionario_id,fecha' })
    .select('funcionario_id, fecha').single();
  if (error) throw new Error(`seedTurno: ${error.message}`);
  TEST.turno = { funcionario_id: TEST.funcNurseA, fecha: '2099-01-15' };
}

// -------------------------------------------------------
// Licencia de prueba (para nurse A)
// -------------------------------------------------------
export async function seedLicencia() {
  if (!TEST.funcNurseA) return;
  const { data, error } = await svc.from('licencias').insert({
    funcionario_id: TEST.funcNurseA,
    tipo: 'LAR',
    fecha_desde: '2099-02-01',
    fecha_hasta: '2099-02-05',
    genera_vacante: false,
    estado: 'activa',
  }).select('id').single();
  if (error) throw new Error(`seedLicencia: ${error.message}`);
  TEST.licencia = data.id;
}

// -------------------------------------------------------
// Cambio de prueba (nurse A solicita a nurse B)
// -------------------------------------------------------
export async function seedCambio() {
  if (!TEST.funcNurseA || !TEST.funcNurseB) return;
  const { data, error } = await svc.from('cambios').insert({
    solicitante_id: TEST.funcNurseA,
    receptor_id:    TEST.funcNurseB,
    turno_cede: 'M',
    fecha_cede: '2099-03-10',
    turno_recibe: 'T',
    fecha_recibe: '2099-03-11',
    estado: 'pendiente',
  }).select('id').single();
  if (error) throw new Error(`seedCambio: ${error.message}`);
  TEST.cambio = data.id;
}

// -------------------------------------------------------
// Alerta de prueba (para nurse A)
// -------------------------------------------------------
export async function seedAlerta() {
  const { data, error } = await svc.from('alertas').insert({
    tipo: 'ok',
    titulo: 'TEST_ALERTA',
    descripcion: 'Alerta de prueba',
    funcionario_id: TEST.funcNurseA ? String(TEST.funcNurseA) : null,
    leida: false,
  }).select('id').single();
  if (error) throw new Error(`seedAlerta: ${error.message}`);
  TEST.alerta = data.id;
}

// -------------------------------------------------------
// Generación de prueba
// -------------------------------------------------------
export async function seedGeneracion() {
  const { data, error } = await svc.from('generaciones').insert({
    mes: 'TEST_GEN 2099',
    mes_num: 1,
    anio: 2099,
    estado: 'borrador',
    func_count: 0,
    alertas_7: 0,
  }).select('id').single();
  if (error) throw new Error(`seedGeneracion: ${error.message}`);
  TEST.generacion = data.id;
}

// -------------------------------------------------------
// CLEANUP — eliminar todo lo creado por el seed
// -------------------------------------------------------
export async function cleanAll() {
  const errors = [];

  const del = async (table, filter) => {
    const [col, val] = filter;
    if (!val) return;
    const { error } = await svc.from(table).delete().eq(col, val);
    if (error) errors.push(`cleanup ${table}: ${error.message}`);
  };

  await del('generaciones', ['id', TEST.generacion]);
  await del('alertas',      ['id', TEST.alerta]);
  // Eliminar TODOS los cambios que involucren a funcNurseA o funcNurseB
  // (los tests de cambios pueden insertar cambios adicionales sin cleanup propio)
  if (TEST.funcNurseA) {
    await svc.from('cambios').delete().eq('solicitante_id', TEST.funcNurseA);
    await svc.from('cambios').delete().eq('receptor_id', TEST.funcNurseA);
  }
  if (TEST.funcNurseB) {
    await svc.from('cambios').delete().eq('solicitante_id', TEST.funcNurseB);
    await svc.from('cambios').delete().eq('receptor_id', TEST.funcNurseB);
  }
  // Eliminar TODAS las licencias que involucren a funcNurseA o funcNurseB
  // (los tests de licencias pueden insertar licencias adicionales sin cleanup propio)
  if (TEST.funcNurseA) {
    await svc.from('licencias').delete().eq('funcionario_id', TEST.funcNurseA);
    await svc.from('licencias').delete().eq('suplente_id', TEST.funcNurseA);
  }
  if (TEST.funcNurseB) {
    await svc.from('licencias').delete().eq('funcionario_id', TEST.funcNurseB);
    await svc.from('licencias').delete().eq('suplente_id', TEST.funcNurseB);
  }

  if (TEST.turno) {
    await svc.from('turnos').delete()
      .eq('funcionario_id', TEST.funcNurseA).eq('fecha', '2099-01-15');
  }

  await del('sectores',    ['id', TEST.sector]);

  // Si se creó un funcionario temporal para nurseA, desvincular antes de borrar
  if (TEST._tempFuncNurseA) {
    await svc.from('usuarios')
      .update({ funcionario_id: null })
      .eq('email', process.env.TEST_NURSE_A_EMAIL);
    await del('funcionarios', ['id', TEST._tempFuncNurseA]);
  }

  // Limpiar usuario nurse B ANTES del funcionario (FK: usuarios.funcionario_id → funcionarios.id)
  const email = process.env.TEST_NURSE_B_EMAIL;
  await svc.from('usuarios').delete().eq('email', email);
  await del('funcionarios', ['id', TEST.funcNurseB]);

  // Eliminar auth user nurse B
  if (TEST.nurseAuthId) {
    await svc.auth.admin.deleteUser(TEST.nurseAuthId);
  }

  if (errors.length) console.warn('Cleanup warnings:', errors);
}
