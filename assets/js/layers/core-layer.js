
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
  admin:    ['dashboard','schedule','mySchedule','employees','licenses','trades','alerts','generation','hrReport','users'],
  supervisor:['dashboard','schedule','mySchedule','employees','licenses','trades','alerts','generation','hrReport'],
  nurse:    ['mySchedule','trades','alerts'],

};
const DEMO={
  admin:    {name:'Admin Sistema',email:'admin@guardiapp.com',initials:'AD',sector:'—',clinic:'Todas'},
  supervisor:{name:'Laura Díaz',email:'ldiaz@clinica.com',initials:'LD',sector:'Todos los sectores',clinic:'Todas'},
  nurse:    {name:'N. Lombardo',email:'nlombardo@clinica.com',initials:'NL',sector:'POLI MAÑANA',clinic:'Setiembre'},

};

const EMPS=[
  {name:'K. ACOSTA',      clinic:'Setiembre',sector:'POLI MAÑANA', shift:'M',   hday:6,status:'lar',   g:11,extras:0,faltas:0},
  {name:'C. MAGALLANES',  clinic:'Setiembre',sector:'POLI MAÑANA', shift:'M',   hday:6,status:'lar',   g:12,extras:0,faltas:0},
  {name:'N. LOMBARDO',    clinic:'Setiembre',sector:'POLI MAÑANA', shift:'M',   hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'N. BORGES',      clinic:'Setiembre',sector:'POLI MAÑANA', shift:'M',   hday:6,status:'active',g:21,extras:0,faltas:1},
  {name:'M. LARRAMENDI',  clinic:'Setiembre',sector:'POLI TARDE',  shift:'TS',  hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'R. MACHADO',     clinic:'Setiembre',sector:'POLI TARDE',  shift:'TS',  hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'F. AMARO',       clinic:'Setiembre',sector:'POLI TARDE',  shift:'TS',  hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'E. DE SOUZA',    clinic:'Setiembre',sector:'POLI TARDE',  shift:'RS',  hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'R. PENA',        clinic:'Setiembre',sector:'ANEXO',       shift:'AXO', hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'G. CESAR',       clinic:'Setiembre',sector:'ANEXO',       shift:'AXO', hday:6,status:'active',g:21,extras:0,faltas:0},
  {name:'G. QUITADAMO',   clinic:'Setiembre',sector:'CPB',         shift:'CPB', hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'A. PEDROUZZO',   clinic:'Setiembre',sector:'CPB',         shift:'CPB', hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'N. OJEDA',       clinic:'Setiembre',sector:'CPB',         shift:'CPB', hday:6,status:'cert',  g:15,extras:0,faltas:0},
  {name:'D. LORENZO',     clinic:'Setiembre',sector:'CPB',         shift:'CPB', hday:6,status:'active',g:21,extras:0,faltas:0},
  {name:'R. GARCIA',      clinic:'Setiembre',sector:'OBSERVACIÓN', shift:'MO',  hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'M. PEREIRA',     clinic:'Setiembre',sector:'OBSERVACIÓN', shift:'ROT', hday:6,status:'active',g:24,extras:12,faltas:0},
  {name:'G. SANTA CRUZ',  clinic:'Setiembre',sector:'OBSERVACIÓN', shift:'VO',  hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'M. ISLAS',       clinic:'Setiembre',sector:'OBSERVACIÓN', shift:'NO',  hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'F. RODRIGUEZ',   clinic:'Setiembre',sector:'AMNP',        shift:'MU',  hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'L. MAGLIANO',    clinic:'Setiembre',sector:'AMNP',        shift:'TU',  hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'D. TITO',        clinic:'Setiembre',sector:'AMNP',        shift:'ROT', hday:6,status:'active',g:25,extras:6, faltas:0},
  {name:'N. TERAN',       clinic:'Setiembre',sector:'AMNP',        shift:'VU',  hday:6,status:'active',g:21,extras:0,faltas:0},
  {name:'L. FAGUNDEZ',    clinic:'Setiembre',sector:'ECONOMATO',   shift:'T',   hday:6,status:'absent',g:20,extras:0,faltas:1},
  {name:'J. BOLON',       clinic:'Setiembre',sector:'ECONOMATO',   shift:'M',   hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'F. CANTERO',     clinic:'Setiembre',sector:'ECONOMATO',   shift:'LAR', hday:6,status:'lar',   g:0, extras:0,faltas:0},
  {name:'L. PRIEU',       clinic:'Setiembre',sector:'PROGRAMAS',   shift:'M/T', hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'ME. CIBILS',     clinic:'Setiembre',sector:'PROGRAMAS',   shift:'MO',  hday:6,status:'active',g:21,extras:0,faltas:0},
  {name:'L. DOMINGUEZ',   clinic:'Setiembre',sector:'GINE SET',    shift:'GINE',hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'L. CORREA',      clinic:'Setiembre',sector:'GINE SET',    shift:'GINE',hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'V. LOZA',        clinic:'Setiembre',sector:'GINE SET',    shift:'GINE',hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'M. FERREIRO',    clinic:'Setiembre',sector:'GINE SET',    shift:'GINE',hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'R. SILVA',       clinic:'Carrasco', sector:'POLI MC',     shift:'MC',  hday:6,status:'active',g:22,extras:0,faltas:0},
  {name:'F. PERDOMO',     clinic:'Carrasco', sector:'POLI MC',     shift:'MC',  hday:6,status:'active',g:21,extras:0,faltas:0},
  {name:'V. GARCIA',      clinic:'Carrasco', sector:'URGENCIA C',  shift:'U1',  hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'T. MOREIRA',     clinic:'Carrasco', sector:'URGENCIA C',  shift:'U2',  hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'S. MENDEZ',      clinic:'Golf',     sector:'POLI GOLF',   shift:'MG',  hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'C. NUNEZ',       clinic:'Golf',     sector:'POLI GOLF',   shift:'MG',  hday:6,status:'active',g:20,extras:0,faltas:0},
  {name:'P. RIOS',        clinic:'Maldonado',sector:'MAL. MAÑANA', shift:'M',   hday:6,status:'active',g:21,extras:0,faltas:0},
  {name:'D. ACUNA',       clinic:'Maldonado',sector:'MAL. TARDE',  shift:'T',   hday:6,status:'active',g:21,extras:0,faltas:0},
];

