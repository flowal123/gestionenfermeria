
// ........................................................

if(window.GApp?.registerLayer){
  window.GApp.registerLayer('core', {
    doLogin,
    doLogout,
    go,
    applyPerms,
    initAll,
    populateSels,
    buildDynamicData,
    getCurrFuncionario,
  });
}
// DATA
// ........................................................
const ROLES={
  admin:    {label:'Admin/Gerencia',icon:'🛡️',chip:'cb2'},
  supervisor:{label:'Supervisor',icon:'👩‍💼',chip:'cg'},
  nurse:    {label:'Enfermería',icon:'👩‍⚕️',chip:'cp'},
};
const PERMS={
  admin:    ['dashboard','schedule','mySchedule','employees','licenses','trades','alerts','generation','notifications','hrReport','users','sectors'],
  supervisor:['dashboard','schedule','mySchedule','employees','licenses','trades','alerts','generation','notifications','hrReport'],
  nurse:    ['mySchedule','trades','alerts'],
};

const EMPS=[];
const SUBS=[];
const COV=[];

const SGRP=[];

const WK={};

const MYSCHED={};

// Turnos L-S: reciben 1 LE aleatorio por período en generación automática
const LS_SHIFTS_LE=new Set(['M','MS','MC','MG','MU','MD','T','TS','TC','TG','TU','TD','RS']);

const DAB='LMMJVSD';
// WK_CODES — reconstruido desde BD (codigos_turno.es_laboral=true) en loadDB()
// Fallback hardcodeado para modo offline / antes de carga
let WK_CODES=new Set(['M','MS','MC','MG','MO','MU','MD','T','TS','TC','TG','TO','TU','TD','N','NS','NC','NG','NO','NU','ND','RS','V','VO','VU','VD','CPB','GINE','AXO','H','AP','U1','U2','DOM','PSR','O','CG','CWM','E','ES','CWT','FI','BSE','BPS','LM','CMP','I']);

// ........................................................
// UTILS
// ........................................................
let sb = null;
let dbLoaded = false;
let DB = { funcionarios:[], suplentes:[], funcionariosAll:[], suplentesAll:[], turnos:[], licencias:[], cambios:[], alertas:[], usuarios:[], sectores:[] };

let cRole='nurse', cUser=null, cWeek=0, cSF='all';

function shCls(code){
  if(!code) return '';
  const c=code.toUpperCase();
  if(['M','MS','MC','MG','MO','MU','MD','PSR','I'].includes(c)) return 'sM';
  if(['T','TS','TC','TG','TO','TU','TD','RS','O','E','ES','CWT'].includes(c)) return 'sT';
  if(['NO','NU'].includes(c)) return 'sN';
  if(['VO','VU','VD','V'].includes(c)) return 'sV';
  if(c==='LAR') return 'sLAR';
  if(['CERT','BPS','BSE','LM'].includes(c)) return 'sCERT';
  if(['MAT','PAT'].includes(c)) return 'sCERT';
  if(c==='F') return 'sF';
  if(c==='LXC') return 'sLXC';
  if(c==='NC') return 'sNC';
  if(c==='CMP') return 'sCMP';
  if(['FI','LE','LXE','LX1','LX3','Lx3','DXF'].includes(c)||c.startsWith('LX')||c.startsWith('Lx')) return 'sLE';
  if(['CPB','GINE','AXO','H','AP','DOM'].includes(c)) return 'sCPB';
  return 'sX';
}
function isW(c){return c&&WK_CODES.has(c.toUpperCase());}
function isWknd(d){return (3+d-1)%7>=5;}

// ........................................................
// LOGIN
// ........................................................
function selRole(r,el){
  // Demo mode only: pre-fills email to hint at demo credentials
  cRole=r;
  document.querySelectorAll('.rb').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
}

