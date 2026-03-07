// SUPABASE CONFIG + DB
// ........................................................
const SB_URL = 'https://mrrjipzarpqksogrnalz.supabase.co';
const SB_KEY = 'sb_publishable_Av-rU1CVm1CRV2D8WZuxLQ_Uxa_2OTF';
// sb declared at top of script
function initSB(){
  if(typeof supabase === 'undefined'){ console.warn('Supabase SDK no cargó'); return; }
  sb = supabase.createClient(SB_URL, SB_KEY);
  console.log('Supabase conectado o"');
}

// "—? Carga todos los datos desde Supabase "—————————————————?
async function loadDB(){
  if(!sb){ console.warn('Supabase no iniciado'); return; }
  showDBLoading(true);
  try {
    const [fRes, tRes, lRes, cRes, aRes, uRes] = await Promise.all([
      sb.from('funcionarios').select('*, clinica:clinicas(nombre,codigo), sector:sectores(nombre,codigo)').order('apellido'),
      sb.from('turnos').select('funcionario_id, fecha, codigo, sector_id').gte('fecha','2026-01-01').lte('fecha','2026-12-31').limit(20000),
      sb.from('licencias').select('id, funcionario_id, suplente_id, tipo, fecha_desde, fecha_hasta, dias, genera_vacante, estado, observaciones, funcionario:funcionario_id(id,apellido,nombre,telefono,fecha_nacimiento,sector:sector_id(nombre)), suplente:suplente_id(apellido,nombre)').in('estado',["activa","pendiente"]),
      sb.from('cambios').select('id, solicitante_id, receptor_id, turno_cede, fecha_cede, turno_recibe, fecha_recibe, estado, created_at, solicitante:solicitante_id(apellido,nombre), receptor:receptor_id(apellido,nombre)').order('created_at',{ascending:false}),
      sb.from('alertas').select('*').eq('leida',false).order('created_at',{ascending:false}).limit(20),
      sb.from('usuarios').select('id, email, rol, activo, funcionario_id, funcionario:funcionario_id(id,apellido,nombre,email,sector:sector_id(nombre),clinica:clinica_id(nombre))').eq('activo',true),
    ]);
    if(fRes.error) throw fRes.error;
    if(tRes.error) console.error('O turnos:', tRes.error.message);
    if(lRes.error) console.error('O licencias:', lRes.error.message);
    if(cRes.error) console.error('O cambios:', cRes.error.message);
    if(uRes.error) console.error('O usuarios:', uRes.error.message);
    DB.funcionariosAll = (fRes.data||[]).filter(f=>f.tipo==='fijo');
    DB.suplentesAll    = (fRes.data||[]).filter(f=>f.tipo==='suplente');
    DB.funcionarios = DB.funcionariosAll.filter(f=>f.activo!==false);
    DB.suplentes    = DB.suplentesAll.filter(f=>f.activo!==false);
    DB.turnos       = tRes.data||[];
    DB.licencias    = lRes.data||[];
    DB.cambios      = cRes.data||[];
    DB.alertas      = aRes.data||[];
    // Rebuild dismissed alerts from DB (leida=true means already handled)
    // Note: static role-alerts (7ª guardia etc.) use DISMISSED_ALERTS in-memory only
    // but DB alerts come from DB.alertas filtered by leida=false
    DB.usuarios     = uRes.data||[];
    dbLoaded = true;
    console.log(`o. DB: ${DB.funcionarios.length} fijos activos, ${DB.suplentes.length} suplentes activos, ${DB.turnos.length} turnos, ${LIC_DATA.length} licencias`);
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
  const {apellido,nombre,tipo,email,telefono,fecha_nacimiento,horas_semana,horas_dia,turno_fijo,activo,clinica_id,sector_id,patron,ciclo_ref} = data;
  const cleanData = Object.fromEntries(Object.entries({apellido,nombre,tipo,email,telefono,fecha_nacimiento,horas_semana,horas_dia,turno_fijo,activo,clinica_id,sector_id,patron,ciclo_ref}).filter(([,v])=>v!==undefined));
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
async function saveCambio(data){
  if(!sb) return null;
  const {data:res, error} = await sb.from('cambios').insert(data).select().single();
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

async function updateCambio(id, estado){
  if(!sb) return null;
  const {data:res, error} = await sb.from('cambios').update({estado}).eq('id',id).select().single();
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

async function marcarAlertasLeidas(){
  if(!sb) return;
  await sb.from('alertas').update({leida:true}).eq('leida',false);
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
    createAlerta,
    marcarAlertasLeidas,
  });
}