const SUBS=[
  {name:'C. PEREZ',    sen:8,pct:98,comp:['URGENCIA','OBSERVACIÓN','ECONOMATO'],g:12,status:'available'},
  {name:'P. MORALES',  sen:5,pct:92,comp:['DOMICILIO','CPB'],g:9,status:'available'},
  {name:'D. BARRETO',  sen:3,pct:85,comp:['HORNEROS','DOMICILIO'],g:8,status:'on-shift'},
  {name:'V. MILA',     sen:2,pct:78,comp:['URGENCIA','DOMICILIO'],g:7,status:'available'},
  {name:'M. FERNANDEZ',sen:4,pct:88,comp:['DOMICILIO','CPB'],g:10,status:'available'},
  {name:'A. DENIS',    sen:1,pct:72,comp:['URGENCIA'],g:6,status:'available'},
  {name:'V. SAMURIO',  sen:3,pct:82,comp:['HORNEROS','CPB'],g:8,status:'on-shift'},
  {name:'L. PRIETO',   sen:2,pct:80,comp:['ECONOMATO','HORNEROS'],g:7,status:'available'},
  {name:'M. CABALLERO',sen:5,pct:90,comp:['HORNEROS','OBSERVACIÓN'],g:9,status:'available'},
];

const COV=[
  {name:'POLI MAÑANA',pct:95,n:4},{name:'POLI TARDE',pct:88,n:4},
  {name:'OBSERVACIÓN',pct:100,n:4},{name:'AMNP',pct:83,n:5},
  {name:'CPB',pct:75,n:4},{name:'ECONOMATO',pct:67,n:3},
  {name:'GINE SET',pct:100,n:4},{name:'HORNEROS',pct:100,n:2},
  {name:'PROGRAMAS',pct:100,n:2},
];

const SGRP=[
  {sector:'POLI MAÑANA',emps:['K. ACOSTA','C. MAGALLANES','N. LOMBARDO','N. BORGES']},
  {sector:'POLI TARDE', emps:['M. LARRAMENDI','R. MACHADO','F. AMARO','E. DE SOUZA']},
  {sector:'ANEXO',      emps:['R. PENA','G. CESAR']},
  {sector:'CPB',        emps:['G. QUITADAMO','A. PEDROUZZO','N. OJEDA','D. LORENZO']},
  {sector:'OBSERVACIÓN',emps:['R. GARCIA','M. PEREIRA','G. SANTA CRUZ','M. ISLAS']},
  {sector:'AMNP',       emps:['F. RODRIGUEZ','L. MAGLIANO','D. TITO','N. TERAN']},
  {sector:'ECONOMATO',  emps:['L. FAGUNDEZ','J. BOLON','F. CANTERO']},
];