async function doLogin(){
  const userInp  = (document.getElementById('lemail')?.value||'').trim().toLowerCase();
  const passInp  = document.getElementById('lpass')?.value||'';
  const btn = document.getElementById('loginBtn');
  if(btn){ btn.textContent='Verificando...'; btn.disabled=true; }

  const infra    = window.GApp?.getLayer('infra');
  const features = window.GApp?.getLayer('features');

  try {
    // ── Validaciones básicas ────────────────────────────────────────────────
    if(!userInp){
      toast('er','Campo requerido','Ingresá tu usuario para continuar.');
      return;
    }
    if(!passInp){
      toast('er','Campo requerido','Ingresá tu contraseña para continuar.');
      return;
    }

    // ── Autenticación con Supabase ──────────────────────────────────────────
    if(!sb) infra?.initSB?.();

    if(sb){
      // Limpiar sesión previa para evitar conflicto con refresh automático
      await sb.auth.signOut().catch(()=>{});
      const authEmail = `${userInp}@guardiapp.app`;
      const {data, error} = await sb.auth.signInWithPassword({email:authEmail, password:passInp});
      if(error){
        console.error('[doLogin] Supabase error:', error);
        const errLow = error.message?.toLowerCase()||'';
        let msg = 'Usuario o contraseña incorrectos.';
        if(errLow.includes('network') || errLow.includes('fetch'))
          msg = 'Sin conexión con el servidor. Verificá tu internet.';
        else if(errLow.includes('too many'))
          msg = 'Demasiados intentos. Esperá unos minutos.';
        toast('er','Acceso denegado', `${msg} (${error.message})`);
        return;
      }
      // Obtener rol y datos del funcionario desde la tabla usuarios
      const {data:uRow, error:uErr} = await sb.from('usuarios')
        .select('rol, activo, funcionario_id, funcionario:funcionario_id(apellido, nombre, sector:sector_id(nombre))')
        .eq('email', authEmail)
        .eq('activo', true)
        .maybeSingle();
      if(uErr || !uRow){
        toast('er','Sin acceso','No tenés un usuario activo en el sistema. Contactá al administrador.');
        await sb.auth.signOut();
        return;
      }
      cRole = uRow.rol || 'nurse';
      const f = uRow.funcionario;
      cUser = {
        name:           f ? `${f.apellido}${f.nombre?' '+f.nombre:''}` : userInp,
        email:          authEmail,
        username:       userInp,
        funcionario_id: uRow.funcionario_id||null,
        initials:       f ? (f.apellido?.[0]||'')+(f.nombre?.[0]||'?') : (userInp[0]||'?').toUpperCase(),
        sector:         f?.sector?.nombre||'—',
        clinic:         '—',
      };
      _finishLogin(infra, features);
      return;
    }

    // Sin Supabase disponible — no hay acceso
    toast('er','Sin conexión','No se pudo conectar con el servidor. Verificá tu conexión o recargá la página.');

  } finally {
    if(btn){ btn.textContent='Ingresar al Sistema'; btn.disabled=false; }
  }
}

function _finishLogin(infra, features){
  const ri=ROLES[cRole];
  document.getElementById('sRIcon').textContent=ri.icon;
  document.getElementById('sRName').textContent=ri.label;
  const _sul=document.getElementById('sULine');
  if(_sul){
    const _sulTxt=cUser.sector&&cUser.sector!=='—'?cUser.sector:'';
    _sul.textContent=_sulTxt;
    _sul.style.display=_sulTxt?'':'none';
  }
  document.getElementById('sAv').textContent=cUser.initials;
  document.getElementById('sName').textContent=cUser.name;
  document.getElementById('sEmail').textContent=cUser.username||cUser.email;
  document.getElementById('topChip').innerHTML=`<span class="chip ${ri.chip}">${ri.label}</span>`;
  applyPerms();
  document.getElementById('ls').classList.add('gone');
  document.getElementById('app').classList.remove('gone');
  const first={admin:'dashboard',supervisor:'dashboard',nurse:'mySchedule'}[cRole]||'mySchedule';
  go(first);
  initAll();
  toast('ok',`Bienvenida, ${cUser.name}`,`Rol: ${ri.label}`);
  setTimeout(()=>features?.initEJ?.(), 300);
  if(!infra) return;
  const loadPromise = infra.loadDB ? infra.loadDB() : Promise.resolve();
  loadPromise.then(()=>{
    if(!dbLoaded) return;
    // Actualizar sidebar con datos reales del funcionario vinculado
    const dbU=DB.usuarios.find(u=>(u.email||'').toLowerCase()===cUser.email);
    if(dbU?.funcionario){
      const f=dbU.funcionario;
      cUser.name=fNombre(f);
      cUser.sector=f.sector?.nombre||cUser.sector;
      const el=document.getElementById('sName');   if(el)  el.textContent=cUser.name;
      const el2=document.getElementById('sULine');
      if(el2){ const t=cUser.sector&&cUser.sector!=='—'?cUser.sector:''; el2.textContent=t; el2.style.display=t?'':'none'; }
      const el3=document.getElementById('sAv');    if(el3) el3.textContent=(f.apellido[0]||'')+(f.nombre?.[0]||'?');
    }
    infra.initRealtime?.();
  });
}

function doLogout(){
  closeMobileNav();
  document.getElementById('ls').classList.remove('gone');
  document.getElementById('app').classList.add('gone');
}

function isMobileNav(){
  return window.matchMedia('(max-width: 900px)').matches;
}

