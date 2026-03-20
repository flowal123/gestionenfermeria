// SUPABASE CONFIG + DB
// ........................................................
const SB_URL = 'https://mrrjipzarpqksogrnalz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ycmppcHphcnBxa3NvZ3JuYWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMTgzOTQsImV4cCI6MjA4Nzg5NDM5NH0.GVXFwnzL8NMcMQt54k_JJN6o8uncLRrHY7pmZ3l8huI';
// sb declared at top of script
function initSB(){
  if(typeof supabase === 'undefined'){ console.warn('Supabase SDK no cargó'); return; }
  sb = supabase.createClient(SB_URL, SB_KEY);
  console.log('Supabase conectado ✓');
}

// "—? Carga todos los datos desde Supabase "—————————————————?
async function _loadTurnosPaginado(dateFrom, dateTo){
  const PAGE = 1000;
  let all = [], from = 0;
  while(true){
    const {data, error} = await sb.from('turnos')
      .select('funcionario_id, fecha, codigo, sector_id')
      .gte('fecha', dateFrom).lte('fecha', dateTo)
      .order('fecha').range(from, from + PAGE - 1);
    if(error){ console.error('Error paginando turnos', error); break; }
    if(!data?.length) break;
    all = all.concat(data);
    if(data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function loadDB(){
  if(!sb){ console.warn('Supabase no iniciado'); return; }
  showDBLoading(true);
  try {
    const yearFrom = `${new Date().getFullYear()}-01-01`;
    const yearTo   = `${new Date().getFullYear()+1}-12-31`;
    const [fRes, lRes, cRes, aRes, uRes, phRes, secRes, genRes, codRes, turnosData] = await Promise.all([
      sb.from('funcionarios').select('*, clinica:clinicas(nombre,codigo), sector:sectores(nombre,codigo)').order('apellido'),
      sb.from('licencias').select('id, funcionario_id, suplente_id, tipo, fecha_desde, fecha_hasta, dias, genera_vacante, estado, observaciones, funcionario:funcionario_id(id,apellido,nombre,telefono,fecha_nacimiento,sector:sector_id(nombre)), suplente:suplente_id(apellido,nombre)').in('estado',["activa","pendiente"]),
      sb.from('cambios').select('id, solicitante_id, receptor_id, turno_cede, fecha_cede, turno_recibe, fecha_recibe, estado, created_at, solicitante:solicitante_id(apellido,nombre), receptor:receptor_id(apellido,nombre)').order('created_at',{ascending:false}),
      sb.from('alertas').select('*').eq('leida',false).order('created_at',{ascending:false}).limit(100),
      sb.from('usuarios').select('id, email, rol, activo, must_change_password, auth_user_id, funcionario_id, funcionario:funcionario_id(id,apellido,nombre,email,sector:sector_id(nombre),clinica:clinica_id(nombre))'),
      sb.from('patron_historico').select('funcionario_id,patron,ciclo_ref,turno_fijo,turno_ciclo,turno_semana,vigente_desde,vigente_hasta').order('vigente_desde'),
      sb.from('sectores').select('id,nombre,codigo').order('nombre'),
      sb.from('generaciones').select('*').order('created_at',{ascending:false}),
      sb.from('codigos_turno').select('codigo,descripcion,es_laboral,color').order('codigo'),
      _loadTurnosPaginado(yearFrom, yearTo),
    ]);
    if(fRes.error) throw fRes.error;
    if(lRes.error) console.error('Error cargando licencias');
    if(cRes.error) console.error('Error cargando cambios');
    if(uRes.error) console.error('Error cargando usuarios');
    if(phRes.error) console.warn('patron_historico no disponible');
    if(secRes.error) console.warn('sectores no disponible');
    if(genRes.error) console.warn('generaciones no disponible');
    if(codRes.error) console.warn('codigos_turno no disponible — usando fallback');
    DB.sectores         = secRes.data||[];
    DB.generaciones     = genRes.data||[];
    DB.funcionariosAll  = (fRes.data||[]).filter(f=>f.tipo==='fijo');
    DB.suplentesAll     = (fRes.data||[]).filter(f=>f.tipo==='suplente');
    DB.funcionarios     = DB.funcionariosAll.filter(f=>f.activo!==false);
    DB.suplentes        = DB.suplentesAll.filter(f=>f.activo!==false);
    DB.turnos           = turnosData;
    DB.licencias        = lRes.data||[];
    DB.cambios          = cRes.data||[];
    DB.alertas          = aRes.data||[];
    // Rebuild dismissed alerts from DB (leida=true means already handled)
    // Note: static role-alerts (7ª guardia etc.) use DISMISSED_ALERTS in-memory only
    // but DB alerts come from DB.alertas filtered by leida=false
    DB.usuarios         = uRes.data||[];
    DB.patronHistorico  = phRes.data||[];
    DB.codigosTurno     = codRes.data||[];
    // Reconstruir WK_CODES desde BD si la tabla existe y tiene datos
    if(DB.codigosTurno.length){
      WK_CODES = new Set(DB.codigosTurno.filter(c=>c.es_laboral).map(c=>c.codigo.toUpperCase()));
      console.log(`WK_CODES reconstruido desde BD: ${WK_CODES.size} códigos laborales`);
    }
    dbLoaded = true;
    if(typeof loadGENS === 'function') loadGENS(); // sync GENS from DB.generaciones
    console.log('DB sincronizada ✓');
    // Actualizar badges con datos reales
    const pendCambios = DB.cambios.filter(c=>c.estado==='pendiente').length;
    const pendAlertas = DB.alertas.length;
    document.getElementById('tradeBadge').textContent = pendCambios||'';
    document.getElementById('alertBadge').textContent = pendAlertas||'';
    document.getElementById('topAlerts').textContent  = pendAlertas||'0';
    toast('ok','Datos sincronizados',`${DB.funcionarios.length} funcionarios · ${DB.turnos.length} turnos cargados`);
    const dbS=document.getElementById('dbStatus');if(dbS)dbS.style.display='flex';
    // Re-render everything with real data
    buildDynamicData();
    initAll();
    checkIngresoAlerts();
    const curView = document.querySelector('.view.act')?.id?.replace('v-','');
    if(curView) go(curView);
  } catch(err){
    console.error('Error cargando DB:', err);
    toast('wa','Sin conexión a BD','Usando datos de demostración locales');
  } finally {
    showDBLoading(false);
  }
}

function showDBLoading(on){
  let ind = document.getElementById('dbInd');
  if(!ind){
    ind = document.createElement('div');
    ind.id = 'dbInd';
    ind.style.cssText='position:fixed;bottom:16px;right:20px;background:var(--card2);border:1px solid var(--b2);border-radius:8px;padding:8px 13px;font-size:11px;color:var(--t2);display:flex;align-items:center;gap:7px;z-index:8000;';
    document.body.appendChild(ind);
  }
  ind.style.display = on ? 'flex':'none';
  ind.innerHTML = on ? '<span style="width:10px;height:10px;border-radius:50%;border:2px solid var(--blue);border-top-color:transparent;animation:spin .7s linear infinite;display:inline-block"></span> Sincronizando con base de datos...' : '';
}

// "—? FUNCIONARIOS "—————————————————————————————————————————?
async function saveFuncionario(data){
  if(!sb) return null;
  const {data:res, error} = await sb.from('funcionarios').insert(data).select().single();
  if(error){ toast('er','Error','No se pudo guardar el funcionario'); console.error(error); return null; }
  DB.funcionarios.push(res);
  return res;
}

async function updateFuncionario(id, data){
  if(!sb) return null;
  // Only send valid funcionarios columns (exclude joined/computed fields)
  const {numero,apellido,nombre,tipo,email,telefono,fecha_nacimiento,fecha_ingreso,alerta_ingreso_dias,titularidad_temp,horas_semana,horas_dia,turno_fijo,turno_sabado,turno_domingo,turno_ciclo,turno_semana,activo,clinica_id,sector_id,patron,ciclo_ref} = data;
  const cleanData = Object.fromEntries(Object.entries({numero,apellido,nombre,tipo,email,telefono,fecha_nacimiento,fecha_ingreso,alerta_ingreso_dias,titularidad_temp,horas_semana,horas_dia,turno_fijo,turno_sabado,turno_domingo,turno_ciclo,turno_semana,activo,clinica_id,sector_id,patron,ciclo_ref}).filter(([,v])=>v!==undefined));
  const {data:res, error} = await sb.from('funcionarios').update(cleanData).eq('id',id).select().single();
  if(error){ toast('er','Error','No se pudo actualizar'); return null; }
  const idx = DB.funcionarios.findIndex(f=>f.id===id);
  if(idx>=0) DB.funcionarios[idx]={...DB.funcionarios[idx],...res};
  return res;
}

// "—? TURNOS "———————————————————————————————————————————————?
async function saveTurno(funcionarioId, fecha, codigo, sectorId, nota){
  if(!sb) return null;
  const payload = { funcionario_id:funcionarioId, fecha, codigo, sector_id:sectorId||null, nota:nota||null };
  const {data:res, error} = await sb.from('turnos').upsert(payload, {onConflict:'funcionario_id,fecha'}).select().single();
  if(error){ toast('er','Error al guardar turno', error.message); return null; }
  const idx = DB.turnos.findIndex(t=>t.funcionario_id===funcionarioId && t.fecha===fecha);
  if(idx>=0) DB.turnos[idx]=res; else DB.turnos.push(res);
  return res;
}

async function saveTurnosBatch(records){
  if(!sb || !records.length) return true;
  const {error} = await sb.from('turnos').upsert(records, {onConflict:'funcionario_id,fecha'});
  if(error){ toast('er','Error al guardar turnos', error.message); return false; }
  records.forEach(r=>{
    const idx=DB.turnos.findIndex(t=>t.funcionario_id===r.funcionario_id && t.fecha===r.fecha);
    if(idx>=0) DB.turnos[idx]=r; else DB.turnos.push(r);
  });
  return true;
}

async function deleteTurno(funcionarioId, fecha){
  if(!sb) return false;
  const {error} = await sb.from('turnos').delete().eq('funcionario_id',funcionarioId).eq('fecha',fecha);
  if(error){ toast('er','Error','No se pudo eliminar el turno'); return false; }
  DB.turnos = DB.turnos.filter(t=>!(t.funcionario_id===funcionarioId && t.fecha===fecha));
  return true;
}

// "—? GENERACIONES "—————————————————————————————————————————?
async function saveGeneracion(payload){
  if(!sb) return null;
  const {data:res, error} = await sb.from('generaciones').insert(payload).select().single();
  if(error){
    console.error('Error al guardar generación:', error);
    toast('er','Error al guardar generación',error.message?.slice(0,120)||'Verificá que la tabla tenga todas las columnas requeridas');
    return null;
  }
  DB.generaciones.unshift(res);
  return res;
}

async function updateGeneracion(id, fields){
  if(!sb) return null;
  const {data:res, error} = await sb.from('generaciones').update(fields).eq('id',id).select().single();
  if(error){ toast('er','Error','No se pudo actualizar la generación'); return null; }
  const idx = DB.generaciones.findIndex(g=>g.id===id);
  if(idx>=0) DB.generaciones[idx]={...DB.generaciones[idx],...res};
  return res;
}

async function deleteGeneracion(id){
  if(!sb) return false;
  const {error} = await sb.from('generaciones').delete().eq('id',id);
  if(error){ toast('er','Error','No se pudo eliminar la generación'); return false; }
  DB.generaciones = DB.generaciones.filter(g=>g.id!==id);
  return true;
}

// "—? LICENCIAS "————————————————————————————————————————————?
async function saveLicencia(data){
  if(!sb) return null;
  // Some schemas compute `dias` as generated column; avoid sending it in INSERT.
  const payload = {...data};
  if(Object.prototype.hasOwnProperty.call(payload,'dias')) delete payload.dias;
  const {data:res, error} = await sb.from('licencias').insert(payload).select('id, funcionario_id, suplente_id, tipo, fecha_desde, fecha_hasta, dias, genera_vacante, estado, observaciones, funcionario:funcionario_id(apellido,nombre,sector:sector_id(nombre)), suplente:suplente_id(apellido,nombre)').single();
  if(error){ toast('er','Error al guardar licencia', error.message); console.error(error); return null; }
  DB.licencias.push(res);
  // Also push to LIC_DATA for immediate renderLics refresh (all roles)
  LIC_DATA.push({
    id: res.id,
    emp: res.funcionario ? `${res.funcionario.apellido}, ${res.funcionario.nombre}` : data.funcionario_id||'—',
    sec: res.funcionario?.sector?.nombre || '—',
    type: res.tipo,
    from: res.fecha_desde,
    to: res.fecha_hasta,
    days: res.dias || Math.max(1,Math.round((new Date(res.fecha_hasta)-new Date(res.fecha_desde))/86400000)+1),
    vac: res.genera_vacante,
    sub: res.suplente?fNombre(res.suplente):(res.suplente_id?'Asignado':'Sin asignar'),
    st: res.estado==='pendiente'?'pendiente':(res.genera_vacante && !res.suplente_id ? 'uncovered' : 'active'),
  });
  return res;
}

// "—? CAMBIOS DE TURNO "————————————————————————————————————?
function getSupervisorFuncionarioIds(){
  return (DB.usuarios||[])
    .filter(u=>['admin','supervisor'].includes(u.rol) && u.funcionario_id)
    .map(u=>u.funcionario_id);
}

async function saveCambio(data){
  if(!sb) return null;
  const {data:res, error} = await sb.from('cambios').insert(data).select('id, solicitante_id, receptor_id, turno_cede, fecha_cede, turno_recibe, fecha_recibe, estado, motivo, created_at, solicitante:solicitante_id(apellido,nombre), receptor:receptor_id(apellido,nombre)').single();
  if(error){
    if(error.code==='23505'){
      toast('wa','Solicitud duplicada','Ya existe una solicitud pendiente igual.');
    } else {
      toast('er','Error','No se pudo guardar el cambio');
    }
    return null;
  }
  DB.cambios.unshift(res);
  return res;
}

async function deleteFuncionario(id){
  if(!sb) return false;
  const {error} = await sb.from('funcionarios').update({activo:false}).eq('id',id);
  if(error){ toast('er','Error','No se pudo eliminar el funcionario'); return false; }
  DB.funcionarios = DB.funcionarios.filter(f=>f.id!==id);
  DB.suplentes = DB.suplentes.filter(f=>f.id!==id);
  return true;
}

async function updateCambio(id, estado, extraFields={}){
  if(!sb) return null;
  const {data:res, error} = await sb.from('cambios').update({estado,...extraFields}).eq('id',id).select('id, solicitante_id, receptor_id, turno_cede, fecha_cede, turno_recibe, fecha_recibe, estado, motivo, created_at, solicitante:solicitante_id(apellido,nombre), receptor:receptor_id(apellido,nombre)').single();
  if(error){ toast('er','Error','No se pudo actualizar el cambio'); return null; }
  const idx = DB.cambios.findIndex(c=>c.id===id);
  if(idx>=0) DB.cambios[idx]=res;
  return res;
}

// "—? ALERTAS "——————————————————————————————————————————————?
async function createAlerta(tipo, titulo, descripcion, funcionarioId){
  if(!sb) return null;
  const {data:res, error} = await sb.from('alertas').insert({tipo,titulo,descripcion,funcionario_id:funcionarioId||null}).select().single();
  if(error) return null;
  DB.alertas.unshift(res);
  return res;
}

// Revisa todos los funcionarios con fecha_ingreso y dispara alertas
// cuando se alcanza el umbral de días configurado (default 45 = 1.5 meses)
async function checkIngresoAlerts(){
  if(!sb || !DB.funcionarios.length) return;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const ventana = 3; // disparar alerta en los 3 días previos al umbral
  for(const f of DB.funcionarios){
    if(!f.fecha_ingreso) continue;
    const ingreso = new Date(f.fecha_ingreso+'T00:00:00');
    if(isNaN(ingreso.getTime())) continue;
    const dias   = f.alerta_ingreso_dias || 45;
    const umbral = new Date(ingreso); umbral.setDate(umbral.getDate() + dias);
    const diffMs = umbral - hoy;
    const diffDias = Math.round(diffMs / 86400000);
    if(diffDias < 0 || diffDias > ventana) continue; // ya pasó o falta más de 3 días
    const nombre = fNombre(f);
    const titulo = `Cumple ${dias} días de ingreso — ${nombre}`;
    // Evitar duplicados: buscar alerta broadcast con mismo título
    const yaExiste = (DB.alertas||[]).some(a=>
      !a.funcionario_id &&
      String(a.tipo||'').startsWith('ingreso_') &&
      String(a.titulo||'') === titulo
    );
    if(yaExiste) continue;
    const desc   = diffDias === 0
      ? `Hoy ${nombre} cumple ${dias} días desde su ingreso a la institución.`
      : `En ${diffDias} día${diffDias>1?'s':''}, ${nombre} cumplirá ${dias} días de ingreso (${umbral.toLocaleDateString('es-UY')}).`;
    await createAlerta('ingreso_'+dias, titulo, desc, null); // broadcast → solo visible para admin/supervisor
  }
}

async function marcarAlertasLeidas(){
  if(!sb) return;
  // Filtrar por usuario para no marcar alertas ajenas
  // Admin/supervisor: solo las propias + broadcast; RLS maneja el resto
  const fid = DB.usuarios?.find(u=>u.email===window.cUser?.email)?.funcionario_id;
  let q = sb.from('alertas').update({leida:true}).eq('leida',false);
  if(fid) q = q.or(`funcionario_id.is.null,funcionario_id.eq.${fid}`);
  await q;
  DB.alertas = [];
  document.getElementById('alertBadge').textContent='';
  document.getElementById('topAlerts').textContent='0';
}

// "—? TIEMPO REAL (realtime) "———————————————————————————————?
function initRealtime(){
  if(!sb) return;
  sb.channel('guardiapp-changes')
    .on('postgres_changes',{event:'*',schema:'public',table:'turnos'},   ()=>{ loadDB(); })
    .on('postgres_changes',{event:'*',schema:'public',table:'cambios'},  ()=>{ loadDB(); })
    .on('postgres_changes',{event:'*',schema:'public',table:'alertas'},  ()=>{ loadDB(); })
    .on('postgres_changes',{event:'*',schema:'public',table:'licencias'},()=>{ loadDB(); })
    .subscribe((status)=>{
      if(status==='SUBSCRIBED') console.log('Realtime activo o"');
    });
}

// "—? Helper: nombre completo funcionario "——————————————————?
function fNombre(f){ return f ? `${f.apellido}, ${f.nombre}`.trim() : '—'; }
function getTurnoFecha(funcId, fecha){
  const t = DB.turnos.find(t=>t.funcionario_id===funcId && t.fecha===fecha);
  return t ? t.codigo : null;
}

// "—? Helper: patrón histórico vigente para un mes ——————————?
/**
 * Devuelve el registro de patron_historico más reciente vigente
 * para un funcionario en una fecha determinada.
 * @param {number} funcId  - ID del funcionario
 * @param {string} mesStr  - 'YYYY-MM-DD' (primer día del mes a evaluar)
 * @returns {Object|null}  - Registro o null si no hay historial
 */
function getPatronVigente(funcId, mesStr){
  return (DB.patronHistorico||[])
    .filter(r => r.funcionario_id===funcId
               && r.vigente_desde<=mesStr
               && (!r.vigente_hasta||r.vigente_hasta>=mesStr))
    .sort((a,b)=>b.vigente_desde.localeCompare(a.vigente_desde))[0] || null;
}

if(window.GApp?.registerLayer){
  window.GApp.registerLayer('infra', {
    initSB,
    loadDB,
    initRealtime,
    saveFuncionario,
    updateFuncionario,
    deleteFuncionario,
    saveTurno,
    saveTurnosBatch,
    deleteTurno,
    saveLicencia,
    saveCambio,
    updateCambio,
    saveGeneracion,
    updateGeneracion,
    deleteGeneracion,
    createAlerta,
    getSupervisorFuncionarioIds,
    marcarAlertasLeidas,
    checkIngresoAlerts,
    getPatronVigente,
  });
}