const WK={
  'K. ACOSTA':    ['','LAR','','','LAR','','LAR'],
  'C. MAGALLANES':['','M','','','M','','M'],
  'N. LOMBARDO':  ['','M','LE','','M','','M'],
  'N. BORGES':    ['','M','M','','F','','M'],
  'M. LARRAMENDI':['','TS','E','','TS','','TS'],
  'R. MACHADO':   ['TO','TS','LE','','TS','','TS'],
  'F. AMARO':     ['','TS','U2','','TS','','TS'],
  'E. DE SOUZA':  ['','RS','','LE','RS','','RS'],
  'R. PENA':      ['','AXO','','','AXO','','AXO'],
  'G. CESAR':     ['','AXO','M','','AXO','','AXO'],
  'G. QUITADAMO': ['','CPB','LE','','CPB','','CPB'],
  'A. PEDROUZZO': ['','CPB','','','CPB','','CPB'],
  'N. OJEDA':     ['','CERT','LE','','LAR','','LAR'],
  'D. LORENZO':   ['','CPB','GINE','','CPB','','CPB'],
  'R. GARCIA':    ['','MO','MO','','MO','MO','MO'],
  'M. PEREIRA':   ['','TO','VU','TO','TO','Lx3','TO'],
  'G. SANTA CRUZ':['','LX1','VO','VO','VO','','VO'],
  'M. ISLAS':     ['NO','NO','NO','','NO','NO','NO'],
  'F. RODRIGUEZ': ['MU','MU','MU','MU','','MU','MU'],
  'L. MAGLIANO':  ['TU','TU','TU','LX1','TU','','TU'],
  'D. TITO':      ['','','TO','MO','MU','TU',''],
  'N. TERAN':     ['','VU','LE','','VU','','VU'],
  'L. FAGUNDEZ':  ['','F','','','T','','T'],
  'J. BOLON':     ['','M','','','M','','M'],
  'F. CANTERO':   ['','LAR','LAR','LAR','LAR','LAR','LAR'],
};

const MYSCHED={
  1:null,2:'M',3:'LE',4:null,5:'M',6:'M',7:'M',8:'M',9:'M',10:'M',
  11:null,12:'M',13:'M',14:'M',15:'M',16:'M',17:'M',18:null,19:'M',
  20:'M',21:'M',22:'M',23:'M',24:'M',25:'M',26:null,27:'M',28:'M',
  29:'M',30:'M',31:'M'
};

const DAB='LMMJVSD';
const WK_CODES=new Set(['M','MS','MC','MG','MO','MU','MD','T','TS','TC','TG','TO','TU','TD','RS','NO','NU','VO','VU','VD','CPB','GINE','AXO','H','AP','U1','U2','DOM','PSR','O','CG','CWM']);

// ........................................................
// UTILS
// ........................................................
let sb = null;
let dbLoaded = false;
let DB = { funcionarios:[], suplentes:[], funcionariosAll:[], suplentesAll:[], turnos:[], licencias:[], cambios:[], alertas:[], usuarios:[] };

let cRole='nurse', cUser=null, cWeek=0, cSF='all';

function shCls(code){
  if(!code) return '';
  const c=code.toUpperCase();
  if(['M','MS','MC','MG','MO','MU','MD','PSR'].includes(c)) return 'sM';
  if(['T','TS','TC','TG','TO','TU','TD','RS','O'].includes(c)) return 'sT';
  if(['NO','NU'].includes(c)) return 'sN';
  if(['VO','VU','VD'].includes(c)) return 'sV';
  if(c==='LAR') return 'sLAR';
  if(c==='CERT') return 'sCERT';
  if(['MAT','PAT'].includes(c)) return 'sCERT';
  if(c==='F') return 'sF';
  if(c==='LXC') return 'sLXC';
  if(['LE','LXE','LX1','LX3','Lx3','DXF','E'].includes(c)||c.startsWith('LX')||c.startsWith('Lx')) return 'sLE';
  if(['CPB','GINE','AXO','H','AP','DOM'].includes(c)) return 'sCPB';
  return 'sX';
}
function isW(c){return c&&WK_CODES.has(c.toUpperCase());}
function isWknd(d){return (3+d-1)%7>=5;}

// ........................................................
// LOGIN
// ........................................................
function selRole(r,el){
  cRole=r;
  document.querySelectorAll('.rb').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel');
  const em={admin:'admin@guardiapp.com',supervisor:'ldiaz@clinica.com',nurse:'nlombardo@clinica.com'};
  document.getElementById('lemail').value=em[r];
}