function openMobileNav(){
  if(!isMobileNav()) return;
  document.body.classList.add('mnav-open');
}

function closeMobileNav(){
  document.body.classList.remove('mnav-open');
}

function toggleMobileNav(){
  if(!isMobileNav()) return;
  document.body.classList.toggle('mnav-open');
}

function applyPerms(){
  const ok=PERMS[cRole];
  // Hide/show nav section labels dynamically
  document.querySelectorAll('.ni[id^="n-"]').forEach(el=>{
    const v=el.id.replace('n-','');
    el.style.display = ok.includes(v) ? '' : 'none';
    if(ok.includes(v)){ el.classList.remove('lk'); el.onclick=()=>go(v); }
  });
  // Hide section labels if all items in section are hidden
  document.querySelectorAll('.nsl').forEach(lbl=>{
    let sib=lbl.nextElementSibling; let anyVisible=false;
    while(sib && !sib.classList.contains('nsl') && !sib.classList.contains('sb-bot')){
      if(sib.style.display!=='none') anyVisible=true;
      sib=sib.nextElementSibling;
    }
    lbl.style.display = anyVisible ? '' : 'none';
  });
}

// ........................................................
// NAVIGATION
// ........................................................
const PTITLES={dashboard:'Dashboard General',schedule:'Planificación Mensual',mySchedule:'Mi Agenda Personal',employees:'Gestión de Funcionarios',licenses:'Licencias y Ausencias',trades:'Cambios de Turno',alerts:'Centro de Alertas',generation:'Generación Automática',notifications:'Notificaciones',hrReport:'Reporte RRHH',users:'Usuarios y Permisos',sectors:'Sectores'};

function go(id){
  if(!PERMS[cRole].includes(id)){toast('wa','Acceso restringido','Sin permiso para esta sección.');return;}
  closeMobileNav();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('act'));
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('act'));
  const vEl=document.getElementById('v-'+id);
  if(vEl) vEl.classList.add('act');
  const nEl=document.getElementById('n-'+id);
  if(nEl&&!nEl.classList.contains('lk')) nEl.classList.add('act');
  document.getElementById('pgTitle').textContent=PTITLES[id]||id;
  if(id==='schedule')    renderCal();
  if(id==='mySchedule')  renderMySched();
  if(id==='dashboard')   { renderDashAlerts(); renderDashboard(); }
  if(id==='employees')   { renderEmps(); renderSubs2(); }
  if(id==='licenses')    { renderLics(); renderLAR(); }
  if(id==='trades')      renderTrades();
  if(id==='alerts')      renderAlerts();
  if(id==='generation')  { renderGenHistory(); populateSendMes(); }
  if(id==='notifications') renderNotifications();
  if(id==='hrReport')    renderHR();
  if(id==='users')       renderUsers();
  if(id==='sectors')     renderSectors();
  populateSels();
}

// ........................................................
// INIT
// ........................................................
// .......................................................
// BUILD DYNAMIC DATA FROM DB
// .......................................................
function buildDynamicData(){
  if(!dbLoaded || !DB.funcionarios.length) return;
  const skip=new Set(['LAR','CERT','LE','F','DXF','CPL','E','LX1','LX2','LX3','LX4','LXE','NO CONVOCAR','MAT','PAT']);

  // EMPS — incluye fijos + suplentes con titularidad momentánea
  EMPS.length=0;
  const titulares = DB.suplentes.filter(s=>s.titularidad_temp);
  [...DB.funcionarios, ...titulares].forEach(f=>{
    const ts=DB.turnos.filter(t=>t.funcionario_id===f.id);
    const g=ts.filter(t=>t.codigo&&!skip.has(t.codigo)).length;
    EMPS.push({name:fNombre(f), clinic:f.clinica?.nombre||'—', sector:f.sector?.nombre||'—',
      shift:f.turno_fijo||'M', hday:f.horas_dia||6, status:'active', id:f.id,
      g, extras:g>22?(g-22)*6:0, faltas:ts.filter(t=>t.codigo==='F').length,
      titularidad_temp: !!f.titularidad_temp});
  });

  // SUBS
  SUBS.length=0;
  DB.suplentes.forEach(f=>{
    SUBS.push({name:fNombre(f), sen:f.antiguedad||1, pct:f.cumplimiento||80,
      comp:f.competencias||[], g:0, status:'available', id:f.id});
  });

  // WK - week Jan 5-11
  for(const k in WK) delete WK[k];
  const wkMap={};
  DB.turnos.forEach(t=>{
    const d=new Date(t.fecha+'T12:00:00');
    const day=d.getUTCDate(), wd=(d.getUTCDay()+6)%7;
    if(day>=5&&day<=11){
      if(!wkMap[t.funcionario_id]) wkMap[t.funcionario_id]={};
      wkMap[t.funcionario_id][wd]=t.codigo;
    }
  });
  DB.funcionarios.forEach(f=>{
    const m=wkMap[f.id]||{};
    WK[fNombre(f)]=[m[0]||'',m[1]||'',m[2]||'',m[3]||'',m[4]||'',m[5]||'',m[6]||''];
  });

  // MYSCHED - current user's month
  for(const k in MYSCHED) delete MYSCHED[k];
  const cu=getCurrFuncionario();
  if(cu) DB.turnos.filter(t=>t.funcionario_id===cu.id)
    .forEach(t=>{ MYSCHED[new Date(t.fecha+'T12:00:00').getUTCDate()]=t.codigo; });

  // SGRP - sector groups (fijos + suplentes con titularidad)
  SGRP.length=0;
  const secMap={};
  [...DB.funcionarios, ...titulares].forEach(f=>{
    const s=f.sector?.nombre||'—';
    if(!secMap[s]) secMap[s]=[];
    secMap[s].push(fNombre(f));
  });
  const _fallbackOrd=['POLI MAÑANA','POLI TARDE','ANEXO','CPB','OBSERVACIÓN','AMNP','ECONOMATO',
    'PROGRAMAS','GINE SET','TISANERÍA','BQ','HORNEROS','DOMICILIO','APOYO','CARRASCO','GOLF','MALDONADO','A.PARK'];
  const ord=DB.sectores.length ? DB.sectores.map(s=>s.nombre) : _fallbackOrd;
  [...new Set([...ord,...Object.keys(secMap)])].forEach(s=>{
    if(secMap[s]?.length) SGRP.push({sector:s, emps:secMap[s]});
  });

  // COV - coverage per sector
  COV.length=0;
  const _hoyC=new Date().toISOString().slice(0,10);
  const licNms=new Set(DB.licencias.filter(l=>l.estado==='activa'&&l.fecha_desde<=_hoyC&&l.fecha_hasta>=_hoyC).map(l=>l.funcionario?fNombre(l.funcionario):''));
  SGRP.forEach(g=>{
    const tot=g.emps.length, act=g.emps.filter(n=>!licNms.has(n)).length;
    COV.push({name:g.sector, pct:tot?Math.round(act/tot*100):100, n:tot});
  });

  // LIC_DATA
  LIC_DATA.length=0;
  DB.licencias.forEach(l=>{
    LIC_DATA.push({
      id:l.id, emp:l.funcionario?fNombre(l.funcionario):'—',
      sec:l.funcionario?.sector?.nombre||'—',
      type:l.tipo, from:l.fecha_desde, to:l.fecha_hasta,
      days:l.dias||Math.max(1,Math.round((new Date((l.fecha_hasta||new Date().toISOString().slice(0,10))+'T12:00:00')-new Date((l.fecha_desde||new Date().toISOString().slice(0,10))+'T12:00:00'))/86400000)+1),
      vac:l.genera_vacante,
      sub:l.suplente?fNombre(l.suplente):l.suplente_id?'Asignado':'Sin asignar',
      st:l.estado==='pendiente'?'pendiente':l.genera_vacante&&!l.suplente_id?'uncovered':l.estado==='activa'?'active':'covered'
    });
  });

  // USERS_DATA
  USERS_DATA.length=0;
  DB.usuarios.forEach(u=>{
    USERS_DATA.push({
      id:u.id, name:u.funcionario?fNombre(u.funcionario):(u.email||'—'),
      email:u.email, role:u.rol,
      sector:u.funcionario?.sector?.nombre||'—',
      last:'Reciente', active:u.activo!==false
    });
  });

  console.log(`buildDynamic: ${EMPS.length} emps, ${SUBS.length} subs, ${SGRP.length} sectores, ${LIC_DATA.length} lics, ${Object.keys(WK).length} WK entries`);
}

function getCurrFuncionario(){
  if(!cUser || !DB.funcionarios.length) return null;
  const allF=[...DB.funcionarios,...DB.suplentes];
  // Buscar por funcionario_id primero (más confiable, viene del login)
  if(cUser.funcionario_id) return allF.find(f=>f.id===cUser.funcionario_id)||null;
  // Fallback por nombre
  const userName=(cUser.name||'').toLowerCase();
  return allF.find(f=>
    (userName && fNombre(f).toLowerCase()===userName) ||
    (userName && f.apellido && userName.includes(f.apellido.toLowerCase()))
  ) || null;
}