function doLogin(){
  cUser=DEMO[cRole];
  const ri=ROLES[cRole];
  document.getElementById('sRIcon').textContent=ri.icon;
  document.getElementById('sRName').textContent=ri.label;
  document.getElementById('sULine').textContent=cUser.sector;
  document.getElementById('sAv').textContent=cUser.initials;
  document.getElementById('sName').textContent=cUser.name;
  document.getElementById('sEmail').textContent=cUser.email;
  document.getElementById('topChip').innerHTML=`<span class="chip ${ri.chip}">${ri.label}</span>`;
  applyPerms();
  document.getElementById('ls').classList.add('gone');
  document.getElementById('app').classList.remove('gone');
  const first={admin:'dashboard',supervisor:'dashboard',nurse:'mySchedule'}[cRole]||'mySchedule';
  go(first);
  initAll();
  toast('ok',`Bienvenida, ${cUser.name}`,`Rol: ${ri.label} · ${cUser.clinic}`);
  const infra = window.GApp?.getLayer('infra');
  const features = window.GApp?.getLayer('features');
  setTimeout(()=>features?.initEJ?.(), 300);
  infra?.initSB?.();
  const loadPromise = infra?.loadDB ? infra.loadDB() : Promise.resolve();
  loadPromise.then(()=>{
    if(!dbLoaded) return;
    const dbU=DB.usuarios.find(u=>u.email===cUser.email);
    if(dbU?.funcionario){
      const f=dbU.funcionario;
      cUser.name=fNombre(f);
      cUser.sector=f.sector?.nombre||cUser.sector;
      const el=document.getElementById('sName');   if(el)  el.textContent=cUser.name;
      const el2=document.getElementById('sULine'); if(el2) el2.textContent=cUser.sector;
      const el3=document.getElementById('sAv');    if(el3) el3.textContent=(f.apellido[0]||'')+(f.nombre?.[0]||'?');
    }
    infra?.initRealtime?.();
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
  document.getElementById('topBtn').style.display=cRole==='nurse'?'none':'';
}

// ........................................................
// NAVIGATION
// ........................................................
const PTITLES={dashboard:'Dashboard General',schedule:'Planificación Mensual',mySchedule:'Mi Agenda Personal',employees:'Gestión de Funcionarios',licenses:'Licencias y Ausencias',trades:'Cambios de Turno',alerts:'Centro de Alertas',generation:'Generación Automática',hrReport:'Reporte RRHH',users:'Usuarios y Permisos'};

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
  if(id==='dashboard')   { renderCov(); renderDashAlerts(); }
  if(id==='employees')   { renderEmps(); renderSubs2(); }
  if(id==='licenses')    { renderLics(); renderLAR(); }
  if(id==='trades')      renderTrades();
  if(id==='alerts')      renderAlerts();
  if(id==='generation')  { renderGenHistory(); populateSendMes(); }
  if(id==='hrReport')    renderHR();
  if(id==='users')       renderUsers();
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

  // EMPS
  EMPS.length=0;
  DB.funcionarios.forEach(f=>{
    const ts=DB.turnos.filter(t=>t.funcionario_id===f.id);
    const g=ts.filter(t=>t.codigo&&!skip.has(t.codigo)).length;
    EMPS.push({name:fNombre(f), clinic:f.clinica?.nombre||'—', sector:f.sector?.nombre||'—',
      shift:f.turno_fijo||'M', hday:f.horas_dia||6, status:'active', id:f.id,
      g, extras:g>22?(g-22)*6:0, faltas:ts.filter(t=>t.codigo==='F').length});
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

  // SGRP - sector groups
  SGRP.length=0;
  const secMap={};
  DB.funcionarios.forEach(f=>{
    const s=f.sector?.nombre||'—';
    if(!secMap[s]) secMap[s]=[];
    secMap[s].push(fNombre(f));
  });
  const ord=['POLI MAÑANA','POLI TARDE','ANEXO','CPB','OBSERVACIÓN','AMNP','ECONOMATO',
             'PROGRAMAS','GINE SET','HORNEROS','DOMICILIO','APOYO','CARRASCO','GOLF','MALDONADO','A.PARK'];
  [...new Set([...ord,...Object.keys(secMap)])].forEach(s=>{
    if(secMap[s]?.length) SGRP.push({sector:s, emps:secMap[s]});
  });

  // COV - coverage per sector
  COV.length=0;
  const licNms=new Set(DB.licencias.filter(l=>l.estado==='activa').map(l=>l.funcionario?fNombre(l.funcionario):''));
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
      days:l.dias||Math.max(1,Math.round((new Date((l.fecha_hasta||'2026-01-01')+'T12:00:00')-new Date((l.fecha_desde||'2026-01-01')+'T12:00:00'))/86400000)+1),
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
  const userEmail=(cUser.email||'').toLowerCase();
  const userName=(cUser.name||'').toLowerCase();
  return allF.find(f=>
    (userEmail && f.email && f.email.toLowerCase()===userEmail) ||
    (userName && fNombre(f).toLowerCase()===userName) ||
    (userName && f.apellido && userName.includes(f.apellido.toLowerCase()))
  ) || null;
}


function initAll(){
  closeMobileNav();
  renderGenHistory();
  populateSendMes();
  renderCov();renderDashAlerts();renderEmps();renderSubs2();renderCompMat();
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
  ['smEmp','larEmp','licEmp','trdReceptor','uEmp'].forEach(id=>{
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
}

// ........................................................