function initAll(){
  closeMobileNav();
  renderGenHistory();
  populateSendMes();
  renderDashAlerts();renderDashboard();renderEmps();renderSubs2();renderCompMat();
  renderLics();renderLAR();renderTrades();renderAlerts();renderUsers();renderHR();
  populateSels();
}

if(!window.__mobileNavCloseBound){
  window.__mobileNavCloseBound=true;
  window.addEventListener('resize', ()=>{
    if(!isMobileNav()) closeMobileNav();
  });
}

function populateSels(){
  // Prefer DB data when loaded, fallback to hardcoded EMPS/SUBS
  const fijos   = dbLoaded&&DB.funcionarios.length ? DB.funcionarios.map(f=>({name:fNombre(f),id:f.id,tipo:'fijo'})) : EMPS.map(e=>({name:e.name,id:null,tipo:'fijo'}));
  const suplentes = dbLoaded&&DB.suplentes.length ? DB.suplentes.map(f=>({name:fNombre(f),id:f.id,tipo:'suplente'})) : SUBS.map(s=>({name:s.name,id:null,tipo:'suplente'}));
  const all = [...fijos,...suplentes];
  const uniqueByName = arr => {
    const seen = new Set();
    return arr.filter(x=>{
      const k=String(x.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
      if(seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const uniqFijos = uniqueByName(fijos);
  const uniqAll = uniqueByName(all);
  const allNames = uniqAll.map(f=>f.name);
  // uEmp necesita UUID como valor para crear usuarios con funcionario_id correcto
  const uEmpEl=document.getElementById('uEmp');
  if(uEmpEl){
    const cur=uEmpEl.value;
    uEmpEl.innerHTML='<option value="">Seleccionar...</option>'+uniqAll.map(f=>`<option value="${f.id||''}">${f.name}</option>`).join('');
    if(cur) uEmpEl.value=cur;
  }
  ['smEmp','larEmp','licEmp','trdReceptor'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    const isAll=el.querySelector('[value="all"]');
    const base=isAll?'<option value="all">Todos</option>':'<option value="">Seleccionar...</option>';
    // For licEmp: only fijos (not suplentes requesting license)
    const names = id==='licEmp' ? uniqFijos.map(f=>f.name) : (id==='larEmp' ? uniqFijos.map(f=>f.name) : allNames);
    el.innerHTML=base+names.map(n=>`<option value="${n}">${n}</option>`).join('');
  });
  // HR detail select
  const det=document.getElementById('hrDetSel');
  if(det){
    const cur=det.value||'all';
    det.innerHTML='<option value="all">Todos los funcionarios</option>'+fijos.map(f=>`<option value="${f.name}">${f.name}</option>`).join('');
    if(cur) det.value=cur;
  }
  // Sector filter select in schedule view — populate from DB.sectores
  const sfSel=document.getElementById('sfSel');
  if(sfSel && dbLoaded && DB.sectores.length){
    const cur=sfSel.value||'all';
    sfSel.innerHTML='<option value="all">Todos los sectores</option>'+
      DB.sectores.map(s=>`<option value="${s.nombre}">${s.nombre}</option>`).join('');
    sfSel.value=cur; // restore selection
  }
  // Trade turno code selects — mirror smCode options
  const smCodeEl=document.getElementById('smCode');
  if(smCodeEl){
    const cloned=smCodeEl.innerHTML;
    ['trdMiCod','trdSuCod'].forEach(id=>{
      const sel=document.getElementById(id);
      if(sel){ const cur=sel.value; sel.innerHTML=cloned; if(cur) sel.value=cur; }
    });
  }
  // Sector dropdowns — populate from DB.sectores
  if(dbLoaded && DB.sectores && DB.sectores.length){
    const secOpts = DB.sectores.map(s=>`<option value="${s.nombre}">${s.nombre}</option>`).join('');
    const eSecEl = document.getElementById('eSec');
    if(eSecEl){ const cur=eSecEl.value; eSecEl.innerHTML='<option value="">Seleccionar...</option>'+secOpts; if(cur) eSecEl.value=cur; }
    const eTitSecEl = document.getElementById('eTitSector');
    if(eTitSecEl){ const cur=eTitSecEl.value; eTitSecEl.innerHTML='<option value="">Seleccionar sector...</option>'+secOpts; if(cur) eTitSecEl.value=cur; }
    const empSecEl = document.getElementById('empSecFilter');
    if(empSecEl){ const cur=empSecEl.value; empSecEl.innerHTML='<option value="">Todos los sectores</option>'+secOpts; if(cur) empSecEl.value=cur; }
  }
}

// ........................................................


