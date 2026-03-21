// SECURITY HELPERS
// ........................................................
// A03: HTML escape — apply to all user-controlled data inserted via innerHTML
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// DASHBOARD
// ........................................................
function renderCov(){
  // Delegado a _renderCovForMes via renderDashboard()
  if(typeof renderDashboard==='function') renderDashboard();
}

function renderDashAlerts(){
  const c=document.getElementById('dashAlerts');if(!c)return;
  const items=[];
  const skip=new Set(['LAR','CERT','LE','F','DXF','CPL','E','LX1','LX2','LX3','LX4','LXE','NO CONVOCAR','MAT','PAT']);

  if(dbLoaded){
    // 7ª guardia: verificar días CONSECUTIVOS (no total mensual)
    DB.funcionarios.forEach(f=>{
      const key='7g_'+f.id;
      if(DISMISSED_DASH.has(key)) return;
      const _hoy=new Date().toISOString().slice(0,10);
      const _desde=new Date(Date.now()-45*86400000).toISOString().slice(0,10);
      const _hace3=new Date(Date.now()-3*86400000).toISOString().slice(0,10);
      const wk=DB.turnos.filter(t=>t.funcionario_id===f.id&&t.codigo&&!skip.has(t.codigo)&&t.fecha>=_desde).map(t=>t.fecha).sort();
      let maxC=wk.length?1:0,cur=1,maxEnd=wk[0]||'';
      for(let i=1;i<wk.length;i++){
        const diff=Math.round((new Date(wk[i]+'T12:00:00')-new Date(wk[i-1]+'T12:00:00'))/86400000);
        cur=diff===1?cur+1:1;if(cur>maxC){maxC=cur;maxEnd=wk[i];}
      }
      if(maxC>=7&&maxEnd>=_hace3){
        items.push({
          key, cls:'cr2',ic:'🚨',
          t:`7ª Guardia consecutiva — ${esc(fNombre(f))} (${esc(f.sector?.nombre||'')})`,
          d:`${maxC} días seguidos sin descanso · genera horas extra obligatorias`,
          m:esc(f.clinica?.nombre||''),
          btn:`<button class="btn bp xs" style="flex-shrink:0" onclick="go('alerts')">Ver</button>`,
        });
      }
    });

    // Vacantes sin cubrir — agrupadas en una sola alerta
    if(!DISMISSED_DASH.has('vac')){
      const hoy=new Date().toISOString().slice(0,10);
      const _planKeys=new Set((GENS||[]).map(g=>getGeneratedMonthKey(g)).filter(Boolean));
      const vacSinCubrir=DB.licencias.filter(l=>{
        if(!l.genera_vacante||l.suplente_id||!['activa','pendiente'].includes(l.estado)) return false;
        if((l.fecha_hasta||'')<hoy) return false;
        if(_planKeys.size===0) return true;
        const licMes=(l.fecha_desde||'').slice(0,7);
        const activa=l.fecha_desde<=hoy&&l.fecha_hasta>=hoy;
        return activa||_planKeys.has(licMes);
      });
      if(vacSinCubrir.length){
        items.push({
          key:'vac', cls:'wa',ic:'⚠️',
          t:`${vacSinCubrir.length} vacante${vacSinCubrir.length>1?'s':''} sin cubrir`,
          d:vacSinCubrir.slice(0,2).map(l=>`${l.funcionario?esc(fNombre(l.funcionario)):'—'} · ${esc(l.tipo)}`).join(' · '),
          m:'Sin suplente asignado',
          btn:`<button class="btn bp xs" style="flex-shrink:0" onclick="go('licenses')">Asignar</button>`,
        });
      }
    }

    // Cambios que requieren aprobación supervisor (aceptado por receptor)
    if(!DISMISSED_DASH.has('chg')){
      const myFuncId=String(getCurrFuncionario()?.id||'');
      let pendCambios=[];
      if(['admin','supervisor'].includes(cRole)){
        pendCambios=DB.cambios.filter(x=>x.estado==='aceptado_receptor');
      } else {
        pendCambios=DB.cambios.filter(x=>x.estado==='pendiente'&&String(x.receptor_id||'')===myFuncId);
      }
      if(pendCambios.length){
        items.push({
          key:'chg', cls:'in', ic:'🔄',
          t:`${pendCambios.length} cambio${pendCambios.length>1?'s':''} pendiente${pendCambios.length>1?'s':''}`,
          d:pendCambios.slice(0,2).map(x=>`${x.solicitante?esc(fNombre(x.solicitante)):'—'} — ${x.receptor?esc(fNombre(x.receptor)):'—'}`).join(' · '),
          m:['admin','supervisor'].includes(cRole)?'Requieren tu aprobación':'Te proponen un intercambio',
          btn:`<button class="btn bp xs" style="flex-shrink:0" onclick="go('trades')">Ver</button>`,
        });
      }
    }
  }

  if(!items.length){
    c.innerHTML=`
      <div class="ai in"><span style="font-size:17px;flex-shrink:0">ℹ️</span><div><div class="ai-t">Sin alertas críticas activas</div><div class="ai-d">No hay pendientes urgentes para supervisión.</div><div class="ai-m">${dbLoaded?'Actualizado desde BD':'Modo demo'}</div></div></div>
    `;
  }else{
    c.innerHTML=items.slice(0,3).map(a=>`
      <div class="ai ${a.cls}" id="dai_${a.key}">
        <span style="font-size:17px;flex-shrink:0">${a.ic}</span>
        <div style="flex:1">
          <div class="ai-t">${a.t}</div>
          <div class="ai-d">${a.d}</div>
          <div class="ai-m">${a.m}</div>
        </div>
        ${a.btn||''}
        <button class="t-x" style="align-self:flex-start;margin-left:4px" onclick="dismissDashAlert('${a.key}')" title="Descartar">✕</button>
      </div>
    `).join('');
  }

  const _an=document.getElementById('dashAlertNum');
  if(_an) _an.textContent=String(items.length);
}

// ── Estado global del mes seleccionado en el dashboard ──
let DASH_MES = (()=>{ const n=new Date(); return {year:n.getFullYear(),month:n.getMonth()}; })();

// Inicializa o refresca todo el dashboard (selector + todas las secciones)
function renderDashboard(){
  if(!dbLoaded) return;
  const el=id=>document.getElementById(id);

  // Construir lista de meses disponibles desde GENS
  const genKeys=(GENS||[]).map(g=>getGeneratedMonthKey(g)).filter(Boolean).sort();
  const _n=new Date();
  const todayKey=`${_n.getFullYear()}-${String(_n.getMonth()+1).padStart(2,'0')}`;

  // Si hay meses generados usar el último; si no, usar mes actual
  if(genKeys.length){
    const curKey=`${DASH_MES.year}-${String(DASH_MES.month+1).padStart(2,'0')}`;
    const selKey=genKeys.includes(curKey)?curKey:genKeys[genKeys.length-1];
    DASH_MES={year:parseInt(selKey.slice(0,4)),month:parseInt(selKey.slice(5,7))-1};
  } else {
    DASH_MES={year:_n.getFullYear(),month:_n.getMonth()};
  }

  // Poblar selector
  const sel=el('dashMesSel');
  const lbl=el('dashMesLabel');
  if(sel && genKeys.length){
    const selKey=`${DASH_MES.year}-${String(DASH_MES.month+1).padStart(2,'0')}`;
    sel.innerHTML=genKeys.map(k=>`<option value="${k}">${ymLabelFromKey(k)?.label||k}</option>`).join('');
    sel.value=selKey;
    sel.style.display='';
    if(lbl) lbl.style.display='none';
  } else if(sel){
    sel.style.display='none';
    if(lbl){ lbl.textContent=`${getMonthLabel(DASH_MES.year,DASH_MES.month)} (sin generación)`; lbl.style.display=''; }
  }

  _renderDashForMes(DASH_MES.year, DASH_MES.month);
}

function onDashMesChange(key){
  if(!key) return;
  DASH_MES={year:parseInt(key.slice(0,4)),month:parseInt(key.slice(5,7))-1};
  _renderDashForMes(DASH_MES.year, DASH_MES.month);
}

function _renderDashForMes(year, month){
  const el=id=>document.getElementById(id);
  const mesLabel=getMonthLabel(year,month);
  const m2=String(month+1).padStart(2,'0');
  const mesFrom=`${year}-${m2}-01`;
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const mesTo=`${year}-${m2}-${String(daysInMonth).padStart(2,'0')}`;

  // Stat cards
  const fijos=DB.funcionarios.filter(f=>f.activo!==false).length;
  const sups=DB.suplentes.filter(s=>s.activo!==false).length;
  const total=fijos+sups;
  el('dashFuncNum')&&(el('dashFuncNum').textContent=String(total));
  el('dashFuncSub')&&(el('dashFuncSub').textContent=`${fijos} fijos · ${sups} suplentes`);

  // Cobertura: funcionarios SIN licencia activa en el mes
  const onLicMes=new Set(DB.licencias.filter(l=>
    ['activa','pendiente'].includes(l.estado)&&(l.fecha_hasta||'')>=mesFrom&&(l.fecha_desde||'')<=mesTo
  ).map(l=>l.funcionario_id));
  const present=total-onLicMes.size;
  const pct=total?Math.round(present/total*100):100;
  const col=pct>=90?'var(--green)':pct>=75?'var(--amber)':'var(--red)';
  el('dashCovLbl')&&(el('dashCovLbl').textContent=`Cobertura — ${mesLabel}`);
  const pctEl=el('dashCovPct'); if(pctEl){pctEl.textContent=`${pct}%`;pctEl.style.color=col;}
  el('dashCovSl')&&(el('dashCovSl').style.background=col);
  el('dashCovSub')&&(el('dashCovSub').textContent=`${present}/${total} sin licencia activa`);

  // Licencias del mes
  const licsMes=DB.licencias.filter(l=>
    ['activa','pendiente'].includes(l.estado)&&(l.fecha_hasta||'')>=mesFrom&&(l.fecha_desde||'')<=mesTo
  );
  el('dashLicLbl')&&(el('dashLicLbl').textContent=`Licencias — ${mesLabel}`);
  el('dashLicNum')&&(el('dashLicNum').textContent=String(licsMes.length));
  const byTipo={};
  licsMes.forEach(l=>{byTipo[l.tipo]=(byTipo[l.tipo]||0)+1;});
  el('dashLicSub')&&(el('dashLicSub').textContent=Object.entries(byTipo).map(([k,v])=>`${v} ${k}`).join(' · ')||'Sin licencias en el mes');

  // Cobertura por sector — recalcular para el mes
  _renderCovForMes(mesFrom, mesTo, mesLabel);

  // KPIs
  el('dashKpiTitle')&&(el('dashKpiTitle').textContent=`KPIs — ${mesLabel}`);
  renderDashKPIs(year, month);
}

function _renderCovForMes(mesFrom, mesTo, mesLabel){
  const g=document.getElementById('covGrid'); if(!g) return;
  const t=document.getElementById('dashCovSecTitle');
  if(t) t.textContent=`Cobertura por Sector — ${mesLabel}`;

  // Funcionarios con licencia en el mes por sector
  const onLicIds=new Set(DB.licencias.filter(l=>
    ['activa','pendiente'].includes(l.estado)&&(l.fecha_hasta||'')>=mesFrom&&(l.fecha_desde||'')<=mesTo
  ).map(l=>l.funcionario_id));

  // Usar SGRP (ya construido en core-layer) para tener los grupos de sector
  if(!SGRP.length){ g.innerHTML='<div style="color:var(--t3);font-size:12px">Sin datos de sectores</div>'; return; }
  g.innerHTML=SGRP.map(gr=>{
    const tot=gr.emps.length;
    // Mapear nombres a ids
    const funcIds=DB.funcionarios.filter(f=>gr.emps.includes(fNombre(f))).map(f=>f.id);
    const absent=funcIds.filter(id=>onLicIds.has(id)).length;
    const act=tot-absent;
    const pct=tot?Math.round(act/tot*100):100;
    const cl=pct>=90?'pbg':pct>=75?'pba':'pbr';
    const tc=pct>=90?'var(--green)':pct>=75?'var(--amber)':'var(--red)';
    return `<div class="cvc"><div class="cvn">${esc(gr.sector)}</div><div class="pw"><div class="pb ${cl}" style="width:${pct}%"></div></div><div class="cvm"><span>${tot} enf.</span><span style="color:${tc}">${pct}%</span></div></div>`;
  }).join('');
}

function renderDashKPIs(year, month){
  const grid=document.getElementById('dashKpiGrid'); if(!grid) return;
  if(!dbLoaded){ return; }

  const skip=new Set(['LAR','CERT','LE','F','DXF','CPL','E','LX1','LX2','LX3','LX4','LXE','NO CONVOCAR','MAT','PAT']);
  const m2=String(month+1).padStart(2,'0');
  const mesFrom=`${year}-${m2}-01`;
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const mesTo=`${year}-${m2}-${String(daysInMonth).padStart(2,'0')}`;
  const fijos=DB.funcionarios.filter(f=>f.activo!==false);
  const nFijos=fijos.length||1;

  // ── 1. Cumplimiento de planilla ──────────────────────────────
  // % funcionarios fijos con al menos un turno de trabajo asignado este mes
  const conTurno=new Set(
    DB.turnos.filter(t=>t.fecha>=mesFrom&&t.fecha<=mesTo&&isW(t.codigo)).map(t=>t.funcionario_id)
  );
  const cumplCount=fijos.filter(f=>conTurno.has(f.id)).length;
  const cumplPct=Math.round(cumplCount/nFijos*100);
  const cumplCol=cumplPct>=90?'var(--green)':cumplPct>=70?'var(--amber)':'var(--red)';
  const cumplBar=cumplPct>=90?'pbg':cumplPct>=70?'pba':'pbr';

  // ── 2. Horas Extra (7ª guardia) ──────────────────────────────
  // Calcular guardias consecutivas por funcionario este mes
  let totalExtraGuardias=0;
  const extraNombres=[];
  fijos.forEach(f=>{
    const dias=DB.turnos
      .filter(t=>t.funcionario_id===f.id&&t.fecha>=mesFrom&&t.fecha<=mesTo&&isW(t.codigo))
      .map(t=>t.fecha).sort();
    let maxC=dias.length?1:0, cur=1;
    for(let i=1;i<dias.length;i++){
      const diff=Math.round((new Date(dias[i]+'T12:00:00')-new Date(dias[i-1]+'T12:00:00'))/86400000);
      cur=diff===1?cur+1:1; if(cur>maxC)maxC=cur;
    }
    const extra=Math.max(0,maxC-6);
    if(extra>0){ totalExtraGuardias+=extra; extraNombres.push(`${f.apellido}`); }
  });
  const totalExtraHs=totalExtraGuardias*8; // aprox 8hs por guardia extra
  const extraPct=Math.min(100,Math.round(totalExtraHs/400*100)); // escala: 400hs max visual
  const extraSub=extraNombres.length
    ? extraNombres.slice(0,3).join(' · ')+(extraNombres.length>3?` · +${extraNombres.length-3} más`:'')
    : 'Sin horas extra este mes';

  // ── 3. Tasa Ausentismo ───────────────────────────────────────
  // Días de licencia activos este mes / total días laborables esperados
  const licsDelMes=DB.licencias.filter(l=>
    !skip.has(l.tipo||'') && ['activa','pendiente'].includes(l.estado||'') &&
    (l.fecha_hasta||'')>=mesFrom && (l.fecha_desde||'')<=mesTo
  );
  let totalDiasLic=0;
  licsDelMes.forEach(l=>{
    const from=new Date(Math.max(new Date(l.fecha_desde+'T12:00:00'),new Date(mesFrom+'T12:00:00')));
    const to=new Date(Math.min(new Date(l.fecha_hasta+'T12:00:00'),new Date(mesTo+'T12:00:00')));
    totalDiasLic+=Math.max(0,Math.round((to-from)/86400000)+1);
  });
  const totalEsperados=daysInMonth*nFijos||1;
  const ausPct=Math.min(100,Math.round(totalDiasLic/totalEsperados*100*10)/10);
  const ausCol=ausPct<=3?'var(--green)':ausPct<=8?'var(--amber)':'var(--red)';
  const ausBar=ausPct<=3?'pbg':ausPct<=8?'pba':'pbr';
  const ausBarW=Math.min(100,ausPct*5); // escala: 20% = barra llena

  grid.innerHTML=`
    <div class="card"><div class="cb">
      <div class="slbl">Cumplimiento Planilla</div>
      <div style="font-family:var(--ff-display);font-weight:800;font-size:22px;color:${cumplCol}">${cumplPct}%</div>
      <div class="pw"><div class="pb ${cumplBar}" style="width:${cumplPct}%"></div></div>
      <div class="ssub" style="margin-top:5px">${cumplCount}/${nFijos} fijos con turno asignado</div>
    </div></div>
    <div class="card"><div class="cb">
      <div class="slbl">Horas Extra (7ª guardia)</div>
      <div style="font-family:var(--ff-display);font-weight:800;font-size:22px;color:var(--amber)">${totalExtraHs} hs</div>
      <div class="pw"><div class="pb pba" style="width:${extraPct}%"></div></div>
      <div class="ssub" style="margin-top:5px">${extraSub}</div>
    </div></div>
    <div class="card"><div class="cb">
      <div class="slbl">Tasa Ausentismo</div>
      <div style="font-family:var(--ff-display);font-weight:800;font-size:22px;color:${ausCol}">${ausPct}%</div>
      <div class="pw"><div class="pb ${ausBar}" style="width:${ausBarW}%"></div></div>
      <div class="ssub" style="margin-top:5px">${totalDiasLic} días lic. · ${licsDelMes.length} licencia${licsDelMes.length!==1?'s':''} activa${licsDelMes.length!==1?'s':''}</div>
    </div></div>`;
}

// ........................................................
// CALENDAR
// ........................................................
let SCHED_CTX = (()=>{const _n=new Date();return{year:_n.getFullYear(),month:_n.getMonth()};})(); // month: 0-11

function getAvailableMonthsGlobal(){
  const seen=new Set();
  const out=[];
  const push=(y,m)=>{
    const key=`${y}-${m}`;
    if(seen.has(key)) return;
    seen.add(key);
    out.push({year:y,month:m,label:getMonthLabel(y,m)});
  };
  // Solo meses de generaciones aprobadas
  (GENS||[]).filter(g=>g.estado==='aprobada').forEach(g=>{
    if(g.anio && Number.isInteger(g.mesNum)) push(g.anio,g.mesNum-1);
    else{ const p=parseMesLabel(g.mes); if(p) push(p.year,p.month); }
  });
  // Meses con turnos en DB que NO tienen generación — entradas manuales
  // Usar getGeneratedMonthKey que ya tiene fallback parseMesLabel (clave: "yyyy-MM" 1-indexed)
  // Convertir a formato "yyyy-m" 0-indexed para comparar con getUTCMonth()
  const genKeys=new Set((GENS||[]).map(g=>{
    const k=getGeneratedMonthKey(g); if(!k) return null;
    const [y,mm]=k.split('-').map(Number);
    return `${y}-${mm-1}`;
  }).filter(Boolean));
  (DB.turnos||[]).forEach(t=>{
    const d=new Date(`${t.fecha}T12:00:00`);
    if(Number.isNaN(d.getTime())) return;
    const y=d.getUTCFullYear(), m=d.getUTCMonth();
    if(!genKeys.has(`${y}-${m}`)) push(y,m); // solo si no hay generación para ese mes
  });
  if(!out.length){const _n=new Date();push(_n.getFullYear(),_n.getMonth());}
  out.sort((a,b)=>a.year===b.year ? a.month-b.month : a.year-b.year);
  return out;
}

function getMonthMeta(year,month){
  const firstDow=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7; // lunes=0
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const weeks=Math.ceil((firstDow+daysInMonth)/7);
  return {firstDow,daysInMonth,weeks};
}

function ensureScheduleMonthSel(){
  const sel=document.getElementById('schedMesSel');
  if(!sel) return;
  const months=getAvailableMonthsGlobal();
  const hasCtx=months.some(m=>m.year===SCHED_CTX.year&&m.month===SCHED_CTX.month);
  if(!hasCtx){
    const last=months[months.length-1];
    SCHED_CTX={year:last.year,month:last.month};
    cWeek=0;
  }
  const curVal=`${SCHED_CTX.year}-${String(SCHED_CTX.month+1).padStart(2,'0')}`;
  sel.innerHTML=months.map(m=>{
    const v=`${m.year}-${String(m.month+1).padStart(2,'0')}`;
    return `<option value="${v}" ${v===curVal?'selected':''}>${m.label}</option>`;
  }).join('');
}

function onSchedMonthChange(val){
  const m=String(val||'').match(/^(\d{4})-(\d{2})$/);
  if(!m) return;
  SCHED_CTX={year:parseInt(m[1],10),month:parseInt(m[2],10)-1};
  cWeek=0;
  renderCal();
}

function chW(d){
  const meta=getMonthMeta(SCHED_CTX.year,SCHED_CTX.month);
  cWeek=Math.max(0,Math.min(meta.weeks-1,cWeek+d));
  renderCal();
}
function setSF(btn,s){cSF=s;renderCal();}   // legacy
function setSFSel(val){cSF=val||'all';renderCal();}
function isMobileSchedule(){ return window.matchMedia('(max-width: 700px)').matches; }

function getCambioSideName(c, side){
  if(side==='sol'){
    if(c.solicitante) return fNombre(c.solicitante);
    return getNameByFuncionarioId(c.solicitante_id)||'';
  }
  if(c.receptor) return fNombre(c.receptor);
  return getNameByFuncionarioId(c.receptor_id)||'';
}

function daysBetween(refStr,dateStr){
  return Math.round((new Date(dateStr+'T12:00:00')-new Date(refStr+'T12:00:00'))/86400000);
}

function isWorkDay(patron,cicloRef,dateStr){
  const wd=(new Date(dateStr+'T12:00:00').getUTCDay()+6)%7; // 0=Lun,6=Dom
  if(patron==='4x1'){
    if(!cicloRef) return wd<5;
    const off=((daysBetween(cicloRef,dateStr)%5)+5)%5;
    return off<4;
  }
  if(patron==='6x1'){
    if(!cicloRef) return wd<6;
    const off=((daysBetween(cicloRef,dateStr)%7)+7)%7;
    return off<6;
  }
  if(patron==='LS') return wd<6;
  if(patron==='SD') return wd>=5;
  if(patron==='36H') return true;
  return wd<5; // LV default
}

function getLicenciaCodeForDate(empId,dateStr){
  if(!empId || !dbLoaded) return null;
  const d = new Date(`${dateStr}T12:00:00`);
  if(Number.isNaN(d.getTime())) return null;
  const order = ['MAT','PAT','LAR','CERT','LE','F','DXF','CPL'];
  const rows = (DB.licencias||[]).filter(l=>{
    if(String(l.funcionario_id)!==String(empId)) return false;
    if(!['activa','pendiente'].includes(String(l.estado||''))) return false;
    const from = new Date(`${l.fecha_desde}T12:00:00`);
    const to = new Date(`${(l.fecha_hasta||l.fecha_desde)}T12:00:00`);
    if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())) return false;
    return d>=from && d<=to;
  });
  if(!rows.length) return null;
  rows.sort((a,b)=>{
    const ia=order.indexOf(String(a.tipo||'').toUpperCase());
    const ib=order.indexOf(String(b.tipo||'').toUpperCase());
    return (ia<0?999:ia)-(ib<0?999:ib);
  });
  const r=rows[0];
  const code=String(r.tipo||'').toUpperCase();
  return {code, title:`Licencia ${code}`};
}

function getApprovedTradeOverride(empName,dateStr){
  const ap=(DB.cambios||[]).filter(c=>c.estado==='aprobado');
  for(const c of ap){
    const sol=getCambioSideName(c,'sol');
    const rec=getCambioSideName(c,'rec');
    if(sol===empName && (c.fecha_cede||'')===dateStr){
      return {code:'LXC', title:`Cambio cedido a ${rec}`};
    }
    if(rec===empName && (c.fecha_recibe||'')===dateStr){
      return {code:'LXC', title:`Cambio cedido a ${sol}`};
    }
    if(sol===empName && (c.fecha_recibe||'')===dateStr && c.turno_recibe){
      return {code:c.turno_recibe, title:`Recibe turno de ${rec}`};
    }
    if(rec===empName && (c.fecha_cede||'')===dateStr && c.turno_cede){
      return {code:c.turno_cede, title:`Recibe turno de ${sol}`};
    }
  }
  return null;
}

function renderCal(){
  ensureScheduleMonthSel();
  const {year,month}=SCHED_CTX;
  // Show borrador banner
  const gen=GENS.find(g=>g.anio===year&&g.mesNum===month+1);
  const banner=document.getElementById('schedBanner');
  if(banner){
    if(gen?.estado==='borrador'){
      banner.style.display='block';
      banner.innerHTML=`<div style="background:var(--adim);border:1px solid rgba(245,166,35,.3);border-radius:var(--r);padding:10px 14px;font-size:11px;color:var(--amber);display:flex;align-items:center;gap:10px">⚠ Planilla de <strong>${gen.mes}</strong> en borrador — pendiente de validación. <button class="btn ba xs" style="margin-left:auto" onclick="go('generation')">Ir a Validar</button></div>`;
    }else{ banner.style.display='none'; banner.innerHTML=''; }
  }
  const meta=getMonthMeta(year,month);
  cWeek=Math.max(0,Math.min(meta.weeks-1,cWeek));
  const startIdx=cWeek*7;
  const cells=[];
  for(let i=0;i<7;i++){
    const idx=startIdx+i;
    const d=idx-meta.firstDow+1;
    cells.push({day:d,valid:d>=1&&d<=meta.daysInMonth,wk:i>=5,col:i});
  }
  const validDays=cells.filter(c=>c.valid).map(c=>c.day);
  const rng=validDays.length?`${Math.min(...validDays)} al ${Math.max(...validDays)}`:'Sin días';
  document.getElementById('weekLbl').textContent=`Semana ${cWeek+1} — ${rng} ${getMonthLabel(year,month)}`;
  const tbl=document.getElementById('calTbl');
  const mob=document.getElementById('calMobile');
  if(!SGRP.length){
    if(tbl) tbl.innerHTML='<thead></thead><tbody><tr><td colspan="8" style="color:var(--t3);padding:30px;text-align:center">Cargando planificación...</td></tr></tbody>';
    if(mob) mob.innerHTML='<div style="color:var(--t3);padding:20px;text-align:center">Cargando planificación...</div>';
    return;
  }
  const grps=cSF==='all'?SGRP:SGRP.filter(g=>g.sector===cSF);
  const resolveCodeForDay=(emp,empId,d,dateStr,wd)=>{
    let code=getShiftChange(emp,dateStr);
    if(!code){
      if(empId && dbLoaded) code=getTurnoFecha(empId,dateStr);
      if(!code){
        const sc=WK[emp]||[];
        code=sc[wd];
      }
    }
    const ov=getApprovedTradeOverride(emp,dateStr);
    if(ov?.code) code=ov.code;
    const licOv=getLicenciaCodeForDate(empId,dateStr);
    if(licOv?.code) code=licOv.code;
    return {code, ov, licOv};
  };

  if(isMobileSchedule()){
    if(tbl) tbl.parentElement.style.display='none';
    if(mob) mob.classList.remove('gone');
    let mh='';
    grps.forEach(grp=>{
      mh+=`<div class="msec">${grp.sector}</div>`;
      grp.emps.forEach(emp=>{
        const empRec=EMPS.find(e=>e.name===emp);
        const empId=empRec?.id||null;
        // Detectar días con 7+ guardias consecutivas (NO total del mes)
        let consec=0; const badDaysMob=new Set();
        for(let d=1;d<=meta.daysInMonth;d++){
          const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const wd=(new Date(Date.UTC(year,month,d)).getUTCDay()+6)%7;
          const {code}=resolveCodeForDay(emp,empId,d,dateStr,wd);
          if(isW(code)){ consec++; if(consec>=7) badDaysMob.add(d); } else consec=0;
        }
        const is7=badDaysMob.size>0;
        const ed=EMPS.find(e=>e.name===emp);
        const dc=ed?.status==='absent'?'dr2':ed?.status==='lar'?'da':'dg';
        mh+=`<div class="mcard">
          <div class="mhead"><span><span class="dot ${dc}"></span>${emp}</span>${is7?'<span class="chip cr" title="7ª guardia consecutiva — requiere cobertura">7ª</span>':''}</div>
          <div class="mdays">`;
        cells.forEach(c=>{
          if(!c.valid){ mh+='<button class="mday off" disabled>—</button>'; return; }
          const d=c.day;
          const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const wd=c.col;
          const {code,ov,licOv}=resolveCodeForDay(emp,empId,d,dateStr,wd);
          const cls=badDaysMob.has(d)&&code&&isW(code)?'s7':shCls(code);
          const tip=licOv?.title||ov?.title||'';
          mh+=`<button class="mday ${c.wk?'wk':''}" onclick="editC('${emp}',${d},'${code||''}')">
            <span class="mab">${DAB[c.col]}</span>
            <span class="mnum">${d}</span>
            ${code?`<span class="sh ${cls}" title="${tip}">${code}</span>`:'<span class="mempty2">—</span>'}
          </button>`;
        });
        mh+='</div></div>';
      });
    });
    if(mob) mob.innerHTML=mh || '<div style="color:var(--t3);padding:20px;text-align:center">Sin datos</div>';
    return;
  }else{
    if(tbl) tbl.parentElement.style.display='';
    if(mob){ mob.classList.add('gone'); mob.innerHTML=''; }
  }

  let html='<thead><tr><th class="thn">Sector / Funcionario</th>';
  cells.forEach(c=>{const ab=DAB[c.col];html+=`<th class="${c.wk?'thw':''}"><div style="font-size:9px">${ab}</div><div style="font-family:var(--ff-mono);font-size:12px;font-weight:600">${c.valid?c.day:'—'}</div></th>`;});
  html+='</tr></thead><tbody>';
  grps.forEach(grp=>{
    html+=`<tr class="csr"><td colspan="${cells.length+1}">${grp.sector}</td></tr>`;
    grp.emps.forEach(emp=>{
      const empRec=EMPS.find(e=>e.name===emp);
      const empId=empRec?.id||null;
      let consec=0; const badDays=new Set();
      for(let d=1;d<=meta.daysInMonth;d++){
        const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const wd=(new Date(Date.UTC(year,month,d)).getUTCDay()+6)%7;
        const {code}=resolveCodeForDay(emp,empId,d,dateStr,wd);
        if(isW(code)){ consec++; if(consec>=7) badDays.add(d); } else consec=0;
      }
      const is7=badDays.size>0;
      const ed=EMPS.find(e=>e.name===emp);
      const dc=ed?.status==='absent'?'dr2':ed?.status==='lar'?'da':'dg';
      html+=`<tr class="cnr"><td class="cnm"><span class="dot ${dc}"></span>${emp}${is7?' <span class="chip cr" style="font-size:9px" title="7ª guardia consecutiva — requiere cobertura">7ª!</span>':''}</td>`;
      cells.forEach(c=>{
        if(!c.valid){ html+='<td class="ccc" style="opacity:.5"></td>'; return; }
        const d=c.day;
        const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const wd=c.col;
        const {code,ov,licOv}=resolveCodeForDay(emp,empId,d,dateStr,wd);
        const wk=c.wk;
        const cls=badDays.has(d)&&code&&isW(code)?'s7':shCls(code);
        const isTradeApproved = !!ov && !licOv;
        const tip = licOv?.title || ov?.title || '';
        html+=`<td class="ccc${wk?' ccw':''}${isTradeApproved?' cctrd':''}" onclick="editC('${emp}',${d},'${code||''}')">`;
        if(code) html+=`<span class="sh ${cls}${isTradeApproved?' sTRD':''}" title="${tip}">${code}</span>`;
        if(!code && isTradeApproved) html+=`<span class="sh sTRD" title="${tip||'Cambio aprobado'}">↺</span>`;
        html+='</td>';
      });
      html+='</tr>';
    });
  });
  html+='</tbody>';
  tbl.innerHTML=html;
}

function editC(emp,day,code){
  document.getElementById('smEmp').value=emp;
  if(code && code!=='LXC') document.getElementById('smCode').value=code;
  const fd=document.getElementById('smFecha');
  if(fd) fd.value=`${SCHED_CTX.year}-${String(SCHED_CTX.month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  openM('shiftM');
}

// ........................................................
// MY SCHEDULE — diferenciada por rol
// ........................................................

const MY_MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];
let MY_AGENDA_CTX = (()=>{const _n=new Date();return{year:_n.getFullYear(),month:_n.getMonth()};})(); // month: 0-11
let TRADE_CTX = {selectedDate:'', myCode:'', candidates:[], selectedIdx:-1, showUnavailable:false};

function getMonthLabel(year, month){
  return `${MY_MONTHS_ES[month]} ${year}`;
}

function parseMesLabel(label){
  if(!label) return null;
  const m = String(label).trim().match(/^([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\s+(\d{4})$/);
  if(!m) return null;
  const idx = MY_MONTHS_ES.findIndex(x=>x.toLowerCase()===m[1].toLowerCase());
  if(idx<0) return null;
  return {year:parseInt(m[2],10), month:idx};
}

function nTxt(v){
  return String(v||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().trim();
}

function getMyAvailableMonths(empId){
  const seen = new Set();
  const months = [];
  const pushMonth = (y,m)=>{
    const key=`${y}-${m}`;
    if(seen.has(key)) return;
    seen.add(key);
    months.push({year:y,month:m,label:getMonthLabel(y,m)});
  };

  // Meses "aprobados" del flujo de generación
  (GENS||[]).filter(g=>g.estado==='aprobada').forEach(g=>{
    if(g.anio && Number.isInteger(g.mesNum)) pushMonth(g.anio, g.mesNum-1);
    else{
      const p=parseMesLabel(g.mes);
      if(p) pushMonth(p.year,p.month);
    }
  });

  // Meses con turnos del funcionario en BD (fuente de verdad)
  if(empId && DB.turnos.length){
    DB.turnos.filter(t=>t.funcionario_id===empId).forEach(t=>{
      const d = new Date(`${t.fecha}T12:00:00`);
      if(!Number.isNaN(d.getTime())) pushMonth(d.getUTCFullYear(), d.getUTCMonth());
    });
  }

  if(!months.length){const _n=new Date();pushMonth(_n.getFullYear(),_n.getMonth());}
  months.sort((a,b)=> a.year===b.year ? a.month-b.month : a.year-b.year);
  return months;
}

// Build schedule map {day: code} for funcionario in selected year/month
function getUserSched(empId, year=new Date().getFullYear(), month=new Date().getMonth()){
  if(!empId) return {};
  const sched = {};
  DB.turnos.filter(t=>t.funcionario_id===empId).forEach(t=>{
    const d=new Date(`${t.fecha}T12:00:00`);
    if(Number.isNaN(d.getTime())) return;
    if(d.getUTCFullYear()===year && d.getUTCMonth()===month){
      sched[d.getUTCDate()]=t.codigo;
    }
  });
  return sched;
}

function getDemoSchedForName(name, year=new Date().getFullYear(), month=new Date().getMonth()){
  if(!WK[name]) return {};
  // Demo weekly pattern repeated across month
  const base = WK[name] || [];
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const out={};
  for(let d=1; d<=daysInMonth; d++){
    const c = base[(d-1)%7];
    if(c) out[d]=c;
  }
  return out;
}

function getNameByFuncionarioId(id){
  if(!id) return null;
  const all=[...DB.funcionarios,...DB.suplentes];
  const f=all.find(x=>String(x.id)===String(id));
  return f ? fNombre(f) : null;
}

function candidateStatusForCode(code, myCode){
  const c=(code||'').toUpperCase();
  const mine=(myCode||'').toUpperCase();
  if(!c) return {available:false, label:'Sin turno', chip:'cn'};
  if(['LAR','CERT','F','LE','DXF','CPL','MAT','PAT'].includes(c)) return {available:false, label:c, chip:'cr'};
  if(!isW(c)) return {available:false, label:c, chip:'cn'};
  if(c===mine) return {available:false, label:'Mismo turno', chip:'ca'};
  return {available:true, label:`Disponible (${c})`, chip:'cg'};
}

function dedupeCandidates(rows){
  const map=new Map();
  rows.forEach(r=>{
    // Prefer business identity over DB id because migrated data can have duplicated people with different ids.
    const bizKey = `nm:${nTxt(r.name)}|cl:${nTxt(r.clinic)}|sec:${nTxt(r.sector)}`;
    const idKey = r.id!=null ? `id:${r.id}` : '';
    const key = bizKey || idKey;
    const prev = map.get(key);
    if(!prev){ map.set(key,r); return; }
    // Prefer available over unavailable. If same, keep the one with concrete code.
    if((!prev.available && r.available) || ((prev.code==='—'||!prev.code) && r.code && r.code!=='—')){
      map.set(key,r);
    }
  });
  return [...map.values()];
}

function getCandidatesForDate(dateStr, myCode){
  const me=getCurrFuncionario();
  const myId=me?.id;
  if(dbLoaded && DB.turnos.length){
    const all=[...DB.funcionarios,...DB.suplentes];
    const rows = all
      .filter(f=>String(f.id)!==String(myId))
      .map(f=>{
        const t=DB.turnos.find(x=>String(x.funcionario_id)===String(f.id) && x.fecha===dateStr);
        const code=t?.codigo||'';
        const st=candidateStatusForCode(code,myCode);
        const nm=fNombre(f);
        return {
          id:f.id,
          name:nm,
          code:code||'—',
          clinic:f?.clinica?.nombre||'—',
          sector:f?.sector?.nombre||'—',
          ...st,
        };
      })
      .sort((a,b)=>Number(b.available)-Number(a.available));
    return dedupeCandidates(rows);
  }
  // Demo fallback: usar EMPS con patrón semanal de WK
  const d=new Date(`${dateStr}T12:00:00`);
  const day=d.getUTCDate();
  const myName=nTxt(cUser?.name);
  const rows = EMPS.map(e=>{
    const code=(WK[e.name]||[])[(day-1)%7]||'';
    const st=candidateStatusForCode(code,myCode);
    return {
      id:null,
      name:e.name,
      code:code||'—',
      clinic:e.clinic||'—',
      sector:e.sector||'—',
      ...st,
    };
  })
  .filter(x=>nTxt(x.name)!==myName)
  .sort((a,b)=>Number(b.available)-Number(a.available));
  return dedupeCandidates(rows);
}

function renderTradeAvail(){
  const box=document.getElementById('trdAvailList');
  if(!box) return;
  if(!TRADE_CTX.selectedDate){
    box.innerHTML='<div style="font-size:11px;color:var(--t3)">Seleccioná un día de tu agenda para buscar disponibles.</div>';
    return;
  }
  const cands=TRADE_CTX.candidates||[];
  if(!cands.length){
    box.innerHTML='<div style="font-size:11px;color:var(--t3)">No hay disponibles con turno cargado para esa fecha.</div>';
    renderTradeSelection();
    return;
  }

  const card=(c,i)=>`
    <div style="display:flex;align-items:center;justify-content:space-between;border:1px solid ${i===TRADE_CTX.selectedIdx?'var(--blue)':'var(--b)'};border-radius:8px;padding:8px 10px;background:${i===TRADE_CTX.selectedIdx?'var(--bdim)':'var(--bg3)'}">
      <div>
        <div style="font-size:12px;font-weight:600">${c.name}</div>
        <div style="font-size:10px;color:var(--t3)">${c.clinic} · ${c.sector} · turno ${c.code}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="chip ${c.chip||'cn'}">${c.label||'—'}</span>
        <button class="btn ${c.available?(i===TRADE_CTX.selectedIdx?'bs':'bp'):'bg'} xs" ${c.available?`onclick="selectTradeCandidate(${i})"`:'disabled'}>${c.available?(i===TRADE_CTX.selectedIdx?'Seleccionado':'Seleccionar'):'No disponible'}</button>
      </div>
    </div>
  `;

  const av = cands.map((c,i)=>({c,i})).filter(x=>x.c.available);
  const nav = cands.map((c,i)=>({c,i})).filter(x=>!x.c.available);
  let html = '';
  if(av.length){
    html += av.map(x=>card(x.c,x.i)).join('');
  } else {
    html += '<div style="font-size:11px;color:var(--t3)">No hay disponibles para el turno seleccionado.</div>';
  }
  if(nav.length){
    html += `<div style="display:flex;justify-content:flex-end;margin-top:6px">
      <button class="btn bg xs" onclick="toggleUnavailableCandidates()">${TRADE_CTX.showUnavailable?'Ocultar no disponibles':'Ver no disponibles'} (${nav.length})</button>
    </div>`;
    if(TRADE_CTX.showUnavailable){
      html += `<div style="display:flex;flex-direction:column;gap:8px;margin-top:6px">${nav.map(x=>card(x.c,x.i)).join('')}</div>`;
    }
  }
  box.innerHTML = html;
  renderTradeSelection();
}

function toggleUnavailableCandidates(){
  TRADE_CTX.showUnavailable = !TRADE_CTX.showUnavailable;
  renderTradeAvail();
}

function renderTradeSelection(){
  const box=document.getElementById('trdSelected');
  if(!box) return;
  const c=TRADE_CTX.candidates?.[TRADE_CTX.selectedIdx];
  if(!c){
    box.innerHTML='<span style="color:var(--t3)">Sin funcionario seleccionado</span>';
    return;
  }
  box.innerHTML=`<strong style="color:var(--text)">${c.name}</strong> · ${c.clinic} · ${c.sector} · turno ${c.code}`;
}

function openTradeFromAgenda(dateStr, myCode){
  TRADE_CTX.selectedDate=dateStr;
  TRADE_CTX.myCode=myCode||'M';
  TRADE_CTX.candidates=getCandidatesForDate(dateStr, TRADE_CTX.myCode);
  TRADE_CTX.selectedIdx=-1;
  TRADE_CTX.showUnavailable=false;
  openM('tradeM');
  const miF=document.getElementById('trdMiFecha');
  const miC=document.getElementById('trdMiCod');
  const suF=document.getElementById('trdSuFecha');
  if(miF) miF.value=dateStr;
  if(miC) miC.value=myCode||'M';
  if(suF) suF.value=dateStr;
  renderTradeAvail();
}

function refreshTradeCandidatesFromForm(){
  const d=document.getElementById('trdMiFecha')?.value;
  const c=document.getElementById('trdMiCod')?.value||'M';
  if(!d){
    TRADE_CTX = {selectedDate:'', myCode:c, candidates:[], selectedIdx:-1, showUnavailable:false};
    renderTradeAvail();
    return;
  }
  TRADE_CTX.selectedDate=d;
  TRADE_CTX.myCode=c;
  TRADE_CTX.candidates=getCandidatesForDate(d,c);
  TRADE_CTX.selectedIdx=-1;
  TRADE_CTX.showUnavailable=false;
  renderTradeAvail();
}

function selectTradeCandidate(idx){
  const c=TRADE_CTX.candidates?.[idx];
  if(!c || !c.available) return;
  TRADE_CTX.selectedIdx=idx;
  const suF=document.getElementById('trdSuFecha');
  const suC=document.getElementById('trdSuCod');
  if(suF && TRADE_CTX.selectedDate) suF.value=TRADE_CTX.selectedDate;
  if(suC) suC.value=c.code||'M';
  renderTradeAvail();
}

function renderMySched(){
  const v=document.getElementById('v-mySchedule');
  renderNurseView(v); // All roles see their own agenda
}

function renderNurseView(v){
  const dbEmp=getCurrFuncionario();
  const myMonths=getMyAvailableMonths(dbEmp?.id);
  const hasCtx=myMonths.some(m=>m.year===MY_AGENDA_CTX.year && m.month===MY_AGENDA_CTX.month);
  const active=hasCtx ? MY_AGENDA_CTX : {year:myMonths[myMonths.length-1].year, month:myMonths[myMonths.length-1].month};
  MY_AGENDA_CTX=active;
  const userSched=getUserSched(dbEmp?.id, active.year, active.month);
  const sector=dbEmp?.sector?.nombre||cUser.sector;
  const clinic=dbEmp?.clinica?.nombre||cUser.clinic;
  const hday=dbEmp?.horas_dia||6;
  const skip=new Set(['LAR','CERT','LE','F','DXF','CPL','E','LX1','LX2','LX3','LX4','LXE','NO CONVOCAR','MAT','PAT']);
  let wg=0,ex=0;
  Object.values(userSched).forEach(code=>{if(isW(code)){wg++;if(wg===7)ex+=6;}});
  const hs=wg*hday;

  // Mis licencias desde DB (solo lectura)
  const monthStart = new Date(Date.UTC(active.year, active.month, 1));
  const monthEnd = new Date(Date.UTC(active.year, active.month + 1, 0));
  const myLics=dbLoaded
    ? DB.licencias.filter(l=>{
        if(l.funcionario_id!==dbEmp?.id) return false;
        const from=new Date(`${l.fecha_desde}T12:00:00`);
        const to=new Date(`${(l.fecha_hasta||l.fecha_desde)}T12:00:00`);
        return from<=monthEnd && to>=monthStart; // overlap with selected month
      })
    : [];
  const myLicsRows=myLics.length
    ? myLics.map(l=>`<tr>
        <td><span class="chip cb2">${l.tipo}</span></td>
        <td style="font-size:11px">${l.fecha_desde}${l.fecha_hasta&&l.fecha_hasta!==l.fecha_desde?' -> '+l.fecha_hasta:' (1 día)'}</td>
        <td><span class="chip ${l.estado==='activa'?'cg':l.estado==='pendiente'?'ca':'cb2'}">${l.estado==='activa'?'Aprobada':l.estado==='pendiente'?'Pendiente':'Cerrada'}</span></td>
      </tr>`).join('')
    : '<tr><td colspan="3" style="color:var(--t3);font-size:11px;padding:8px">Sin licencias registradas</td></tr>';

  // Mis cambios (BD + locales en sesión)
  const myNm=cUser?.name||'';
  const dbCambios = dbLoaded
    ? DB.cambios.filter(x=>{
        const solNm = x.solicitante ? fNombre(x.solicitante) : (getNameByFuncionarioId(x.solicitante_id)||'');
        const recNm = x.receptor ? fNombre(x.receptor) : (getNameByFuncionarioId(x.receptor_id)||'');
        return solNm===myNm || recNm===myNm;
      }).map(x=>{
        const solNm = x.solicitante ? fNombre(x.solicitante) : (getNameByFuncionarioId(x.solicitante_id)||'—');
        const recNm = x.receptor ? fNombre(x.receptor) : (getNameByFuncionarioId(x.receptor_id)||'—');
        const esReceptor=recNm===myNm;
        const otro=esReceptor?solNm:recNm;
        const chip=x.estado==='pendiente'?'ca':x.estado==='aprobado'?'cg':'cb2';
        const label=x.estado==='pendiente'?'Pend. supervisora':x.estado==='aprobado'?'Aprobado':'Rechazado';
        return {
          otro,
          mi:`${x.turno_cede||'?'} ${x.fecha_cede||''}`.trim(),
          recibo:`${x.turno_recibe||'?'} ${x.fecha_recibe||''}`.trim(),
          chip,
          label,
          key:`db|${otro}|${x.turno_cede||'?'}|${x.fecha_cede||''}|${x.turno_recibe||'?'}|${x.fecha_recibe||''}|${x.estado||''}`,
        };
      })
    : [];
  const localCambios = (!dbLoaded?(MY_CAMBIOS||[]):[]).map(t=>({
    otro:t.con||'—',
    mi:t.miTurno||'—',
    recibo:t.recibo||'—',
    chip: t.estado==='aprobado'?'cg':t.estado==='rechazado'?'cr':'ca',
    label:t.estado==='aprobado'?'Aprobado':t.estado==='rechazado'?'Rechazado':'Pend. supervisora',
    key:`loc|${t.con||'—'}|${t.miTurno||'—'}|${t.recibo||'—'}|${t.estado||'pendiente'}`,
  }));
  const merged=[];
  const seen=new Set();
  [...localCambios, ...dbCambios].forEach(r=>{
    const k=`${r.otro}|${r.mi}|${r.recibo}|${r.label}`;
    if(seen.has(k)) return;
    seen.add(k);
    merged.push(r);
  });
  const myCambiosRows = merged.map(r=>`<tr>
    <td>${r.otro}</td>
    <td style="font-size:11px">${r.mi}</td>
    <td style="font-size:11px">${r.recibo}</td>
    <td><span class="chip ${r.chip}">${r.label}</span></td>
  </tr>`).join('');
  const myCambiosEmpty=!myCambiosRows
    ? '<tr><td colspan="4" style="color:var(--t3);font-size:11px;padding:8px">Sin cambios registrados</td></tr>'
    : myCambiosRows;

  v.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-family:var(--ff-display);font-weight:800;font-size:18px">Mi Agenda — ${getMonthLabel(active.year,active.month)}</div>
        <div style="font-size:12px;color:var(--t2);margin-top:3px">${cUser.name} · ${sector} · Clínica ${clinic}</div>
        <div style="font-size:10px;color:var(--t3);margin-top:2px">Fuente: ${dbLoaded?'Base de datos':'Demo local'}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="myMonthSel" onchange="changeMyAgendaMonth(this.value)" style="background:var(--bg3);border:1px solid var(--b);color:var(--text);padding:7px 10px;border-radius:var(--r);font-size:12px;min-width:180px;font-family:var(--ff-sans)">
          ${myMonths.map(m=>`<option value="${m.year}-${m.month}" ${m.year===active.year&&m.month===active.month?'selected':''}>${m.label}</option>`).join('')}
        </select>
        <button class="btn bg sm" onclick="toast('in','Seleccioná un día','Hacé click en un día con turno de tu calendario para iniciar el cambio.')">🔄 Solicitar Cambio</button>
      </div>
    </div>
    <div class="g4" style="margin-bottom:16px">
      <div class="sc"><div class="sl" style="background:var(--blue)"></div><div class="slbl">Guardias</div><div class="sv" style="color:var(--blue);font-size:24px">${wg}</div><div class="ssub">Objetivo: 22</div></div>
      <div class="sc"><div class="sl" style="background:var(--green)"></div><div class="slbl">Hs. Trabajadas</div><div class="sv" style="color:var(--green);font-size:24px">${hs}</div><div class="ssub">Objetivo: 132 hs</div></div>
      <div class="sc"><div class="sl" style="background:var(--t3)"></div><div class="slbl">Días Libres</div><div class="sv" style="font-size:24px;color:var(--t2)">${31-wg}</div><div class="ssub">Semanas completas</div></div>
      <div class="sc"><div class="sl" style="background:var(--amber)"></div><div class="slbl">Horas Extra</div><div class="sv" style="color:${ex?'var(--amber)':'var(--t2)'};font-size:24px">${ex||0}</div><div class="ssub">${ex?'7ª guardia alcanzada':'Sin extras este mes'}</div></div>
    </div>
    <div class="card" style="margin-bottom:14px">
      <div class="ch">
        <div class="ct">📅 Calendario — ${getMonthLabel(active.year,active.month)}</div>
        <div style="display:flex;gap:10px;font-size:10px;color:var(--t3);flex-wrap:wrap;justify-content:flex-end">
          <span><span class="sh sM">M</span> Turno</span>
          <span><span class="sh sLE">LE</span> Licencia</span>
          <span style="color:var(--t3)">- Libre</span>
          <span style="color:var(--blue)">Click en día con turno para solicitar cambio</span>
        </div>
      </div>
      <div id="myCalG" class="mygrid"></div>
    </div>
    <div class="g2" style="margin-bottom:14px">
      <div class="card">
        <div class="ch">
          <div class="ct">📋 Mis Licencias — ${MY_MONTHS_ES[active.month]}</div>
          <div style="font-size:10px;color:var(--t3)">Gestionadas por RRHH</div>
        </div>
        <div style="padding:0"><table><thead><tr><th>Tipo</th><th>Fechas</th><th>Estado</th></tr></thead>
          <tbody>${myLicsRows}</tbody></table></div>
      </div>
      <div class="card">
        <div class="ch">
          <div class="ct">🔄 Mis Cambios</div>
          <button class="btn bp sm" onclick="openM('tradeM')">＋ Solicitar</button>
        </div>
        <div style="padding:0"><table><thead><tr><th>Con</th><th>Mi turno</th><th>Recibo</th><th>Estado</th></tr></thead>
          <tbody>${myCambiosEmpty}</tbody></table></div>
      </div>
    </div>
  `;
  buildMyCalGrid(userSched, active.year, active.month);
}
function buildMyCalGrid(sched, year=new Date().getFullYear(), month=new Date().getMonth()){
  const userSched = sched || {};
  const g=document.getElementById('myCalG');if(!g)return;
  // Get birthday from DB
  const dbEmp=getCurrFuncionario();
  const bdayDate = dbEmp?.fecha_nacimiento ? new Date(`${dbEmp.fecha_nacimiento}T12:00:00`) : null;
  const bday = bdayDate ? bdayDate.getUTCDate() : 22;
  const bmonth = bdayDate ? bdayDate.getUTCMonth() : 0;
  const firstDow=((new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7); // Monday=0
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  let h='';
  ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'].forEach((d,i)=>{
    h+=`<div class="myhdr" style="${i>=5?'color:var(--red)':''}">${d}</div>`;
  });
  for(let b=0;b<firstDow;b++) h+=`<div class="mycell myempty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const wd=(firstDow+d-1)%7;const wk=wd>=5;
    const code=userSched[d];const isBday=(month===bmonth && d===bday);
    const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const clickable = !!code && isW(code);
    const baseStyle = `${isBday?'background:rgba(245,166,35,.06);':''}${clickable?'cursor:pointer;':''}`;
    h+=`<div class="mycell${wk?' mywknd':''}" ${baseStyle?`style="${baseStyle}"`:''} ${clickable?`onclick="openTradeFromAgenda('${dateStr}','${code}')"`:''} ${clickable?`title="Solicitar cambio para ${dateStr}"`:''}>`;
    h+=`<div class="mynum${isBday?' bd':''}">${d}${isBday?' 🎂':''}</div>`;
    if(code){h+=`<span class="sh ${shCls(code)}">${code}</span>`;h+=`<div class="myhs">${isW(code)?'6 hs':'—'}</div>`;}
    else if(!wk) h+=`<div style="font-size:9px;color:var(--t3);margin-top:3px">libre</div>`;
    h+='</div>';
  }
  g.innerHTML=h;
}

function changeMyAgendaMonth(raw){
  const parts=(raw||'').split('-');
  if(parts.length!==2) return;
  const y=parseInt(parts[0],10), m=parseInt(parts[1],10);
  if(Number.isNaN(y)||Number.isNaN(m)) return;
  MY_AGENDA_CTX={year:y,month:m};
  renderMySched();
}

function openCompSched(compKey){
  let f = null;
  let nm = '';
  let sector = '—';
  let clinic = '—';
  let sched = {};
  const ovId='compSchedOv';
  document.getElementById(ovId)?.remove();
  const ym=MY_AGENDA_CTX;
  if(String(compKey||'').startsWith('db:')){
    const id = String(compKey).replace('db:','');
    f = DB.funcionarios.find(x=>String(x.id)===id);
    if(!f) return;
    nm=fNombre(f);
    sector=f.sector?.nombre||'—';
    clinic=f.clinica?.nombre||'—';
    sched=getUserSched(f.id, ym.year, ym.month);
  } else {
    const raw = decodeURIComponent(String(compKey||'').replace('demo:',''));
    const e = EMPS.find(x=>x.name===raw);
    if(!e) return;
    nm=e.name;
    sector=e.sector||'—';
    clinic=e.clinic||'—';
    sched=getDemoSchedForName(nm, ym.year, ym.month);
  }
  const daysInMonth=new Date(Date.UTC(ym.year,ym.month+1,0)).getUTCDate();
  const firstDow=((new Date(Date.UTC(ym.year,ym.month,1)).getUTCDay()+6)%7);
  let grid='';
  ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'].forEach((d,i)=>{grid+=`<div class="myhdr" style="${i>=5?'color:var(--red)':''}">${d}</div>`;});
  for(let i=0;i<firstDow;i++) grid+=`<div class="mycell myempty"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const wd=(firstDow+d-1)%7;const wk=wd>=5;const code=sched[d];
    grid+=`<div class="mycell${wk?' mywknd':''}"><div class="mynum">${d}</div>${code?`<span class="sh ${shCls(code)}">${code}</span>`:`<div style="font-size:9px;color:var(--t3)">libre</div>`}</div>`;
  }
  const ov=document.createElement('div');
  ov.id=ovId; ov.className='ov open';
  ov.innerHTML=`<div class="modal" style="width:760px;max-width:96vw">
    <div class="mh"><div class="mh-t">👁 Agenda de ${nm} — ${getMonthLabel(ym.year,ym.month)}</div><button class="mh-x" onclick="document.getElementById('${ovId}').remove()">✕</button></div>
    <div class="mb">
      <div style="font-size:11px;color:var(--t2);margin-bottom:10px">${sector} · Clínica ${clinic}</div>
      <div class="mygrid">${grid}</div>
    </div>
    <div class="mf">
      <button class="btn bg" onclick="document.getElementById('${ovId}').remove()">Cerrar</button>
      <button class="btn bp" onclick="document.getElementById('${ovId}').remove();openTradeWith('${nm}')">🔄 Solicitar Cambio con ${nm}</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
}

function renderSubView(v){
  const sub=SUBS.find(s=>s.name===cUser?.name)||SUBS[0];
  if(!sub){ v.innerHTML=`<div style="padding:40px;text-align:center;color:var(--t2)">Sin datos de suplente disponibles.</div>`; return; }
  const _mesLabel=getMonthLabel(MY_AGENDA_CTX.year,MY_AGENDA_CTX.month);
  const _mm=String(MY_AGENDA_CTX.month+1).padStart(2,'0');
  const _yy=MY_AGENDA_CTX.year;
  const assigned=[3,6,9,12,14,17,20,22];
  v.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div><div style="font-family:var(--ff-display);font-weight:800;font-size:18px">Mis Asignaciones — ${_mesLabel}</div>
      <div style="font-size:12px;color:var(--t2);margin-top:3px">${sub.name} · Suplente · Antigüedad ${sub.sen} años · Cumplimiento ${sub.pct}%</div></div>
    </div>
    <div class="g4" style="margin-bottom:16px">
      <div class="sc"><div class="sl" style="background:var(--blue)"></div><div class="slbl">Guardias Mes</div><div class="sv" style="color:var(--blue);font-size:24px">${sub.g}</div></div>
      <div class="sc"><div class="sl" style="background:var(--green)"></div><div class="slbl">Hs. Trabajadas</div><div class="sv" style="color:var(--green);font-size:24px">${sub.g*6}</div></div>
      <div class="sc"><div class="sl" style="background:var(--purple)"></div><div class="slbl">Prioridad</div><div class="sv" style="color:var(--purple);font-size:24px">1°</div></div>
      <div class="sc"><div class="sl" style="background:var(--green)"></div><div class="slbl">Cumplimiento</div><div class="sv" style="color:var(--green);font-size:24px">${sub.pct}%</div></div>
    </div>
    <div class="stit">Guardias Asignadas — Confirmar Participación</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
      ${assigned.slice(0,4).map((d,i)=>`
        <div class="sub-card ${i<2?'pending':'accepted'}" id="sc${i}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
            <div style="font-weight:700;font-size:13px">${d.toString().padStart(2,'0')}/${_mm}/${_yy} — <span class="sh sM" style="margin-left:4px">MO</span></div>
            <span class="chip ${i<2?'ca':'cg'}">${i<2?'Pendiente confirmación':'Confirmada ✓'}</span>
          </div>
          <div style="font-size:11px;color:var(--t2);margin-bottom:${i<2?8:0}px">Sector: OBSERVACIÓN · Turno: 06:00—12:00 · Reemplaza: R. GARCIA</div>
          ${i<2?`<div style="display:flex;gap:8px">
            <button class="btn bs sm" onclick="confirmSub(${i})">✓ Aceptar guardia</button>
            <button class="btn bd sm" onclick="toast('wa','Rechazada','Se notificó a supervisora para reasignar.')">✕ Rechazar</button>
          </div>`:''}
        </div>`).join('')}
    </div>
    <div class="stit">Mis Competencias</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${sub.comp.map(c=>`<span class="chip cb2">${c}</span>`).join('')}
    </div>
  `;
}

function confirmSub(i){
  const el=document.getElementById('sc'+i);
  if(el){el.className='sub-card accepted';el.querySelector('div:last-child').innerHTML='<span class="chip cg">✓ Guardia confirmada</span>';}
  toast('ok','Guardia aceptada','La supervisora fue notificada.');
}

// ........................................................
// EMPLOYEES
// ........................................................
function renderEmps(){
  const body=document.getElementById('empFBody');if(!body)return;
  const skip=new Set(['LAR','CERT','LE','F','DXF','CPL','E','LX1','LX2','LX3','LX4','LXE','MAT','PAT']);
  const stSel=document.getElementById('empStatusSel');
  const stVal=stSel?.value||'active';
  // Fijos + suplentes con titularidad momentánea
  const titulares = dbLoaded ? (DB.suplentesAll||DB.suplentes||[]).filter(s=>s.titularidad_temp) : [];
  const source = dbLoaded ? [...(DB.funcionariosAll?.length?DB.funcionariosAll:DB.funcionarios), ...titulares] : [];
  const filtered = dbLoaded ? source.filter(f=>stVal==='all' ? true : stVal==='inactive' ? f.activo===false : f.activo!==false) : [];
  if(!dbLoaded||!source.length){
    body.innerHTML='<tr><td colspan="12" style="color:var(--t3);padding:20px;text-align:center">'+(dbLoaded?'Sin funcionarios en BD':'Conectando con base de datos...')+'</td></tr>';
    return;
  }
  body.innerHTML=filtered.map(f=>{
    const nm=fNombre(f);
    const ts=DB.turnos.filter(t=>t.funcionario_id===f.id);
    const g=ts.filter(t=>t.codigo&&!skip.has(t.codigo)).length;
    const faltas=ts.filter(t=>t.codigo==='F').length;
    const hasLar =DB.licencias.some(l=>l.funcionario_id===f.id&&l.tipo==='LAR'&&l.estado==='activa');
    const hasCert=DB.licencias.some(l=>l.funcionario_id===f.id&&l.tipo==='CERT'&&l.estado==='activa');
    const dc=hasLar?'da':hasCert?'dn':faltas>0?'dr2':'dg';
    const st=f.activo===false?'Inactivo':(hasLar?'LAR':hasCert?'CERT':faltas>0?'Falta':'Activo');
    const fnac = f.fecha_nacimiento ? new Date(`${f.fecha_nacimiento}T12:00:00`).toLocaleDateString('es-UY') : '—';
    const tel = f.telefono||'—';
    const actBtn = f.activo===false
      ? `<button class="btn bs xs" onclick="restoreEmpByName(decodeURIComponent('${encodeURIComponent(nm)}'))">↩</button>`
      : `<button class="btn bd xs" onclick="deleteEmpByName(decodeURIComponent('${encodeURIComponent(nm)}'))">🗑</button>`;
    const titChip = f.titularidad_temp
      ? `<span class="chip ca" style="font-size:9px;margin-left:4px" title="Suplente con titularidad momentánea">TITULAR</span>`
      : '';
    return `<tr>
      <td><strong>${nm}</strong>${titChip}</td>
      <td style="font-size:11px">${f.clinica?.nombre||'—'}</td>
      <td style="font-size:11px">${f.sector?.nombre||'—'}</td>
      <td><span class="chip cn" style="font-size:10px">${f.turno_fijo||'—'}</span></td>
      <td class="mn">${fnac}</td><td class="mn">${tel}</td>
      <td class="mn" style="color:var(--blue)">${g}</td>
      <td class="mn">${f.horas_semana||36}</td>
      <td class="mn" style="color:${g>22?'var(--amber)':'var(--t2)'}">${g>22?(g-22)*6:0}</td>
      <td class="mn" style="color:${faltas?'var(--red)':'var(--t2)'}">${faltas}</td>
      <td><span class="dot ${f.activo===false?'dn2':dc}"></span>${st}</td>
      <td><div style="display:flex;gap:4px">
        <button class="btn bg xs" onclick="editEmpByName(decodeURIComponent('${encodeURIComponent(nm)}'))">✏️</button>
        ${actBtn}
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="12" style="color:var(--t3);padding:20px;text-align:center">Sin resultados para el filtro seleccionado</td></tr>';
}

function renderSubs2(){
  const body=document.getElementById('empSBody');if(!body)return;
  const stSel=document.getElementById('empSubStatusSel');
  const stVal=stSel?.value||'active';
  const source = dbLoaded ? (DB.suplentesAll?.length?DB.suplentesAll:DB.suplentes) : SUBS;
  const sourceFiltered = dbLoaded ? source.filter(s=>stVal==='all' ? true : stVal==='inactive' ? s.activo===false : s.activo!==false) : source;
  const rows = dbLoaded
    ? sourceFiltered.map((s,i)=>({
        name:fNombre(s), sen:s.antiguedad||1, pct:s.cumplimiento||80, comp:s.competencias||[],
        g:DB.turnos.filter(t=>t.funcionario_id===s.id&&isW(t.codigo)).length,
        status:s.activo===false?'inactive':'available',
        titularidad_temp: !!s.titularidad_temp,
        sector_temp: s.sector?.nombre||'',
        disponibilidad: s.disponibilidad||'',
        idx:i
      }))
    : SUBS.map((s,i)=>({...s,idx:i}));
  body.innerHTML=rows.map((s,i)=>{
    const pc=s.pct>=90?'cg':s.pct>=80?'ca':'cr';
    const actBtn = s.status==='inactive'
      ? `<button class="btn bs xs" onclick="restoreEmpByName(decodeURIComponent('${encodeURIComponent(s.name)}'))">↩</button>`
      : `<button class="btn bd xs" onclick="deleteEmpByName(decodeURIComponent('${encodeURIComponent(s.name)}'))">🗑</button>`;
    const titChip = s.titularidad_temp
      ? `<span class="chip ca" style="font-size:9px;margin-left:4px" title="Sector: ${s.sector_temp}">TITULAR ${s.sector_temp?'· '+s.sector_temp:''}</span>`
      : '';
    const dispChip = s.disponibilidad
      ? `<span class="chip cb2" style="font-size:9px">${s.disponibilidad}</span>`
      : '';
    const stLabel = s.titularidad_temp ? 'Con titularidad' : s.status==='inactive' ? 'Inactivo' : s.status==='available' ? 'Disponible' : 'En turno';
    const stCls   = s.titularidad_temp ? 'ca' : s.status==='inactive' ? 'cn' : s.status==='available' ? 'cg' : 'ca';
    return `<tr>
      <td><strong>${s.name}</strong>${titChip}</td>
      <td class="mn">${s.sen} año${s.sen!==1?'s':''}</td>
      <td><span class="chip ${pc}">${s.pct}%</span></td>
      <td>${s.comp.map(c=>`<span class="chip cb2" style="margin:1px">${c}</span>`).join('')||dispChip}</td>
      <td class="mn">${s.g}</td>
      <td class="mn" style="color:var(--blue)">${s.g*6}hs</td>
      <td><span class="chip ${stCls}">${stLabel}</span></td>
      <td><span class="chip ${i===0?'cg':i===1?'ca':'cr'}">${i+1}° Prioridad</span></td>
      <td><div style="display:flex;gap:4px">
        <button class="btn bg xs" onclick="editEmpByName(decodeURIComponent('${encodeURIComponent(s.name)}'))">✏️</button>
        ${actBtn}
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" style="color:var(--t3);padding:20px;text-align:center">Sin resultados para el filtro seleccionado</td></tr>';
}

// Competencias state — keyed by funcionario UUID
let COMP_STATE = null; // {funcId: Set of sector names}
function getCompState(){
  if(!COMP_STATE){
    COMP_STATE={};
    if(dbLoaded){
      [...DB.funcionarios, ...DB.suplentes].forEach(f=>{
        COMP_STATE[f.id]=new Set(f.competencias||[]);
      });
    } else {
      SUBS.forEach(s=>{ COMP_STATE[s.name]=new Set(s.comp||[]); });
    }
  }
  return COMP_STATE;
}

function renderCompMat(){
  const secs = (dbLoaded&&DB.sectores&&DB.sectores.length)
    ? DB.sectores.map(s=>s.nombre)
    : ['URGENCIA','OBSERVACIÓN','CPB','ECONOMATO','DOMICILIO','HORNEROS','POLI MAÑANA','AMNP'];
  // Reset state so it reloads from DB on next call
  COMP_STATE = null;
  const state=getCompState();
  const funcs = dbLoaded
    ? [...DB.funcionarios, ...DB.suplentes].map(f=>({name:`${f.apellido}, ${f.nombre}`,id:f.id,tipo:f.tipo}))
    : SUBS.map(s=>({name:s.name,id:s.name,tipo:'suplente'}));
  let h='<div style="margin-bottom:10px;font-size:11px;color:var(--t2)">Hacé click en una celda para activar/desactivar una competencia. Los cambios se guardan automáticamente.</div>';
  h+='<div class="tw"><table><thead><tr><th>Funcionario</th>';
  secs.forEach(s=>h+=`<th style="text-align:center;font-size:9px">${s}</th>`);
  h+='</tr></thead><tbody>';
  funcs.forEach(f=>{
    const comps = state[f.id]||new Set();
    const badge = f.tipo==='suplente'?'<span style="font-size:9px;background:var(--adim);color:var(--amber);padding:1px 5px;border-radius:3px;margin-left:4px">SUP</span>':'';
    h+=`<tr><td><strong>${f.name}</strong>${badge}</td>`;
    secs.forEach(sec=>{
      const has=comps.has(sec);
      h+=`<td style="text-align:center;cursor:pointer;transition:background .1s" onclick="toggleComp('${f.id}','${sec}',this)" title="${has?'Quitar':'Agregar'} competencia ${sec}">
        <span style="font-size:16px;transition:all .15s">${has?'✅':'⬜'}</span>
      </td>`;
    });
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  const cont=document.getElementById('compMat');if(cont)cont.innerHTML=h;
}

async function toggleComp(funcId, sector, cell){
  const state=getCompState();
  if(!state[funcId]) state[funcId]=new Set();
  const has=state[funcId].has(sector);
  if(has) state[funcId].delete(sector); else state[funcId].add(sector);
  const span=cell.querySelector('span');
  if(span){ span.textContent=has?'⬜':'✅'; span.style.transform='scale(1.3)'; setTimeout(()=>span.style.transform='',200); }
  cell.style.background=has?'':'rgba(30,201,126,.08)';
  setTimeout(()=>cell.style.background='',600);
  // Sync to DB.funcionarios/suplentes in-memory
  const func=[...DB.funcionarios,...DB.suplentes].find(f=>f.id===funcId);
  const funcName = func ? `${func.apellido}, ${func.nombre}` : funcId;
  toast('ok',has?'Competencia removida':'Competencia agregada',`${funcName} · ${sector}`);
  if(sb && funcId){
    const newComps=[...state[funcId]];
    const {error}=await sb.from('funcionarios').update({competencias:newComps}).eq('id',funcId);
    if(error) toast('er','Error guardando competencia',error.message);
    else if(func) func.competencias=newComps;
  }
}

function filterT(id,val){document.querySelectorAll(`#${id} tr`).forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(val.toLowerCase())?'':'none';});}

// ........................................................
// LICENSES
// ........................................................
let LIC_FIL = 'all';
let COB_FIL = { mes: '', cliId: 'all', secId: 'all' };

function setLicFil(btn, val){
  LIC_FIL = val;
  document.querySelectorAll('.lic-fil').forEach(b=>b.classList.remove('act'));
  btn?.classList.add('act');
  renderLics();
}

// Calcula el score de un suplente para una licencia dada (sin efectos secundarios)
function scoreSuplente(s, lic){
  const empSector=lic.funcionario?.sector?.nombre||lic.sec||lic.sector||'';
  const empClinica=lic.funcionario?.clinica?.nombre||lic.clinica||'';
  const cubierto=DB.funcionarios.find(f=>f.id===(lic.funcionario_id||lic.funcionario?.id));
  const turnoReq=cubierto?.turno_fijo||'M';
  const mesPrefix=(lic.fecha_desde||lic.from||'').slice(0,7);
  const sc=s.clinica?.nombre||'';
  const ss=s.sector?.nombre||'';
  const sameSector=ss===empSector||sc===empClinica?2:0;
  const turnoMatch=s.turno_fijo===turnoReq?3:0;
  const hasComp=(s.competencias||[]).includes(empSector)?2:0;
  const guardias=DB.turnos.filter(t=>t.funcionario_id===s.id&&isW(t.codigo)).length;
  const guardiasMes=DB.turnos.filter(t=>t.funcionario_id===s.id&&t.fecha.startsWith(mesPrefix)&&isW(t.codigo)).length;
  const overwork=Math.max(0,(guardiasMes-20)*0.5);
  return sameSector+turnoMatch+hasComp-guardias*0.01-overwork;
}

function getSuplenteSugeridos(lic){
  if(!dbLoaded || !DB.suplentes.length) return [];
  const from=new Date((lic.fecha_desde||lic.from)+'T12:00:00');
  const to=new Date((lic.fecha_hasta||lic.to)+'T12:00:00');
  return DB.suplentes
    .filter(s=>s.activo!==false)
    .filter(s=>!DB.turnos.some(t=>{
      if(t.funcionario_id!==s.id) return false;
      const td=new Date(t.fecha+'T12:00:00');
      return td>=from && td<=to && isW(t.codigo);
    }))
    .map(s=>({...s, _score:scoreSuplente(s,lic)}))
    .sort((a,b)=>b._score-a._score)
    .slice(0,5);
}

/**
 * Genera turnos de cobertura para el suplente asignado a una licencia.
 * Solo genera si la licencia tiene suplente_id y genera_vacante=true.
 * @param {Object} lic - Objeto licencia de DB.licencias
 * @returns {number} - Cantidad de turnos generados
 */
async function generateSuplenteTurnos(lic){
  if(!lic.suplente_id || !lic.genera_vacante) return 0;
  const suplente=(DB.suplentes||[]).find(s=>s.id===lic.suplente_id);
  const cubierto=DB.funcionarios.find(f=>f.id===lic.funcionario_id);
  if(!suplente || !cubierto) return 0;
  const turnoACubrir=cubierto.turno_fijo||'M';
  const sectorId=lic.sector_id||cubierto.sector_id||null;
  const supPatron=suplente.patron||'LV';
  const supCicloRef=suplente.ciclo_ref||null;
  const records=[];
  let d=new Date((lic.fecha_desde||lic.from)+'T12:00:00');
  const end=new Date((lic.fecha_hasta||lic.to)+'T12:00:00');
  while(d<=end){
    const dateStr=d.toISOString().slice(0,10);
    if(isWorkDay(supPatron, supCicloRef, dateStr)){
      const conflicto=(DB.turnos||[]).find(t=>t.funcionario_id===suplente.id&&t.fecha===dateStr);
      if(!conflicto){
        records.push({funcionario_id:suplente.id,fecha:dateStr,codigo:turnoACubrir,sector_id:sectorId});
      }
    }
    d.setUTCDate(d.getUTCDate()+1);
  }
  if(records.length) await saveTurnosBatch(records);
  return records.length;
}

async function asignarSuplenteLic(licId, supId, supNombre){
  if(!sb) return;
  const {error}=await sb.from('licencias').update({suplente_id:supId,estado:'pendiente'}).eq('id',licId);
  if(error){ toast('er','Error','No se pudo asignar el suplente'); return; }
  const l=DB.licencias.find(x=>x.id===licId);
  if(l){ l.suplente_id=supId; l.estado='pendiente'; l.suplente={apellido:supNombre.split(', ')[0],nombre:supNombre.split(', ')[1]||''}; }
  renderLics();
  renderCobertura();
  toast('ok','Suplente asignado',`${supNombre} — pendiente aprobación supervisora`);
}

// Variante silenciosa para uso en generación automática (sin render ni toast)
async function _asignarSuplenteLicSilent(licId, supId, supNombre){
  if(!sb) return;
  const {error}=await sb.from('licencias').update({suplente_id:supId,estado:'pendiente'}).eq('id',licId);
  if(error){ console.warn('Auto-assign suplente failed:', error.message); return; }
  const l=DB.licencias.find(x=>x.id===licId);
  if(l){ l.suplente_id=supId; l.estado='pendiente'; l.suplente={apellido:supNombre.split(', ')[0],nombre:supNombre.split(', ')[1]||''}; }
}

// ........................................................
// MODAL DE REVISIÓN DE COBERTURA (generación)
// ........................................................
let _supReviewResolve = null; // resolve de la Promise de espera

function _showSuplenteModal(vacantes, mesLabel){
  return new Promise(resolve=>{
    _supReviewResolve = (confirm)=>{
      closeM('supReviewM');
      if(!confirm){ resolve([]); return; }
      // Leer selecciones del modal
      const result=[];
      vacantes.forEach((l,i)=>{
        const sel=document.getElementById(`supSel_${i}`);
        if(sel?.value){
          const sup=DB.suplentes.find(s=>String(s.id)===sel.value);
          if(sup) result.push({licId:l.id, supId:sup.id, supNombre:fNombre(sup)});
        }
      });
      resolve(result);
    };

    const info=document.getElementById('supReviewInfo');
    const body=document.getElementById('supReviewBody');
    document.querySelector('#supReviewM .mh-t').textContent=`🧑‍⚕️ Cobertura de vacantes — ${mesLabel}`;
    if(info) info.textContent=`${vacantes.length} licencia${vacantes.length!==1?'s':''} sin suplente asignado en este mes. Revisá las sugerencias antes de confirmar.`;

    const supOpts=DB.suplentes
      .filter(s=>s.activo!==false)
      .map(s=>`<option value="${s.id}">${fNombre(s)} · ${s.sector?.nombre||'—'} · ${s.turno_fijo||'—'}</option>`)
      .join('');

    body.innerHTML=vacantes.map((l,i)=>{
      const funcNombre=l.funcionario?fNombre(l.funcionario):'—';
      const sector=l.funcionario?.sector?.nombre||'—';
      const desde=l.fecha_desde||'—', hasta=l.fecha_hasta||'—';
      // Score y ordenar suplentes para esta licencia
      const scored=DB.suplentes
        .filter(s=>s.activo!==false)
        .map(s=>({...s,_score:scoreSuplente(s,l)}))
        .sort((a,b)=>b._score-a._score);
      const bestId=scored[0]?.id||'';
      return `<div style="padding:12px 0;border-bottom:1px solid var(--b)" data-from="${l.fecha_desde||''}" data-to="${l.fecha_hasta||''}">
        <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:180px">
            <div style="font-size:13px;font-weight:600">${funcNombre}</div>
            <div style="font-size:11px;color:var(--t3);margin-top:2px">${sector} · ${l.tipo||'LAR'} · ${desde} → ${hasta}</div>
          </div>
          <div class="fg" style="flex:1;min-width:200px;margin:0">
            <label>Suplente asignado</label>
            <select id="supSel_${i}">
              <option value="">— Sin asignar —</option>
              ${DB.suplentes.filter(s=>s.activo!==false).map(s=>`
                <option value="${s.id}" ${String(s.id)===String(bestId)?'selected':''}>
                  ${fNombre(s)} · ${s.sector?.nombre||'—'} · ${s.turno_fijo||'—'}
                </option>`).join('')}
            </select>
          </div>
        </div>
        ${scored[0]?`<div style="font-size:10px;color:var(--blue);margin-top:6px">⭐ Mejor candidato: ${fNombre(scored[0])} (score ${scored[0]._score.toFixed(1)})</div>`:''}
      </div>`;
    }).join('');

    openM('supReviewM');
  });
}

function _supReviewAutoAll(){
  // Asignar mejor suplente disponible por dropdown, evitando repetir el mismo para fechas solapadas
  const assigned=new Map(); // supId -> [{from, to}]
  document.querySelectorAll('[id^="supSel_"]').forEach(sel=>{
    const idx=parseInt(sel.id.replace('supSel_',''),10);
    // Obtener fechas de la vacante desde el data- del elemento contenedor
    const container=sel.closest('[data-from]');
    const vacFrom=container?new Date(container.dataset.from+'T12:00:00'):null;
    const vacTo  =container?new Date(container.dataset.to  +'T12:00:00'):null;
    // Buscar el primer option cuyo suplente no tenga solapamiento con asignaciones previas
    const chosen=[...sel.options].find(o=>{
      if(!o.value) return false;
      if(!vacFrom||!vacTo) return true; // sin fechas: tomar el primero disponible
      const prev=assigned.get(o.value)||[];
      return !prev.some(r=>r.from<=vacTo && r.to>=vacFrom);
    });
    if(chosen){
      sel.value=chosen.value;
      if(vacFrom&&vacTo){
        if(!assigned.has(chosen.value)) assigned.set(chosen.value,[]);
        assigned.get(chosen.value).push({from:vacFrom,to:vacTo});
      }
    }
  });
}

// Auto-asignar el mejor suplente disponible a TODAS las vacantes sin cubrir
async function autoAsignarTodas(){
  if(!dbLoaded){ toast('wa','Sin datos','Sincronizá la base de datos primero.'); return; }
  const vacantes=(DB.licencias||[]).filter(l=>
    l.genera_vacante && !l.suplente_id && l.estado!=='cancelada'
  );
  if(!vacantes.length){
    toast('ok','Sin vacantes pendientes','Todas las licencias con vacante ya tienen suplente asignado.');
    return;
  }
  const btn=document.getElementById('btnAutoAsignar');
  if(btn){ btn.disabled=true; btn.textContent='⟳ Asignando...'; }
  let asignados=0, sinCandidato=0;
  // Rastrear asignaciones hechas en este loop (DB.turnos aún no refleja los nuevos)
  const loopAssigned=new Map(); // supId -> [{from, to}]
  for(const lic of vacantes){
    const from=new Date(lic.fecha_desde+'T12:00:00');
    const to=new Date(lic.fecha_hasta+'T12:00:00');
    const candidatos=DB.suplentes
      .filter(s=>s.activo!==false)
      .filter(s=>{
        // Conflicto en turnos ya existentes en BD
        const dbConflict=DB.turnos.some(t=>{
          if(t.funcionario_id!==s.id) return false;
          const td=new Date(t.fecha+'T12:00:00');
          return td>=from && td<=to && isW(t.codigo);
        });
        if(dbConflict) return false;
        // Conflicto con asignaciones ya hechas en este mismo loop
        const loopRanges=loopAssigned.get(s.id)||[];
        return !loopRanges.some(r=>r.from<=to && r.to>=from);
      })
      .map(s=>({...s, _score:scoreSuplente(s,lic)}))
      .sort((a,b)=>b._score-a._score);
    if(candidatos.length){
      const best=candidatos[0];
      await _asignarSuplenteLicSilent(lic.id, best.id, fNombre(best));
      if(!loopAssigned.has(best.id)) loopAssigned.set(best.id,[]);
      loopAssigned.get(best.id).push({from,to});
      asignados++;
    } else {
      sinCandidato++;
    }
  }
  if(btn){ btn.disabled=false; btn.textContent='🤖 Auto-asignar todas'; }
  renderLics();
  renderCobertura();
  const msg=sinCandidato?` · ${sinCandidato} sin candidato disponible`:'';
  toast('ok',`${asignados} suplente${asignados!==1?'s':''} asignado${asignados!==1?'s':''}`,
    `${vacantes.length} vacante${vacantes.length!==1?'s':''} procesada${vacantes.length!==1?'s':''}${msg}`);
}

function renderLics(){
  const body=document.getElementById('licBody');if(!body)return;
  // Mostrar/ocultar botón auto-asignar según rol y vacantes pendientes
  const btnAA=document.getElementById('btnAutoAsignar');
  if(btnAA){
    const isSupervisor=['admin','supervisor'].includes(cRole);
    const hayVacantes=(DB.licencias||[]).some(l=>l.genera_vacante&&!l.suplente_id&&l.estado!=='cancelada');
    btnAA.style.display=isSupervisor&&hayVacantes?'':'none';
  }
  const today=new Date().toISOString().slice(0,10);
  const fmtDate = d=>{ try{ return new Date(d+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit'}); }catch(e){return d||'—';} };

  const rawLics = dbLoaded && DB.licencias.length ? DB.licencias : [];

  const lics = rawLics.map(l=>{
    const ended = l.fecha_hasta < today;
    const started = l.fecha_desde <= today;
    const vigente = started && !ended;
    const covered = !!l.suplente_id;
    let st;
    if(ended)                                              st = 'finalizada';
    else if(l.estado==='pendiente')                        st = 'pendiente';
    else if(l.genera_vacante && !covered && vigente)       st = 'uncovered';
    else                                                   st = 'active';
    return {
      _dbLic: l, id:l.id,
      funcId: l.funcionario_id,
      emp: l.funcionario ? `${l.funcionario.apellido}, ${l.funcionario.nombre}` : '—',
      sec: l.funcionario?.sector?.nombre||'—',
      type: l.tipo,
      from: l.fecha_desde, to: l.fecha_hasta,
      days: l.dias||Math.max(1,Math.round((new Date((l.fecha_hasta||l.fecha_desde)+'T12:00:00')-new Date((l.fecha_desde||l.fecha_hasta)+'T12:00:00'))/86400000)+1),
      vac: l.genera_vacante,
      sub: l.suplente ? fNombre(l.suplente) : (l.suplente_id ? 'Asignado' : '—'),
      st, ended, vigente,
    };
  });

  // Apply filter
  const fil = LIC_FIL;
  const visible = lics.filter(l=>{
    if(fil==='vigente')    return l.vigente;
    if(fil==='pendiente')  return l.st==='uncovered'&&l.vigente;
    if(fil==='finalizada') return l.ended;
    return true; // 'all'
  });

  visible.sort((a,b)=>a.emp.localeCompare(b.emp)||(a.from||'').localeCompare(b.from||''));

  // Group by employee
  const groups=[];
  let lastKey=null;
  visible.forEach((l,idx)=>{
    if(l.funcId!==lastKey){ groups.push({key:l.funcId,rows:[]}); lastKey=l.funcId; }
    groups[groups.length-1].rows.push({...l,globalIdx:idx});
  });

  if(!groups.length){
    body.innerHTML='<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:30px">Sin licencias para el filtro seleccionado</td></tr>';
    return;
  }

  let html='';
  groups.forEach(grp=>{
    const n=grp.rows.length;
    grp.rows.forEach((l,ri)=>{
      const tc={LAR:'cg',CERT:'cb2',F:'cr',LE:'ca',MAT:'cp',PAT:'cb2',DXF:'cn',CPL:'cp'}[l.type]||'cn';
      let sc,sl;
      if(l.st==='finalizada'){
        sc = l.vac ? (l.sub!=='—'?'cg':'cn') : 'cn';
        sl = l.vac ? (l.sub!=='—'?'Cubierta ✓':'Finalizada — sin suplente') : 'Finalizada';
      } else {
        sc = {active:'cg',covered:'cg',uncovered:'cr',pendiente:'ca'}[l.st]||'cn';
        sl = {active:'Vigente ✓',covered:'Cubierta ✓',uncovered:'Sin cubrir',pendiente:'Pendiente'}[l.st]||'—';
      }
      const canAct = !l.ended && ['admin','supervisor'].includes(cRole);
      const canAssign = canAct && l.st==='uncovered';
      const canReassign= canAct && (l.st==='pendiente' || (l.vac && l._dbLic?.suplente_id));
      const canApprove= canAct && l.st==='pendiente';
      const sugs = ((canAssign||canReassign) && l._dbLic) ? getSuplenteSugeridos(l._dbLic) : [];
      const sugHtml = sugs.length
        ? '<div style="margin-top:4px;font-size:10px;color:var(--t2)">'+(canReassign?'Reasignar: ':'Sugeridos: ')+
          sugs.map(s=>{const nm=fNombre(s);const cb=`asignarSuplenteLic(${JSON.stringify(l._dbLic.id)},${JSON.stringify(s.id)},${JSON.stringify(nm)})`;return `<button class="btn bs xs" style="font-size:10px" onclick="${cb.replace(/"/g,'&quot;')}">👤 ${nm}</button>`;}).join('')+
          '</div>' : '';
      const rowStyle = l.ended ? 'opacity:0.65' : '';
      html+=`<tr style="${rowStyle}">`;
      if(ri===0){
        html+=`<td rowspan="${n}" style="vertical-align:top;padding-top:10px;border-right:2px solid var(--b)${l.ended?';opacity:0.65':''}"><strong>${l.emp}</strong></td>`;
        html+=`<td rowspan="${n}" style="vertical-align:top;padding-top:10px;font-size:11px;border-right:2px solid var(--b)${l.ended?';opacity:0.65':''}">${l.sec||'—'}</td>`;
      }
      html+=`
        <td><span class="chip ${tc}">${l.type}</span></td>
        <td class="mn">${fmtDate(l.from)}</td><td class="mn">${fmtDate(l.to)}</td><td class="mn">${l.days||'—'}</td>
        <td>${l.vac?'<span class="chip ca">Sí</span>':'<span class="chip cn">No</span>'}</td>
        <td style="font-size:11px">${l.sub}</td>
        <td style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
          <span class="chip ${sc}">${sl}</span>
          ${canApprove?`<button class="btn bs xs" onclick="approveLic(${l.globalIdx})">✓ Aprobar</button><button class="btn bd xs" onclick="rejectLic(${l.globalIdx})">✕ Rechazar</button>`:''}
          ${canAssign?`<button class="btn bp xs" onclick="openAssignFromLic(${JSON.stringify(l._dbLic.id)},'${(l.sec||'').replace(/'/g,'&#39;')}','${l.from}')">Asignar suplente</button>`:''}
          ${canReassign?`<button class="btn bg xs" style="font-size:10px" onclick="openAssignFromLic(${JSON.stringify(l._dbLic.id)},'${(l.sec||'').replace(/'/g,'&#39;')}','${l.from}')">↺ Reasignar</button>`:''}
          ${sugHtml}
        </td>
      </tr>`;
    });
  });
  body.innerHTML=html;
}

function cobSetFil(key, val){
  COB_FIL[key] = val;
  renderCobertura();
}

function renderCobertura(){
  const body=document.getElementById('coberturaBody'); if(!body) return;
  if(!dbLoaded){ body.innerHTML='<p style="color:var(--t3);padding:20px">Cargando datos...</p>'; return; }

  const today=new Date().toISOString().slice(0,10);
  const todayD=new Date(today+'T12:00:00');
  const fmt=d=>{try{const dt=new Date(d+'T12:00:00');return dt.toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit'});}catch(e){return d||'—';}};
  const fmtLong=d=>{try{const dt=new Date(d+'T12:00:00');return dt.toLocaleDateString('es-UY',{weekday:'long',day:'numeric',month:'long'});}catch(e){return d;}};
  const isSup=['admin','supervisor'].includes(cRole);

  // ── Month options from licencias + current month ──────────────────────────
  const nowY=new Date().getFullYear(), nowM=new Date().getMonth()+1;
  const defaultMes=`${nowY}-${String(nowM).padStart(2,'0')}`;
  if(!COB_FIL.mes) COB_FIL.mes=defaultMes;

  const mesSet=new Set([defaultMes]);
  DB.licencias.forEach(l=>{
    if(l.fecha_desde) mesSet.add(l.fecha_desde.slice(0,7));
    if(l.fecha_hasta) mesSet.add(l.fecha_hasta.slice(0,7));
  });
  const mesOpts=[...mesSet].sort().map(m=>{
    const [y,mo]=m.split('-');
    const label=new Date(+y,+mo-1,1).toLocaleDateString('es-UY',{month:'long',year:'numeric'});
    return `<option value="${m}"${m===COB_FIL.mes?' selected':''}>${label.charAt(0).toUpperCase()+label.slice(1)}</option>`;
  }).join('');

  // ── Date range for selected month ─────────────────────────────────────────
  const [mY,mM]=COB_FIL.mes.split('-').map(Number);
  const mesFrom=`${mY}-${String(mM).padStart(2,'0')}-01`;
  const mesTo=new Date(mY,mM,0).toISOString().slice(0,10);

  // ── Filter licencias (before building option lists) ───────────────────────
  let pending=DB.licencias.filter(l=>
    l.genera_vacante && !l.suplente_id &&
    ['activa','pendiente'].includes(l.estado) &&
    l.fecha_hasta >= today &&
    l.fecha_hasta >= mesFrom &&
    l.fecha_desde <= mesTo
  );
  if(COB_FIL.cliId!=='all') pending=pending.filter(l=>
    l.funcionario?.clinica?.id===COB_FIL.cliId || l.funcionario?.clinica_id===COB_FIL.cliId);
  if(COB_FIL.secId!=='all') pending=pending.filter(l=>
    l.funcionario?.sector?.id===COB_FIL.secId);

  // ── Clínica / Sector options — derived from all funcionarios ──────────────
  const cliMap=new Map(), secMap=new Map();
  [...DB.funcionarios,...DB.suplentes,...(DB.licencias.map(l=>l.funcionario).filter(Boolean))].forEach(f=>{
    if(f.clinica?.nombre) cliMap.set(f.clinica_id||f.clinica.nombre, f.clinica.nombre);
    if(f.sector?.nombre)  secMap.set(f.sector_id ||f.sector.nombre,  f.sector.nombre);
  });
  const cliOpts='<option value="all">Todas las clínicas</option>'+
    [...cliMap.entries()].sort((a,b)=>a[1].localeCompare(b[1]))
      .map(([id,nm])=>`<option value="${id}"${id===COB_FIL.cliId?' selected':''}>${nm}</option>`).join('');
  const secOpts='<option value="all">Todos los sectores</option>'+
    [...secMap.entries()].sort((a,b)=>a[1].localeCompare(b[1]))
      .map(([id,nm])=>`<option value="${id}"${id===COB_FIL.secId?' selected':''}>${nm}</option>`).join('');

  // ── Build agenda: group licencias by "anchor day" in selected month ───────
  // Anchor = max(fecha_desde, mesFrom) — so ongoing licencias appear from day 1
  const dayMap=new Map();
  pending.forEach(l=>{
    const anchor=l.fecha_desde>mesFrom?l.fecha_desde:mesFrom;
    if(!dayMap.has(anchor)) dayMap.set(anchor,[]);
    dayMap.get(anchor).push(l);
  });
  const days=[...dayMap.keys()].sort();

  // ── Render filter bar ─────────────────────────────────────────────────────
  const filterBar=`
    <div class="cob-filters">
      <div><label>Mes</label><br>
        <select onchange="cobSetFil('mes',this.value)">${mesOpts}</select>
      </div>
      <div><label>Clínica</label><br>
        <select onchange="cobSetFil('cliId',this.value)">${cliOpts}</select>
      </div>
      <div><label>Sector</label><br>
        <select onchange="cobSetFil('secId',this.value)">${secOpts}</select>
      </div>
      <div style="margin-left:auto;align-self:flex-end;font-size:11px;color:var(--t3)">
        ${pending.length} vacante${pending.length!==1?'s':''} sin cubrir
      </div>
    </div>`;

  // ── Empty state ───────────────────────────────────────────────────────────
  if(!days.length){
    body.innerHTML=filterBar+`
      <div style="text-align:center;padding:48px 20px;color:var(--t3)">
        <div style="font-size:32px;margin-bottom:12px">✅</div>
        <div style="font-size:15px;font-weight:600;color:var(--green)">Sin coberturas pendientes</div>
        <div style="font-size:12px;margin-top:6px">No hay vacantes activas en el período seleccionado.</div>
      </div>`;
    return;
  }

  // ── Render agenda ─────────────────────────────────────────────────────────
  const TURNO_LABEL={M:'Mañana',T:'Tarde',TS:'Tarde',V:'Vespertino',N:'Noche',NO:'Noche',ROT:'Rotativo'};
  let agendaHtml='';

  days.forEach(day=>{
    const lics=dayMap.get(day);
    const isToday=day===today;
    const dayLabel=isToday?'Hoy — '+fmtLong(day):fmtLong(day);
    agendaHtml+=`<div class="cob-day-hdr">
      <span${isToday?' style="color:var(--blue)"':''}>${dayLabel}</span>
      <span class="chip ca" style="font-size:10px">${lics.length} vacante${lics.length>1?'s':''}</span>
    </div>`;

    lics.forEach(l=>{
      const emp=l.funcionario?fNombre(l.funcionario):'—';
      const sec=l.funcionario?.sector?.nombre||'—';
      const turno=TURNO_LABEL[String(l.funcionario?.turno_fijo||'').toUpperCase()]||l.funcionario?.turno_fijo||'—';
      const daysLeft=Math.max(0,Math.round((new Date(l.fecha_hasta+'T12:00:00')-todayD)/86400000));
      const totalDias=Math.round((new Date(l.fecha_hasta+'T12:00:00')-new Date(l.fecha_desde+'T12:00:00'))/86400000)+1;
      const urgColor=daysLeft<=3?'var(--red)':daysLeft<=7?'var(--amber)':'var(--t3)';
      const urgLabel=daysLeft===0?'Vence hoy':daysLeft===1?'Vence mañana':`Quedan ${daysLeft} días`;
      const tipoChip=`<span class="chip cn" style="font-size:9px">${l.tipo||'Licencia'}</span>`;
      const sugs=isSup?getSuplenteSugeridos(l):[];

      let supHtml='';
      if(sugs.length){
        supHtml=sugs.map(s=>{
          const nm=fNombre(s);
          const sc=s.sector?.nombre||s.clinica?.nombre||'';
          const g=DB.turnos.filter(t=>t.funcionario_id===s.id&&isW(t.codigo)).length;
          // UUIDs quoted safely with JSON.stringify
          const cb=`asignarSuplenteLic(${JSON.stringify(l.id)},${JSON.stringify(s.id)},${JSON.stringify(nm)})`;
          return `<button class="cob-sup-btn" onclick="${cb.replace(/"/g,'&quot;')}">
            👤 <span>${nm}</span>
            <span class="gsec">${sc||''}${g?' · '+g+' gd':''}</span>
          </button>`;
        }).join('');
      } else {
        supHtml=`<span style="font-size:11px;color:var(--t3);padding:4px 0">${
          isSup?'Sin suplentes disponibles en este período':'Acción de supervisor'}</span>`;
      }

      agendaHtml+=`
        <div class="cob-row">
          <div class="cob-row-info">
            <div class="name">${emp}</div>
            <div class="meta">${sec} · ${tipoChip} · <strong>${turno}</strong></div>
            <div class="dates">📅 ${fmt(l.fecha_desde)} → ${fmt(l.fecha_hasta)} · ${totalDias} días en total · <span style="color:${urgColor};font-weight:600">${urgLabel}</span></div>
            ${l.observaciones?`<div style="font-size:10px;color:var(--t3);margin-top:3px">💬 ${l.observaciones}</div>`:''}
          </div>
          <div class="cob-row-sugs">${supHtml}</div>
        </div>`;
    });
  });

  body.innerHTML=filterBar+`<div>${agendaHtml}</div>`;
}

function renderLAR(){
  const body=document.getElementById('larBody');if(!body)return;
  if(dbLoaded && DB.funcionarios.length){
    const years=getAvailableMonthsGlobal().map(m=>m.year);
    const year=years.length?Math.max(...years):new Date().getFullYear();
    const byFunc=new Map();
    DB.funcionarios.forEach(f=>{
      byFunc.set(String(f.id),{
        n:fNombre(f),
        sec:f.sector?.nombre||'—',
        total:Number(f?.lar_total||f?.dias_lar||20)||20,
        m:Array(12).fill(0),
      });
    });
    (DB.licencias||[])
      .filter(l=>String(l.tipo||'').toUpperCase()==='LAR')
      .filter(l=>!['rechazada','cancelada'].includes(String(l.estado||'').toLowerCase()))
      .forEach(l=>{
        const key=String(l.funcionario_id||l.funcionario?.id||'');
        if(!key||!byFunc.has(key)) return;
        const row=byFunc.get(key);
        const from=new Date(`${l.fecha_desde}T12:00:00`);
        const to=new Date(`${l.fecha_hasta}T12:00:00`);
        if(Number.isNaN(from.getTime())||Number.isNaN(to.getTime())) return;
        for(let m=0;m<12;m++){
          const ms=new Date(Date.UTC(year,m,1));
          const me=new Date(Date.UTC(year,m+1,0));
          const s=Math.max(ms.getTime(),from.getTime());
          const e=Math.min(me.getTime(),to.getTime());
          if(e>=s) row.m[m]+=Math.floor((e-s)/86400000)+1;
        }
      });
    const rows=[...byFunc.values()].sort((a,b)=>a.n.localeCompare(b.n,'es'));
    body.innerHTML=rows.map(l=>{
      const used=l.m.reduce((a,b)=>a+b,0);const saldo=l.total-used;
      return `<tr><td><strong>${l.n}</strong></td><td style="font-size:11px">${l.sec}</td><td class="mn">${l.total}</td>
      ${l.m.map(v=>`<td class="mn" style="color:${v>0?'var(--green)':'var(--t3)'}">${v||'—'}</td>`).join('')}
      <td class="mn" style="color:${saldo>=0?'var(--green)':'var(--red)'};font-weight:700">${saldo}</td></tr>`;
    }).join('');
    return;
  }
  body.innerHTML=`<tr><td colspan="15" style="text-align:center;padding:20px;color:var(--t2)">Sin datos de licencias LAR disponibles. Sincronizá la base de datos.</td></tr>`;
}

function resetLicForm(){
  const fields=['licEmpInput','licType','licDesde','licHasta','licObs','licSubSel'];
  fields.forEach(id=>{ const el=document.getElementById(id); if(el){ if(el.tagName==='SELECT') el.selectedIndex=0; else el.value=''; }});
  populateSels(); // refresh dropdowns from DB
  populateLicEmpPicker();
  const info=document.getElementById('licEmpInfo'); if(info){ info.style.display='none'; info.innerHTML=''; }
  const warn=document.getElementById('licOverlapWarn'); if(warn){ warn.style.display='none'; warn.innerHTML=''; }
  chkVac(); // hide vacante box
}

function chkVac(){
  const t=document.getElementById('licType')?.value;
  const vb=document.getElementById('vacBox');
  const show=['F','MAT','CERT','LE','PAT'].includes(t);
  if(vb) vb.style.display=show?'block':'none';
  if(show){
    const sel=document.getElementById('licSubSel');
    if(sel){
      const subs=dbLoaded&&DB.suplentes.length?DB.suplentes:SUBS;
      sel.innerHTML='<option value="">Sin asignar por ahora</option>'+
        subs.map((s,i)=>{const nm=s.apellido?`${s.apellido}, ${s.nombre}`:s.name;const pct=s.pct||80;return `<option value="${nm}">${nm} (${i+1}° · ${pct}%)</option>`;}).join('');
    }
  }
}
function chkV(){
  const c=document.getElementById('smCode')?.value;
  const vb=document.getElementById('smVBox');
  if(vb) vb.style.display=['F','LAR','CERT'].includes(c)?'block':'none';
}

function resolveFuncionarioByInput(raw,{onlyFijo=false}={}){
  const q=nTxt(raw);
  if(!q) return {emp:null,matches:[]};
  const rows=[...(DB.funcionariosAll||DB.funcionarios||[]), ...(DB.suplentesAll||DB.suplentes||[])].filter(f=>!onlyFijo || !f.tipo || f.tipo==='fijo');
  const exact=rows.filter(f=>nTxt(fNombre(f))===q);
  if(exact.length===1) return {emp:exact[0],matches:exact};
  const starts=rows.filter(f=>nTxt(fNombre(f)).startsWith(q));
  if(starts.length===1) return {emp:starts[0],matches:starts};
  const includes=rows.filter(f=>nTxt(fNombre(f)).includes(q));
  if(includes.length===1) return {emp:includes[0],matches:includes};
  return {emp:null,matches: exact.length?exact:(starts.length?starts:includes)};
}

function populateLicEmpPicker(){
  const dl=document.getElementById('licEmpList');
  if(!dl) return;
  const rows = dbLoaded && (DB.funcionariosAll?.length || DB.funcionarios.length)
    ? (DB.funcionariosAll?.length?DB.funcionariosAll:DB.funcionarios)
    : [];
  const uniq=[];
  const seen=new Set();
  rows.forEach(f=>{
    if(f.tipo && f.tipo!=='fijo') return;
    const n=fNombre(f); const k=nTxt(n);
    if(!n || seen.has(k)) return;
    seen.add(k); uniq.push(n);
  });
  uniq.sort((a,b)=>a.localeCompare(b,'es'));
  dl.innerHTML=uniq.map(n=>`<option value="${n}"></option>`).join('');
}

function checkLicOverlapPreview(){
  const warn=document.getElementById('licOverlapWarn');
  if(!warn) return;
  const empTxt=document.getElementById('licEmpInput')?.value||'';
  const desde=document.getElementById('licDesde')?.value||'';
  const hasta=document.getElementById('licHasta')?.value||'';
  const tipo=document.getElementById('licType')?.value||'LAR';
  warn.style.display='none'; warn.innerHTML='';
  warn.style.background='var(--adim)';
  warn.style.border='1px solid rgba(245,166,35,.3)';
  warn.style.color='var(--amber)';
  if(!empTxt||!desde||!hasta) return;
  if(desde>hasta){
    warn.style.display='block';
    warn.innerHTML='⚠ Rango inválido: la fecha desde no puede ser mayor que hasta.';
    return;
  }
  const r=resolveFuncionarioByInput(empTxt,{onlyFijo:true});
  if(!r.emp) return;
  const conflict=hasLicOverlap(r.emp.id,desde,hasta);
  if(conflict){
    warn.style.display='block';
    warn.innerHTML=`⚠ Solapamiento detectado con licencia <strong>${esc(conflict.tipo)}</strong> (${esc(conflict.fecha_desde)} a ${esc(conflict.fecha_hasta)}).`;
    return;
  }
  warn.style.display='block';
  warn.style.background='var(--bdim)';
  warn.style.border='1px solid rgba(61,127,255,.25)';
  warn.style.color='var(--blue)';
  warn.innerHTML=`ℹ️ No se detecta solapamiento para <strong>${esc(tipo)}</strong> en el período seleccionado.`;
}

function onLicEmpInputChange(){
  const info=document.getElementById('licEmpInfo');
  if(!info) return;
  const txt=document.getElementById('licEmpInput')?.value||'';
  if(!txt){
    info.style.display='none'; info.innerHTML='';
    checkLicOverlapPreview();
    return;
  }
  const r=resolveFuncionarioByInput(txt,{onlyFijo:true});
  if(!r.emp){
    info.style.display='block';
    info.innerHTML = r.matches.length>1
      ? `Se encontraron ${r.matches.length} coincidencias. Escribí nombre completo para elegir una única.`
      : 'No se encontró un funcionario válido todavía.';
    checkLicOverlapPreview();
    return;
  }
  const emp=r.emp;
  const lics=(DB.licencias||[])
    .filter(l=>String(l.funcionario_id)===String(emp.id))
    .filter(l=>!['rechazada','cancelada'].includes(String(l.estado||'')))
    .sort((a,b)=>String(b.fecha_desde||'').localeCompare(String(a.fecha_desde||'')));
  info.style.display='block';
  if(!lics.length){
    info.innerHTML=`<strong>${fNombre(emp)}</strong><br>Sin licencias previas registradas.`;
  }else{
    info.innerHTML=`<strong>${fNombre(emp)}</strong><br>Licencias existentes:<br>`+
      lics.slice(0,4).map(l=>`• ${l.tipo} · ${l.fecha_desde} a ${l.fecha_hasta} (${l.estado||'—'})`).join('<br>');
  }
  checkLicOverlapPreview();
}

function onLarEmpInputChange(){
  const info=document.getElementById('larEmpInfo');
  if(!info) return;
  const txt=document.getElementById('larEmpInput')?.value||'';
  const desde=document.getElementById('larDesde')?.value||'';
  const hasta=document.getElementById('larHasta')?.value||'';
  if(!txt){
    info.style.display='none';
    info.innerHTML='';
    return;
  }
  const r=resolveFuncionarioByInput(txt,{onlyFijo:true});
  if(!r.emp){
    info.style.display='block';
    info.innerHTML = r.matches.length>1
      ? `Se encontraron ${r.matches.length} coincidencias. Escribí nombre completo para elegir una única.`
      : 'No se encontró un funcionario válido todavía.';
    return;
  }
  const emp=r.emp;
  const lics=(DB.licencias||[])
    .filter(l=>String(l.funcionario_id)===String(emp.id))
    .filter(l=>!['rechazada','cancelada'].includes(String(l.estado||'')))
    .sort((a,b)=>String(b.fecha_desde||'').localeCompare(String(a.fecha_desde||'')));
  info.style.display='block';
  if(!lics.length){
    info.innerHTML=`<strong>${fNombre(emp)}</strong><br>Sin licencias previas registradas.`;
    return;
  }
  const hasRange = !!desde && !!hasta && desde<=hasta;
  const overlaps = hasRange
    ? lics.filter(l=>{
        const lf=String(l.fecha_desde||'');
        const lh=String(l.fecha_hasta||l.fecha_desde||'');
        return desde<=lh && hasta>=lf;
      })
    : [];
  const listHtml = lics.slice(0,8).map(l=>{
    const lf=String(l.fecha_desde||'');
    const lh=String(l.fecha_hasta||l.fecha_desde||'');
    const ov = hasRange && (desde<=lh && hasta>=lf);
    return `${ov?'⚠️ ':'• '}${l.tipo} · ${lf} a ${lh} (${l.estado||'—'})`;
  }).join('<br>');
  const head = hasRange
    ? `Superposiciones con ${desde} → ${hasta}: <strong>${overlaps.length}</strong><br>`
    : 'Licencias existentes:<br>';
  info.innerHTML=`<strong>${fNombre(emp)}</strong><br>${head}${listHtml}`;
}

const LIC_RULES = {
  LAR: {minDays:1, maxDays:40, forceVac:false},
  MAT: {minDays:84, maxDays:365, forceVac:true},
  PAT: {minDays:10, maxDays:30, forceVac:true},
  CERT:{minDays:1, maxDays:180, forceVac:true},
  LE:  {minDays:1, maxDays:30, forceVac:true},
  F:   {minDays:1, maxDays:1,  forceVac:true},
  DXF: {minDays:1, maxDays:1,  forceVac:false},
  CPL: {minDays:1, maxDays:1,  forceVac:false},
};

function getDateRange(from, to){
  const out=[];
  const a=new Date(`${from}T12:00:00`);
  const b=new Date(`${to}T12:00:00`);
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||a>b) return out;
  const cur=new Date(a);
  while(cur<=b){
    out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth()+1).padStart(2,'0')}-${String(cur.getUTCDate()).padStart(2,'0')}`);
    cur.setUTCDate(cur.getUTCDate()+1);
  }
  return out;
}

function hasLicOverlap(funcId, desde, hasta){
  const a=new Date(`${desde}T12:00:00`);
  const b=new Date(`${hasta}T12:00:00`);
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())) return null;
  return (DB.licencias||[]).find(l=>{
    if(String(l.funcionario_id)!==String(funcId)) return false;
    if(['rechazada','cancelada'].includes(String(l.estado||''))) return false;
    const lFrom=new Date(`${l.fecha_desde}T12:00:00`);
    const lTo=new Date(`${(l.fecha_hasta||l.fecha_desde)}T12:00:00`);
    return a<=lTo && b>=lFrom;
  })||null;
}

async function applyLicToTurnos(funcionarioId, desde, hasta, code, sectorId){
  const dates=getDateRange(desde,hasta);
  if(!dates.length) return;
  const rows=dates.map(fecha=>({funcionario_id:funcionarioId, fecha, codigo:code, sector_id:sectorId||null}));
  if(sb){
    const {error}=await sb.from('turnos').upsert(rows,{onConflict:'funcionario_id,fecha'});
    if(error){ console.error('Error aplicando licencia en turnos:', error); }
  }
  DB.turnos = DB.turnos.filter(t=>!(String(t.funcionario_id)===String(funcionarioId) && t.fecha>=desde && t.fecha<=hasta));
  DB.turnos.push(...rows);
}

// ........................................................
// TRADES
// ........................................................
function renderTrades(){
  const pend=document.getElementById('trdPend');
  const hist=document.getElementById('trdHist');
  const desc=document.getElementById('tradeDesc');
  const pTit=document.getElementById('trdPendTitle');
  if(!pend||!hist) return;

  const isSuperAdmin=['admin','supervisor'].includes(cRole);
  const myName=cUser?.name||'';
  const myFuncId=String(getCurrFuncionario()?.id||'');

  const dbRows=(DB.cambios||[]).map(c=>{
    const sol=c.solicitante?fNombre(c.solicitante):(getNameByFuncionarioId(c.solicitante_id)||'—');
    const rec=c.receptor?fNombre(c.receptor):(getNameByFuncionarioId(c.receptor_id)||'—');
    return {
      id:c.id||null, source:'db',
      estado:c.estado||'pendiente',
      date:c.created_at?new Date(c.created_at).toLocaleDateString('es-UY'):'—',
      sol, rec,
      solicitante_id: String(c.solicitante_id||''),
      receptor_id:    String(c.receptor_id||''),
      tc:`${c.turno_cede||'?'} · ${c.fecha_cede||'?'}`,
      tr:`${c.turno_recibe||'?'} · ${c.fecha_recibe||'?'}`,
    };
  });
  const localRows=(!dbLoaded?(MY_CAMBIOS||[]):[]).map((t,idx)=>({
    id:null, source:'local', localIdx:idx,
    estado:t.estado||'pendiente', date:'Hoy',
    sol:myName, rec:t.con||'—',
    solicitante_id:'', receptor_id:'',
    tc:t.miTurno||'—', tr:t.recibo||'—',
  }));
  const merged=[...dbRows,...localRows].filter(r=>{
    const involucrado = r.sol===myName || r.rec===myName || r.solicitante_id===myFuncId || r.receptor_id===myFuncId;
    return isSuperAdmin ? true : involucrado;
  });

  const stChip={aprobado:'cg',rechazado:'cr',rechazado_receptor:'cr',aceptado_receptor:'cb2',pendiente:'ca'};
  const stLabel={aprobado:'Aprobado',rechazado:'Rechazado',rechazado_receptor:'Rechazado por receptor',aceptado_receptor:'Aceptado — pend. supervisora',pendiente:'Pendiente'};

  if(isSuperAdmin){
    desc.textContent='Gestioná los cambios de turno del equipo.';
    pTit.textContent='Cambios pendientes de gestión';
    const readyList=DB.cambios.filter(c=>c.estado==='aceptado_receptor');
    const waitList=DB.cambios.filter(c=>c.estado==='pendiente');
    const parts=[];
    if(readyList.length){
      parts.push(`<div style="font-size:11px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.7px;padding:6px 0 8px">✓ Listos para aprobar — receptor aceptó (${readyList.length})</div>`);
      readyList.forEach(c=>{
        const s=c.solicitante?fNombre(c.solicitante):getNameByFuncionarioId(c.solicitante_id)||'—';
        const r=c.receptor?fNombre(c.receptor):getNameByFuncionarioId(c.receptor_id)||'—';
        const cid=JSON.stringify(c.id);
        parts.push(`<div style="background:var(--card);border:1px solid var(--green);border-radius:var(--r2);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px">
          <div>
            <div style="font-weight:700;font-size:13px;margin-bottom:3px">${esc(s)} <span style="color:var(--t3)">↔</span> ${esc(r)}</div>
            <div style="font-size:11px;color:var(--t2)">${esc(c.turno_cede||'?')} ${esc(c.fecha_cede||'?')} → ${esc(c.turno_recibe||'?')} ${esc(c.fecha_recibe||'?')}</div>
            <div style="margin-top:5px"><span class="chip cb2">Receptor aceptó ✓</span> <span style="font-size:10px;color:var(--t3);margin-left:6px">${c.created_at?new Date(c.created_at).toLocaleDateString('es-UY'):'—'}</span></div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            <button class="btn bs sm" onclick="appTrd(${cid})">✓ Aprobar</button>
            <button class="btn bd sm" onclick="rejTrd(${cid})">✕ Rechazar</button>
          </div>
        </div>`);
      });
    }
    if(waitList.length){
      parts.push(`<div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.7px;padding:${readyList.length?'14px':' 6px'} 0 8px">⏳ Esperando respuesta del receptor (${waitList.length})</div>`);
      waitList.forEach(c=>{
        const s=c.solicitante?fNombre(c.solicitante):getNameByFuncionarioId(c.solicitante_id)||'—';
        const r=c.receptor?fNombre(c.receptor):getNameByFuncionarioId(c.receptor_id)||'—';
        const cid=JSON.stringify(c.id);
        parts.push(`<div style="background:var(--card);border:1px solid var(--b);border-radius:var(--r2);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px">
          <div style="flex:1">
            <div style="font-weight:700;font-size:12px;margin-bottom:2px">${esc(s)} → ${esc(r)}</div>
            <div style="font-size:11px;color:var(--t2)">${esc(c.turno_cede||'?')} ${esc(c.fecha_cede||'?')} → ${esc(c.turno_recibe||'?')} ${esc(c.fecha_recibe||'?')}</div>
            <div style="margin-top:4px"><span class="chip ca">Esperando al receptor</span></div>
          </div>
          <div style="flex-shrink:0">
            <button class="btn bd sm" onclick="rejTrd(${cid})">✕ Cancelar</button>
          </div>
        </div>`);
      });
    }
    pend.innerHTML=parts.length
      ? parts.join('')
      : '<div style="color:var(--t3);font-size:12px;padding:10px">Sin cambios pendientes</div>';
  } else {
    desc.textContent='Tus cambios de turno solicitados y recibidos.';
    pTit.textContent='Solicitudes activas';
    const active=merged.filter(r=>['pendiente','aceptado_receptor','rechazado_receptor'].includes(r.estado));
    pend.innerHTML=active.map((t,i)=>{
      const esReceptor = t.rec===myName || t.receptor_id===myFuncId;
      const esSolicitante = t.sol===myName || t.solicitante_id===myFuncId;
      const otro = esReceptor ? t.sol : t.rec;
      let badge='';
      let actions='';
      if(t.estado==='pendiente' && esReceptor){
        badge=`<span class="chip ca">🔔 Te solicitan un cambio</span>`;
        actions=t.source==='db' && t.id
          ? `<button class="btn bs sm" onclick="acceptReceptor('${t.id}')">✓ Aceptar</button>
             <button class="btn bd sm" onclick="rejectReceptor('${t.id}')">✕ Rechazar</button>`
          : `<button class="btn bs sm" onclick="acceptMyCambio(${i})">✓ Aceptar</button>
             <button class="btn bd sm" onclick="rejectMyCambio(${i})">✕ Rechazar</button>`;
      } else if(t.estado==='pendiente' && esSolicitante){
        badge=`<span class="chip ca">⏳ Esperando respuesta de ${otro}</span>`;
      } else if(t.estado==='aceptado_receptor'){
        badge=`<span class="chip cb2">✓ ${esReceptor?'Aceptaste':'Receptor aceptó'} — pend. supervisora</span>`;
      } else if(t.estado==='rechazado_receptor'){
        badge=`<span class="chip cr">${esReceptor?'Rechazaste esta solicitud':'Receptor rechazó la solicitud'}</span>`;
      }
      return `<div id="trd${i}" style="background:var(--card);border:1px solid ${t.estado==='pendiente'&&esReceptor?'var(--blue)':'var(--b)'};border-radius:var(--r2);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div style="flex:1">
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${esReceptor?`${t.sol} te solicita cambio`:`Solicitaste a ${t.rec}`}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:2px">${t.tc} → ${t.tr}</div>
          <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap">${badge}</div>
        </div>
        ${actions?`<div style="display:flex;gap:6px;flex-shrink:0">${actions}</div>`:''}
      </div>`;
    }).join('') || '<div style="color:var(--t3);font-size:12px;padding:10px">Sin solicitudes activas</div>';
  }

  const histRows=merged.filter(r=>['aprobado','rechazado','rechazado_receptor'].includes(r.estado));
  hist.innerHTML=histRows.map(h=>`
    <tr>
      <td class="mn">${h.date}</td>
      <td><strong>${h.sol}</strong></td>
      <td style="font-size:11px">${h.tc}</td>
      <td><strong>${h.rec}</strong></td>
      <td style="font-size:11px">${h.tr}</td>
      <td><span class="chip ${stChip[h.estado]||'cn'}">${stLabel[h.estado]||h.estado}</span></td>
      <td></td>
    </tr>`).join('') || '<tr><td colspan="7" style="color:var(--t3);padding:10px">Sin historial</td></tr>';
}

async function appTrd(id){
  const item = DB.cambios.find(c=>c.id===id);
  if(!item){ toast('er','Error','Cambio no encontrado'); return; }
  const solNm = item.solicitante ? fNombre(item.solicitante) : getNameByFuncionarioId(item.solicitante_id)||'Solicitante';
  const recNm = item.receptor   ? fNombre(item.receptor)   : getNameByFuncionarioId(item.receptor_id)||'Receptor';
  if(sb){
    await updateCambio(item.id, 'aprobado');
    // Swap turnos en BD
    if(item.solicitante_id && item.receptor_id && item.fecha_cede && item.fecha_recibe){
      await saveTurnosBatch([
        {funcionario_id:item.solicitante_id, fecha:item.fecha_cede,   codigo:'LXC',               nota:'Cambio turno — cede'},
        {funcionario_id:item.receptor_id,    fecha:item.fecha_cede,   codigo:item.turno_cede||'M', nota:'Cambio turno — recibe'},
        {funcionario_id:item.receptor_id,    fecha:item.fecha_recibe, codigo:'LXC',               nota:'Cambio turno — cede'},
        {funcionario_id:item.solicitante_id, fecha:item.fecha_recibe, codigo:item.turno_recibe||'M',nota:'Cambio turno — recibe'},
      ]);
    }
    await createAlerta('ok', '✅ Cambio de turno aprobado',
      `Tu cambio con ${recNm} (${item.turno_cede||'?'} ${item.fecha_cede} ↔ ${item.turno_recibe||'?'} ${item.fecha_recibe}) fue aprobado por supervisora.`,
      item.solicitante_id);
    await createAlerta('ok', '✅ Cambio de turno aprobado',
      `El cambio solicitado por ${solNm} fue aprobado. Ahora trabajás ${item.turno_cede||'?'} el ${item.fecha_cede}.`,
      item.receptor_id);
  } else {
    item.estado='aprobado';
  }
  refreshTradeBadge();
  renderTrades();
  renderAlerts();
  renderDashAlerts(); renderDashboard();
  renderCal();
  toast('ok','Cambio aprobado','Turnos intercambiados en el sistema. Ambos funcionarios notificados.');
}

async function rejTrd(id){
  const item = DB.cambios.find(c=>c.id===id);
  if(!item){ toast('er','Error','Cambio no encontrado'); return; }
  const solNm = item.solicitante ? fNombre(item.solicitante) : getNameByFuncionarioId(item.solicitante_id)||'Solicitante';
  const recNm = item.receptor   ? fNombre(item.receptor)   : getNameByFuncionarioId(item.receptor_id)||'Receptor';
  if(sb){
    await updateCambio(item.id, 'rechazado');
    await createAlerta('warning', '❌ Cambio rechazado por supervisora',
      `Tu solicitud de cambio con ${recNm} fue rechazada.`, item.solicitante_id);
    await createAlerta('warning', '❌ Cambio rechazado por supervisora',
      `El cambio solicitado por ${solNm} fue rechazado por supervisora.`, item.receptor_id);
  } else {
    item.estado='rechazado';
  }
  refreshTradeBadge();
  renderTrades();
  renderAlerts();
  renderDashAlerts(); renderDashboard();
  renderCal();
  toast('wa','Cambio rechazado','Funcionarios notificados.');
}

// Receptor acepta la solicitud → pasa a supervisora
async function acceptReceptor(cambioId){
  if(!sb){ toast('wa','Sin conexión','Requiere base de datos.'); return; }
  await updateCambio(cambioId, 'aceptado_receptor');
  const cambio = DB.cambios.find(c=>c.id===cambioId);
  if(cambio){
    const solNm = cambio.solicitante ? fNombre(cambio.solicitante) : getNameByFuncionarioId(cambio.solicitante_id)||'Solicitante';
    const recNm = cambio.receptor   ? fNombre(cambio.receptor)   : getNameByFuncionarioId(cambio.receptor_id)||'Receptor';
    await createAlerta('ok', '✅ Tu cambio fue aceptado',
      `${recNm} aceptó tu solicitud. Queda pendiente de aprobación de supervisora.`,
      cambio.solicitante_id);
    for(const supId of getSupervisorFuncionarioIds()){
      await createAlerta('info', '🔄 Cambio listo para aprobar',
        `${solNm} ↔ ${recNm} — ambos de acuerdo. ${cambio.turno_cede||'?'} ${cambio.fecha_cede} ↔ ${cambio.turno_recibe||'?'} ${cambio.fecha_recibe}`,
        supId);
    }
  }
  refreshTradeBadge();
  renderTrades();
  renderAlerts();
  renderDashAlerts(); renderDashboard();
  toast('ok','Cambio aceptado','La supervisora recibió la solicitud para aprobar.');
}

// Receptor rechaza la solicitud
async function rejectReceptor(cambioId){
  if(!sb){ toast('wa','Sin conexión','Requiere base de datos.'); return; }
  await updateCambio(cambioId, 'rechazado_receptor');
  const cambio = DB.cambios.find(c=>c.id===cambioId);
  if(cambio){
    const recNm = cambio.receptor ? fNombre(cambio.receptor) : getNameByFuncionarioId(cambio.receptor_id)||'Receptor';
    await createAlerta('warning', '❌ Tu cambio fue rechazado',
      `${recNm} rechazó tu solicitud de cambio de turno.`, cambio.solicitante_id);
  }
  refreshTradeBadge();
  renderTrades();
  renderAlerts();
  renderDashAlerts(); renderDashboard();
  toast('wa','Cambio rechazado','El solicitante fue notificado.');
}

// Demo aceptar/rechazar (sin BD)
function acceptMyCambio(i){
  const el=document.getElementById('trd'+i);
  if(el){el.style.borderColor='var(--green)';el.querySelector('div:last-child').innerHTML='<span class="chip cg">✓ Aceptado — pend. supervisora</span>';}
  toast('ok','Cambio aceptado','Pasa a aprobación de supervisora.');
}
function rejectMyCambio(i){
  const el=document.getElementById('trd'+i);
  if(el){el.style.borderColor='var(--red)';el.querySelector('div:last-child').innerHTML='<span class="chip cr">✕ Rechazado</span>';}
  toast('wa','Cambio rechazado','Se notificó al solicitante.');
}
function refreshTradeBadge(){
  const myFuncId = String(getCurrFuncionario()?.id||'');
  let cnt = 0;
  if(['admin','supervisor'].includes(cRole)){
    cnt = DB.cambios.filter(c=>c.estado==='aceptado_receptor').length;
  } else {
    cnt = DB.cambios.filter(c=>c.estado==='pendiente' && String(c.receptor_id||'')===myFuncId).length;
  }
  document.getElementById('tradeBadge').textContent = cnt||'';
}

// ........................................................
// ALERTS
// ........................................................
function renderAlerts(){
  const el=document.getElementById('alertsList');if(!el)return;
  const skip=new Set(['LAR','CERT','LE','F','DXF','CPL','E','LX1','LX2','LX3','LX4','LXE','NO CONVOCAR','MAT','PAT']);
  const items=[];

  if(dbLoaded){
    if(['admin','supervisor'].includes(cRole)){
      // 7ª guardia: verificar días CONSECUTIVOS (no total mensual)
      DB.funcionarios.forEach(f=>{
        const _hoy2=new Date().toISOString().slice(0,10);
        const _desde2=new Date(Date.now()-45*86400000).toISOString().slice(0,10);
        const _hace3b=new Date(Date.now()-3*86400000).toISOString().slice(0,10);
        const wk=DB.turnos.filter(t=>t.funcionario_id===f.id&&t.codigo&&!skip.has(t.codigo)&&t.fecha>=_desde2).map(t=>t.fecha).sort();
        let maxC=wk.length?1:0,cur=1,maxEnd2=wk[0]||'';
        for(let i=1;i<wk.length;i++){
          const diff=Math.round((new Date(wk[i]+'T12:00:00')-new Date(wk[i-1]+'T12:00:00'))/86400000);
          cur=diff===1?cur+1:1;if(cur>maxC){maxC=cur;maxEnd2=wk[i];}
        }
        if(maxC>=7&&maxEnd2>=_hace3b) items.push({t:'cr2',ic:'🚨',
          title:`7ª Guardia consecutiva — ${fNombre(f)} (${f.sector?.nombre||''})`,
          desc:`${maxC} días seguidos sin descanso · genera horas extra obligatorias`,
          meta:f.clinica?.nombre||'',
          btn:`<button class="btn bp xs" onclick="toast('ok','Registrado','Confirmado en RRHH')">Confirmar</button>`
        });
      });
      // Vacantes sin suplente — agrupadas
      const hoy2=new Date().toISOString().slice(0,10);
      const _planKeys2=new Set((GENS||[]).map(g=>getGeneratedMonthKey(g)).filter(Boolean));
      const vacsSinCub=DB.licencias.filter(l=>{
        if(!l.genera_vacante||l.suplente_id||!['activa','pendiente'].includes(l.estado)) return false;
        if((l.fecha_hasta||'')<hoy2) return false;
        if(_planKeys2.size===0) return true;
        const licMes=(l.fecha_desde||'').slice(0,7);
        const activa=l.fecha_desde<=hoy2&&l.fecha_hasta>=hoy2;
        return activa||_planKeys2.has(licMes);
      });
      if(vacsSinCub.length) items.push({t:'wa',ic:'⚠️',
        title:`${vacsSinCub.length} vacante${vacsSinCub.length>1?'s':''} sin suplente`,
        desc:vacsSinCub.slice(0,3).map(l=>`${l.funcionario?fNombre(l.funcionario):'—'} · ${l.tipo} · ${l.fecha_desde}`).join(' · '),
        meta:'Sin suplente asignado',
        btn:`<button class="btn bp xs" onclick="go('licenses')">Asignar</button>`
      });
      // Cambios aceptados por receptor — requieren aprobación supervisor
      const pCambios=DB.cambios.filter(x=>x.estado==='aceptado_receptor');
      if(pCambios.length) items.push({t:'wa',ic:'🔄',
        title:`${pCambios.length} cambio${pCambios.length>1?'s':''} listo${pCambios.length>1?'s':''} para aprobar`,
        desc:pCambios.slice(0,3).map(x=>`${x.solicitante?fNombre(x.solicitante):'—'} — ${x.receptor?fNombre(x.receptor):'—'}`).join(' · '),
        meta:'Ambas partes aceptaron — requieren tu aprobación final',
        btn:`<button class="btn bp xs" onclick="go('trades')">Ver cambios</button>`
      });
      // Licencias pendientes
      const _hoyP=new Date().toISOString().slice(0,10);
      const pLics=DB.licencias.filter(l=>l.estado==='pendiente'&&(l.fecha_hasta||'')>=_hoyP);
      if(pLics.length) items.push({t:'in',ic:'📋',
        title:`${pLics.length} licencia${pLics.length>1?'s':''} pendiente${pLics.length>1?'s':''} de aprobación`,
        desc:pLics.map(l=>l.funcionario?fNombre(l.funcionario):'—').slice(0,3).join(', '),
        meta:'',
        btn:`<button class="btn bp xs" onclick="go('licenses')">Ver</button>`
      });
    } else {
      // Enfermería: cambios donde participa (como receptor o solicitante)
      const myFuncId2=String(getCurrFuncionario()?.id||'');
      const myNm=cUser?.name||'';
      // Incoming: soy receptor y está pendiente → botón para ir a aceptar/rechazar
      const incoming=DB.cambios.filter(x=>x.estado==='pendiente'&&String(x.receptor_id||'')===myFuncId2);
      incoming.forEach(x=>{
        items.push({t:'wa',ic:'🔄',
          title:'Te proponen un cambio de turno',
          desc:`${x.solicitante?fNombre(x.solicitante):'—'} solicita: ${x.turno_cede||'?'} ${x.fecha_cede||''} ↔ ${x.turno_recibe||'?'} ${x.fecha_recibe||''}`,
          meta:'Requiere tu aceptación',
          btn:`<button class="btn bp xs" onclick="go('trades')">Responder</button>`
        });
      });
      // Outgoing: mis solicitudes en curso
      const outgoing=DB.cambios.filter(x=>['pendiente','aceptado_receptor'].includes(x.estado||'')&&String(x.solicitante_id||'')===myFuncId2);
      outgoing.forEach(x=>{
        const lbl=x.estado==='aceptado_receptor'?'Aceptado — pend. aprobación':'Pendiente de aceptación';
        items.push({t:'in',ic:'🔄',
          title:`Tu solicitud: ${lbl}`,
          desc:`Con ${x.receptor?fNombre(x.receptor):'—'} · ${x.turno_cede||'?'} ${x.fecha_cede||''} ↔ ${x.turno_recibe||'?'} ${x.fecha_recibe||''}`,
          meta:'',btn:''
        });
      });
    }
    // DB alerts (from alertas table) — personales o broadcast
    const myFuncId3=String(getCurrFuncionario()?.id||'');
    const esSupAdm=['admin','supervisor'].includes(cRole);
    DB.alertas.filter(a=>!a.leida&&(!a.funcionario_id||String(a.funcionario_id)===myFuncId3)&&(esSupAdm||!String(a.tipo||'').startsWith('ingreso_'))).forEach(a=>{
      items.push({
        t:a.tipo==='critica'?'cr2':a.tipo==='warning'?'wa':a.tipo==='ok'?'ok':'in',
        ic:a.tipo==='critica'?'🚨':a.tipo==='warning'?'⚠️':'ℹ️',
        title:a.titulo||'Alerta', desc:a.descripcion||'',
        meta:new Date(a.created_at).toLocaleString('es-UY'), btn:''
      });
    });
  } else {
    items.push({t:'in',ic:'⏳',title:'Cargando alertas...', desc:'Conectando con base de datos',meta:'',btn:''});
  }

  const visible=items.filter((_,i)=>!DISMISSED_ALERTS.has(cRole+'_'+i));
  el.innerHTML=visible.length
    ?visible.map((a,i)=>`<div class="ai ${a.t}" id="alert_${i}">
        <span style="font-size:17px;flex-shrink:0;margin-top:1px">${a.ic}</span>
        <div style="flex:1"><div class="ai-t">${a.title}</div><div class="ai-d">${a.desc}</div>${a.meta?`<div class="ai-m">${a.meta}</div>`:''}</div>
        ${a.btn?`<div style="flex-shrink:0">${a.btn}</div>`:''}
      </div>`).join('')
    :'<div style="color:var(--t3);font-size:12px;padding:20px;text-align:center">✓ Sin alertas pendientes</div>';
  updateAlertBadge();
}

// My license modal for nurse (doesn't go to full licenses view)
let MY_LICS = [];

function openMyLicModal(){
  const existing=document.getElementById('myLicOv');
  if(existing) existing.remove();
  const ov=document.createElement('div');
  ov.id='myLicOv'; ov.className='ov open';
  ov.innerHTML=`<div class="modal" style="width:440px">
    <div class="mh"><div class="mh-t">📋 Solicitar Licencia</div><button class="mh-x" onclick="document.getElementById('myLicOv').remove()">✕</button></div>
    <div class="mb">
      <div style="background:var(--bdim);border:1px solid rgba(61,127,255,.2);border-radius:var(--r);padding:10px;margin-bottom:14px;font-size:11px;color:var(--t2)">
        Funcionaria: <strong style="color:var(--text)">${cUser.name}</strong> · ${cUser.sector}
      </div>
      <div class="fg"><label>Tipo de licencia</label>
        <select id="myLicTipo" style="width:100%;background:var(--bg3);border:1px solid var(--b);color:var(--text);padding:9px;border-radius:var(--r);font-size:12.5px">
          <option value="LAR">LAR — Licencia Anual Reglamentaria</option>
          <option value="LE">LE — Libre Especial</option>
          <option value="CERT">CERT — Certificación médica</option>
          <option value="CPL">CPL — Cumpleaños (½ guardia)</option>
          <option value="DXF">DXF — Día por feriado</option>
        </select>
      </div>
      <div class="fr"><div class="fg"><label>Desde</label><input id="myLicDesde" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;background:var(--bg3);border:1px solid var(--b);color:var(--text);padding:9px;border-radius:var(--r);font-size:12.5px"></div>
      <div class="fg"><label>Hasta</label><input id="myLicHasta" type="date" value="${new Date().toISOString().slice(0,10)}" style="width:100%;background:var(--bg3);border:1px solid var(--b);color:var(--text);padding:9px;border-radius:var(--r);font-size:12.5px"></div></div>
      <div class="fg"><label>Observaciones</label><input id="myLicObs" type="text" placeholder="Motivo o notas..." style="width:100%;background:var(--bg3);border:1px solid var(--b);color:var(--text);padding:9px;border-radius:var(--r);font-size:12.5px"></div>
    </div>
    <div class="mf">
      <button class="btn bg" onclick="document.getElementById('myLicOv').remove()">Cancelar</button>
      <button class="btn bp" onclick="submitMyLic()">📨 Enviar Solicitud</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
}

async function submitMyLic(){
  const tipo  = document.getElementById('myLicTipo')?.value||'LAR';
  const desde = document.getElementById('myLicDesde')?.value;
  const hasta = document.getElementById('myLicHasta')?.value;
  const obs   = document.getElementById('myLicObs')?.value||'';
  if(!desde||!hasta){ toast('wa','Completá las fechas',''); return; }
  const days = Math.max(1,Math.round((new Date(hasta)-new Date(desde))/86400000)+1);
  // Add to nurse view list
  MY_LICS.unshift({tipo, dias:`${desde.split('-').reverse().slice(0,2).join('/')} (${days} día${days>1?'s':''})`, estado:'pendiente', chip:'ca'});
  refreshMyLicBody();
  // Save to Supabase — saveLicencia pushes to LIC_DATA automatically
  if(sb){
    const emp=[...DB.funcionarios,...DB.suplentes].find(f=>fNombre(f)===cUser.name)||DB.funcionarios[2];
    const res = await saveLicencia({funcionario_id:emp?.id||1,tipo,fecha_desde:desde,fecha_hasta:hasta,genera_vacante:false,observaciones:obs,estado:'pendiente'});
    if(res){
      // Remove the local MY_LICS entry added above to avoid dupe — saveLicencia already synced to LIC_DATA
      // Keep MY_LICS for nurse's own mini-view (different list)
    }
  } else {
    // No Supabase — MY_LICS already added, nothing else needed
  }
  document.getElementById('myLicOv')?.remove();
  toast('ok','Solicitud enviada','Tu licencia quedó pendiente de aprobación.');
}

function refreshMyLicBody(){
  const tbody=document.getElementById('myLicBody');
  if(!tbody) return;
  tbody.innerHTML=MY_LICS.map(l=>`
    <tr><td><span class="chip cb2">${l.tipo}</span></td><td>${l.dias}</td><td><span class="chip ${l.chip}">${l.estado==='aprobada'?'Aprobada':l.estado==='pendiente'?'Pend. aprobación':'—'}</span></td></tr>`).join('');
}

// Assign suplente modal
function openAssignModal(sector, fecha){
  // Armar lista de suplentes ordenada por score (misma lógica que getSuplenteSugeridos)
  const subs = dbLoaded && DB.suplentes.length ? DB.suplentes : SUBS;
  // Obtener la licencia actual para scoring
  const licActual = window._licId ? DB.licencias.find(l=>l.id===window._licId) : null;
  const empSector = licActual?.funcionario?.sector?.nombre||sector||'';
  const empClinica= licActual?.funcionario?.clinica?.nombre||'';
  const skip2=new Set(['LAR','CERT','LE','F','DXF','CPL','E','LX1','LX2','LX3','LX4','LXE','NO CONVOCAR','MAT','PAT']);
  const scored = subs.filter(s=>s.activo!==false).map(s=>{
    const ss=s.sector?.nombre||''; const sc=s.clinica?.nombre||'';
    const same=ss===empSector||sc===empClinica?2:0;
    const g=DB.turnos.filter(t=>t.funcionario_id===s.id&&t.codigo&&!skip2.has(t.codigo)).length;
    return {...s, _score:same-g*0.01};
  }).sort((a,b)=>b._score-a._score);
  const opts = scored.map((s,i)=>{
    const nm = s.apellido ? `${s.apellido}, ${s.nombre}` : s.name||'—';
    const sec2 = s.sector?.nombre||s.clinica?.nombre||'';
    const g = DB.turnos.filter(t=>t.funcionario_id===s.id&&t.codigo&&!skip2.has(t.codigo)).length;
    return `<option value="${s.id||i}">${nm}${sec2?' · '+sec2:''}${g?' ('+g+' gd)':''}</option>`;
  }).join('');
  // Build inline modal
  const existing = document.getElementById('assignOv');
  if(existing) existing.remove();
  const ov = document.createElement('div');
  ov.id='assignOv';
  ov.className='ov open';
  ov.innerHTML=`<div class="modal" style="width:420px">
    <div class="mh"><div class="mh-t">👤 Asignar Suplente — ${sector}</div><button class="mh-x" onclick="document.getElementById('assignOv').remove()">✕</button></div>
    <div class="mb">
      <div style="background:var(--adim);border:1px solid rgba(245,166,35,.3);border-radius:var(--r);padding:11px;margin-bottom:14px;font-size:11px;color:var(--amber)">
        <strong>Vacante:</strong> ${sector} · ${fecha} · Falta imprevista
      </div>
      <div class="fg"><label>Suplente sugerido (podés cambiar)</label>
        <select id="asgSub" style="background:var(--bg3);border:1px solid var(--blue);color:var(--text);padding:9px;border-radius:var(--r);font-size:12.5px;width:100%">${opts}</select>
      </div>
      <div class="fg"><label>Turno a cubrir</label>
        <select id="asgCode" style="background:var(--bg3);border:1px solid var(--b);color:var(--text);padding:9px;border-radius:var(--r);font-size:12.5px;width:100%">
          <option value="M">M — Mañana (06:00—12:00)</option>
          <option value="TS">TS — Tarde (12:00—18:00)</option>
          <option value="NO">NO — Noche (00:00—06:00)</option>
        </select>
      </div>
      <div class="fg"><label>Nota</label><input id="asgNota" type="text" placeholder="Observaciones opcionales..." style="background:var(--bg3);border:1px solid var(--b);color:var(--text);padding:9px;border-radius:var(--r);font-size:12.5px;width:100%"></div>
    </div>
    <div class="mf">
      <button class="btn bg" onclick="document.getElementById('assignOv').remove()">Cancelar</button>
      <button class="btn bp" onclick="confirmAssign('${sector}','${fecha}')">✓ Confirmar Asignación</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
}

async function confirmAssign(sector, fecha){
  // El select ahora usa el ID del suplente como value
  const supId  = document.getElementById('asgSub')?.value;
  const code   = document.getElementById('asgCode')?.value||'M';
  const nota   = document.getElementById('asgNota')?.value||'';
  const subs   = dbLoaded && DB.suplentes.length ? DB.suplentes : SUBS;
  const sub    = subs.find(s=>String(s.id)===String(supId)) || subs[0];
  const subNm  = sub?.apellido ? `${sub.apellido}, ${sub.nombre}` : sub?.name||'—';

  // Guardar turnos del suplente para el rango de la licencia
  if(sb && sub?.id){
    const licId  = window._licId;
    const dbLic  = licId ? DB.licencias.find(l=>l.id===licId) : null;
    if(dbLic){
      // Guardar un turno por cada día del período de la licencia
      const from = new Date(dbLic.fecha_desde+'T12:00:00');
      const to   = new Date(dbLic.fecha_hasta+'T12:00:00');
      for(let d=new Date(from.getTime()); d<=to; d.setDate(d.getDate()+1)){
        await saveTurno(sub.id, d.toISOString().slice(0,10), code, null, nota||`Cubre vacante ${sector}`);
      }
    } else {
      const dateStr = fecha.includes('-') ? fecha : `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${fecha.split('/')[0].padStart(2,'0')}`;
      await saveTurno(sub.id, dateStr, code, null, nota||`Cubre vacante ${sector}`);
    }
  }

  document.getElementById('assignOv')?.remove();

  // Actualizar DB.licencias en memoria y Supabase
  const licId = window._licId;
  if(licId != null){
    const dbLic = DB.licencias.find(l=>l.id===licId);
    if(dbLic){
      dbLic.suplente_id = sub?.id;
      dbLic.estado      = 'activa';
      if(sub) dbLic.suplente = {apellido:sub.apellido||'', nombre:sub.nombre||''};
    }
    if(sb && sub?.id){
      await sb.from('licencias').update({suplente_id:sub.id, estado:'activa'}).eq('id',licId);
    }
    window._licId = null;
  }

  if(window._alertRemoveIdx != null){
    dismissAlert(window._alertRemoveIdx);
    window._alertRemoveIdx = null;
  }

  renderAlerts();
  renderLics();
  renderCobertura();
  toast('ok',`${subNm} asignado/a`,`Cubrirá ${sector} · ${fecha} · Código: ${code}`);
}


async function approveLic(idx){
  if(LIC_DATA[idx]){
    LIC_DATA[idx].st='active';
    if(sb && LIC_DATA[idx].id) await sb.from('licencias').update({estado:'activa'}).eq('id',LIC_DATA[idx].id);
    renderLics();
    toast('ok','Licencia aprobada',LIC_DATA[idx].emp);
  }
}
async function rejectLic(idx){
  if(LIC_DATA[idx]){
    if(sb && LIC_DATA[idx].id) await sb.from('licencias').update({estado:'cancelada'}).eq('id',LIC_DATA[idx].id);
    LIC_DATA.splice(idx,1);
    renderLics();
    toast('wa','Licencia rechazada','Funcionario notificado.');
  }
}

function openAssignFromLic(licId, sector, fecha){
  window._licId = licId;       // UUID de la licencia
  window._alertRemoveIdx = null;
  openAssignModal(sector, fecha);
}

function openAssignFromAlert(alertIdx, sector, fecha){
  window._licId = null;
  window._alertRemoveIdx = alertIdx;
  openAssignModal(sector, fecha);
}

function approveCambioFromAlert(alertIdx){
  dismissAlert(alertIdx);
  const pending = DB.cambios.filter(c=>c.estado==='aceptado_receptor');
  if(pending.length) appTrd(pending[0].id);
  else toast('ok','Sin cambios listos para aprobar','Revisá la sección Cambios de Turno');
}

function confirmSeptimaFromAlert(alertIdx){
  dismissAlert(alertIdx);
  toast('ok','7ª guardia confirmada','Horas extra registradas en RRHH.');
}

async function markRead(){
  if(sb){ await marcarAlertasLeidas(); }
  // Dismiss all current role alerts
  const ALL_COUNTS = {admin:5, supervisor:4, nurse:3};
  const total = ALL_COUNTS[cRole]||5;
  for(let i=0;i<total;i++) DISMISSED_ALERTS.add(cRole+'_'+i);
  // Dismiss all dashboard computed alerts
  ['vac','chg'].forEach(k=>DISMISSED_DASH.add(k));
  DB.funcionarios.forEach(f=>DISMISSED_DASH.add('7g_'+f.id));
  renderDashAlerts(); renderDashboard();
  document.querySelectorAll('#alertsList .ai').forEach((el,i)=>{
    setTimeout(()=>{ el.style.animation='fadeOut .3s ease forwards'; setTimeout(()=>el.remove(),310); }, i*60);
  });
  document.getElementById('alertBadge').textContent='';
  document.getElementById('topAlerts').textContent='0';
  setTimeout(()=>{
    const cont=document.getElementById('alertsList');
    if(cont) cont.innerHTML='<div style="color:var(--t3);font-size:12px;padding:20px;text-align:center">✓ Sin alertas pendientes</div>';
  }, 500);
  toast('ok','Alertas marcadas como leídas','Centro de alertas actualizado.');
}


// ........................................................
// GENERATION STATE
// ........................................................
let GENS = [];
function saveGENS(){ /* no-op: generaciones persisted via Supabase */ }
function loadGENS(){
  const rows = DB.generaciones || [];
  GENS.splice(0, GENS.length, ...rows.map(g=>({
    id:      g.id,
    mes:     g.mes,
    mesNum:  g.mes_num,
    anio:    g.anio,
    estado:  g.estado,
    func:    g.func_count,
    alertas: g.alertas_7,
    fecha:   g.created_at ? new Date(g.created_at).toLocaleDateString('es-UY') : '—',
  })));
}
loadGENS();

// Current gen being built (not yet approved)
let DRAFT_GEN = null;
// License state (persists across re-renders)
let LIC_DATA = [];
let _licIdCounter = 100;
// Users state
let USERS_DATA = [];
// My cambios state (for nurse view)
// Pending shift changes (for schedule grid refresh)
let SHIFT_CHANGES = {}; // {empName_date: code}
function setShiftChange(emp, date, code){ SHIFT_CHANGES[`${emp}_${date}`]=code; }
function getShiftChange(emp, date){ return SHIFT_CHANGES[`${emp}_${date}`]||null; }

let MY_CAMBIOS = [];
// Alerts dismissed this session (survive re-renders)
const DISMISSED_ALERTS = new Set();
// Dashboard computed alerts dismissed this session
const DISMISSED_DASH = new Set();
function dismissDashAlert(key){
  DISMISSED_DASH.add(key);
  const el=document.getElementById('dai_'+key);
  if(el){ el.style.animation='fadeOut .3s ease forwards'; setTimeout(()=>{ el.remove(); },310); }
}

function dismissAlert(alertIdx){
  DISMISSED_ALERTS.add(cRole+'_'+alertIdx);
  const el = document.getElementById('alert_'+alertIdx);
  if(el){ el.style.animation='fadeOut .4s ease forwards'; setTimeout(()=>{ el.remove(); updateAlertBadge(); },400); }
  // If this index corresponds to a DB alert, mark it as leida in Supabase
  // DB alerts are prepended first: index < DB.alertas.length
  if(sb && alertIdx < DB.alertas.length){
    const dbAlert = DB.alertas[alertIdx];
    if(dbAlert?.id){
      sb.from('alertas').update({leida:true}).eq('id',dbAlert.id)
        .then(({error})=>{ if(error) console.error('Error marking alert read:', error); });
      DB.alertas[alertIdx] = {...dbAlert, leida:true};
    }
  }
}
function updateAlertBadge(){
  const el=document.getElementById('alertsList');
  const cnt=el?el.querySelectorAll('.ai').length:0;
  const ab=document.getElementById('alertBadge'); if(ab) ab.textContent=cnt||'';
  const ta=document.getElementById('topAlerts');  if(ta) ta.textContent=cnt||'0';
}


// ........................................................
// GENERATION
// ........................................................
const GSTEPS=[
  'Cargar regímenes y licencias del mes',
  'Generar turnos por patrón (fijos)',
  'Detectar 7ª guardia consecutiva',
  'Detectar vacantes sin cobertura',
  'Sugerir y asignar suplentes automáticamente',
  'Guardar en base de datos',
  'Generar turnos de cobertura (suplentes)',
  'Crear registro de generación',
];

// Etiqueta de display para una generación — maneja mes como texto O como entero legacy
function genLabel(g){
  if(!g) return '—';
  if(g.mes && isNaN(Number(g.mes))) return g.mes; // ya es texto "Mayo 2026"
  const mo = g.mesNum || Number(g.mes);
  const yr = g.anio;
  if(mo && yr) return getMonthLabel(yr, mo-1);
  return String(g.mes||'—');
}

function getGeneratedMonthKey(g){
  if(g?.anio && Number.isInteger(g?.mesNum)) return `${g.anio}-${String(g.mesNum).padStart(2,'0')}`;
  // Fallback: mes almacenado como entero legacy
  if(g?.anio && !isNaN(Number(g?.mes))){
    return `${g.anio}-${String(Number(g.mes)).padStart(2,'0')}`;
  }
  const p=parseMesLabel(g?.mes||'');
  if(!p) return null;
  return `${p.year}-${String(p.month+1).padStart(2,'0')}`;
}

function ymLabelFromKey(k){
  const m=String(k||'').match(/^(\d{4})-(\d{2})$/);
  if(!m) return null;
  const y=parseInt(m[1],10), mo=parseInt(m[2],10)-1;
  return {year:y,month:mo,label:getMonthLabel(y,mo)};
}

function populateGenMesOptions(){
  const sel=document.getElementById('genMes');
  if(!sel) return;
  const prev=sel.value;
  const generated=new Set((GENS||[]).map(getGeneratedMonthKey).filter(Boolean));
  const months=[];
  // Siempre empezar desde el mes actual — nunca mostrar meses pasados
  const now=new Date();
  let y=now.getUTCFullYear(), m=now.getUTCMonth(); // 0-indexed
  for(let i=0;i<12;i++){
    const key=`${y}-${String(m+1).padStart(2,'0')}`;
    if(!generated.has(key)) months.push({key,label:getMonthLabel(y,m)});
    m++;
    if(m>11){ m=0; y++; }
  }
  if(!months.length){
    // Todos los próximos meses ya generados — ofrecer el mes 13 adelante
    months.push({key:`${y}-${String(m+1).padStart(2,'0')}`,label:getMonthLabel(y,m)});
  }
  sel.innerHTML=months.map(mo=>`<option value="${mo.label}">${mo.label}</option>`).join('');
  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value=prev;
}

async function startGen(){
  if(cRole !== 'admin'){ toast('wa','Sin permiso','Solo el administrador puede generar planillas'); return; }
  if(!dbLoaded || !DB.funcionarios.length){
    toast('wa','Sin datos','Sincronizá la base de datos primero.'); return;
  }
  const _now=new Date();
  const mesVal=document.getElementById('genMes')?.value||`${['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][_now.getMonth()]} ${_now.getFullYear()}`;
  const parsed=parseMesLabel(mesVal)||{year:_now.getFullYear(),month:_now.getMonth()};
  if(GENS.find(g=>g.mes===mesVal&&g.estado!=='cancelada')){
    toast('wa','Ya existe','Este mes ya fue generado. Buscalo en el historial para validar.'); return;
  }

  document.getElementById('genIdle').style.display='none';
  document.getElementById('genRun').classList.remove('gone');
  const steps_gen=GSTEPS.slice(0,8);
  const sd=document.getElementById('genSteps');
  sd.innerHTML=steps_gen.map((_,i)=>`<div class="genstep" id="gs${i}"><span class="gsic">○</span>${_}</div>`).join('');

  const markStep=async i=>{
    if(i>0){const p=document.getElementById(`gs${i-1}`);if(p){p.className='genstep done';p.querySelector('.gsic').textContent='✓';}}
    const el=document.getElementById(`gs${i}`);
    if(el){el.className='genstep run';el.querySelector('.gsic').textContent='⟳';}
    document.getElementById('genStatus').textContent=(steps_gen[i]||'Procesando')+'...';
    await new Promise(r=>setTimeout(r,30)); // yield to allow UI repaint
  };

  const {year,month}=parsed;
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const primerDia=`${year}-${String(month+1).padStart(2,'0')}-01`;
  const mesTo=`${year}-${String(month+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;

  // Step 0: Cargar regímenes y licencias
  await markStep(0);
  const records=[];
  let alert7=0, cmpCount=0;

  // Step 1: Generar turnos por patrón (fijos)
  await markStep(1);
  for(const f of DB.funcionarios){
    const ph=getPatronVigente(f.id, primerDia);
    const patron     =(ph?.patron)    ||f.patron    ||'LV';
    const cicloRef   =(ph?.ciclo_ref) ||f.ciclo_ref ||null;
    const turnoBase  =(ph?.turno_fijo)||f.turno_fijo||'M';
    const turnoCiclo =ph?.turno_ciclo?.length?[...ph.turno_ciclo]:(f.turno_ciclo?.length?[...f.turno_ciclo]:null);
    const turnoSemana=(ph?.turno_semana)||f.turno_semana||{};
    const turnoSab   =f.turno_sabado||null;
    const turnoDom   =f.turno_domingo||null;
    const sectorId   =f.sector_id||null;
    const bdayDate=f.fecha_nacimiento?new Date(f.fecha_nacimiento+'T12:00:00'):null;
    const bdayDay=bdayDate&&bdayDate.getUTCMonth()===month?bdayDate.getUTCDate():null;
    const cycleLen=(patron==='4x1'?5:7);
    const cr=cicloRef?new Date(cicloRef+'T12:00:00'):null;
    let consec=0, bad7=false;
    for(let d=1;d<=daysInMonth;d++){
      const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const lic=getLicenciaCodeForDate(f.id,dateStr);
      if(lic){consec=0;continue;}
      if(isWorkDay(patron,cicloRef,dateStr)){
        const wd=(new Date(dateStr+'T12:00:00').getUTCDay()+6)%7;
        const isSat=(wd===5), isSun=(wd===6);
        const isBday=(bdayDay!==null && d===bdayDay);
        let turnoCode;
        if(isBday){
          turnoCode='CMP'; cmpCount++;
        } else {
          const isoWd=(isSun?7:wd+1);
          const semOverride=turnoSemana[String(isoWd)];
          if(semOverride){
            turnoCode=semOverride;
          } else if(turnoCiclo){
            const off=cr?Math.round((new Date(dateStr+'T12:00:00')-cr)/86400000)%cycleLen:0;
            const offNorm=((off%turnoCiclo.length)+turnoCiclo.length)%turnoCiclo.length;
            turnoCode=turnoCiclo[offNorm]||turnoBase;
          } else if(isSun&&turnoDom){
            turnoCode=turnoDom;
          } else if(isSat&&turnoSab){
            turnoCode=turnoSab;
          } else {
            turnoCode=turnoBase;
          }
        }
        records.push({funcionario_id:f.id,fecha:dateStr,codigo:turnoCode,sector_id:sectorId});
        consec++; if(consec>=7) bad7=true;
      } else {
        consec=0;
      }
    }
    if(bad7) alert7++;
  }

  // Step 2: Detectar 7ª guardia consecutiva
  await markStep(2);

  // Step 3: Detectar vacantes sin cobertura
  await markStep(3);
  const vacantesSinSuplente=(DB.licencias||[]).filter(l=>
    l.genera_vacante && !l.suplente_id &&
    ['activa','pendiente'].includes(l.estado) &&
    (l.fecha_hasta||'')>=primerDia && (l.fecha_desde||'')<=mesTo
  );
  document.getElementById('genStatus').textContent=
    `Vacantes en el mes: ${vacantesSinSuplente.length} · Suplentes disponibles en BD: ${DB.suplentes.filter(s=>s.activo!==false).length}`;
  await new Promise(r=>setTimeout(r,600));

  // Step 4: Revisar y asignar suplentes
  await markStep(4);
  let autoAssignCount=0;
  if(vacantesSinSuplente.length && DB.suplentes.filter(s=>s.activo!==false).length){
    // Pausa la generación y muestra modal de revisión
    document.getElementById('genStatus').textContent='Revisá las asignaciones de suplentes en el modal...';
    const assignments=await _showSuplenteModal(vacantesSinSuplente, mesVal);
    for(const {licId,supId,supNombre} of assignments){
      await _asignarSuplenteLicSilent(licId, supId, supNombre);
      autoAssignCount++;
    }
    document.getElementById('genStatus').textContent=
      autoAssignCount?`${autoAssignCount} suplente${autoAssignCount>1?'s':''} asignado${autoAssignCount>1?'s':''}`:
      'Sin suplentes asignados — podés asignarlos desde Licencias';
    await new Promise(r=>setTimeout(r,400));
  } else if(!vacantesSinSuplente.length){
    document.getElementById('genStatus').textContent='Sin vacantes pendientes de cobertura en este mes';
    await new Promise(r=>setTimeout(r,400));
  } else {
    document.getElementById('genStatus').textContent='Sin suplentes disponibles en BD para asignar';
    await new Promise(r=>setTimeout(r,400));
  }

  // Step 5: Guardar en base de datos
  await markStep(5);
  const BATCH=500;
  for(let i=0;i<records.length;i+=BATCH){
    const ok=await saveTurnosBatch(records.slice(i,i+BATCH));
    if(!ok) break;
  }

  // Step 6: Generar turnos de cobertura (suplentes)
  await markStep(6);
  const licsConSuplente=(DB.licencias||[]).filter(l=>
    l.suplente_id && l.genera_vacante && l.estado!=='cancelada' &&
    (l.fecha_desde||'')<=mesTo && (l.fecha_hasta||'')>=primerDia
  );
  let supCount=0;
  for(const lic of licsConSuplente) supCount+=await generateSuplenteTurnos(lic);

  // Step 7: Crear registro de generación
  await markStep(7);
  let genId=null;
  if(sb){
    const savedGen=await saveGeneracion({
      mes:mesVal, mes_num:month+1, anio:year, estado:'borrador',
      func_count:DB.funcionarios.length, alertas_7:alert7,
      created_by:cUser?.name||''
    });
    genId=savedGen?.id||null;
  }

  await new Promise(r=>setTimeout(r,300));
  for(let i=0;i<8;i++){const p=document.getElementById(`gs${i}`);if(p){p.className='genstep done';p.querySelector('.gsic').textContent='✓';}}
  document.getElementById('genRun').classList.add('gone');
  document.getElementById('genIdle').style.display='block';

  DRAFT_GEN={id:genId||Date.now(),mes:mesVal,mesNum:month+1,anio:year,
    func:DB.funcionarios.length,alertas:alert7,estado:'borrador',
    fecha:new Date().toLocaleDateString('es-UY')};
  GENS.unshift(DRAFT_GEN);
  renderGenHistory();
  populateSendMes();
  populateGenMesOptions();
  // Solo sincronizar con BD si el registro se persistió correctamente.
  // Si saveGeneracion falló, conservar DRAFT_GEN en memoria para esta sesión.
  if(genId){
    await loadDB();
    renderGenHistory();
    ensureScheduleMonthSel();
  } else if(sb){
    // La persistencia falló — avisar y mantener estado local
    toast('wa','Generación local solamente',
      'El registro no se pudo guardar en BD. Corré el ALTER TABLE en Supabase y regenerá.');
  }
  const autoMsg=autoAssignCount?` · 🧑‍⚕️ ${autoAssignCount} suplente${autoAssignCount>1?'s':''} asignado${autoAssignCount>1?'s':''}`:'';
  const supMsg=supCount?` · ${supCount} turnos cobertura`:'';
  toast('ok',`${mesVal} generado — ${records.length} turnos · ${alert7} alertas 7ª guardia${cmpCount?` · 🎂 ${cmpCount} cumpleaños`:''}${autoMsg}${supMsg}`,
    'Revisá la planilla, editá si necesario, luego aprobá para enviar agendas.');
}

function renderGenHistory(){
  const tbody = document.getElementById('genHistBody');
  if(!tbody) return;
  populateGenMesOptions();

  // Filas de generaciones registradas
  const genRows = GENS.map((g,i)=>{
    const stChip = {
      aprobada: '<span class="chip cg">Aprobada ✓</span>',
      borrador: '<span class="chip ca">Borrador — pendiente validación</span>',
      cancelada:'<span class="chip cr">Cancelada</span>',
    }[g.estado]||'<span class="chip cn">—</span>';
    const actions = g.estado==='borrador'
      ? `<button class="btn bg xs" onclick="previewGen(${i})">👁 Ver</button>
         <button class="btn bg xs" onclick="downloadGenXLSX(${i})">⬇ Excel</button>
         <button class="btn bp xs" onclick="openValidate(${i})">✓ Validar</button>
         <button class="btn bd xs" onclick="deleteGen(${i})" title="Eliminar esta generación y sus turnos">🗑</button>`
      : `<button class="btn bg xs" onclick="previewGen(${i})">👁 Ver</button>
         <button class="btn bg xs" onclick="downloadGenXLSX(${i})">⬇ Excel</button>
         <button class="btn bd xs" onclick="deleteGen(${i})" title="Eliminar esta generación y sus turnos">🗑</button>`;
    return `<tr>
      <td class="mn">${g.fecha}</td>
      <td><strong>${genLabel(g)}</strong></td>
      <td>Todas</td>
      <td>${g.func}</td>
      <td><span class="chip ${g.alertas>0?'ca':'cn'}">${g.alertas>0?g.alertas+' alertas':'Sin alertas'}</span></td>
      <td>${stChip}</td>
      <td style="display:flex;gap:5px">${actions}</td>
    </tr>`;
  }).join('');

  // Meses huérfanos: tienen turnos en DB pero sin registro en generaciones
  const genMonthKeys = new Set((GENS||[]).map(g=>{
    const k=getGeneratedMonthKey(g); if(!k) return null;
    return k; // "yyyy-MM" 1-indexed
  }).filter(Boolean));

  const orphanKeys = new Set();
  const orphanRows = [];
  (DB.turnos||[]).forEach(t=>{
    const d = new Date(`${t.fecha}T12:00:00`);
    if(Number.isNaN(d.getTime())) return;
    const y = d.getUTCFullYear(), m = d.getUTCMonth()+1;
    const k = `${y}-${String(m).padStart(2,'0')}`;
    if(!genMonthKeys.has(k) && !orphanKeys.has(k)){
      orphanKeys.add(k);
      const label = getMonthLabel(y, m-1);
      orphanRows.push(`<tr style="opacity:.75">
        <td class="mn">—</td>
        <td><strong>${label}</strong></td>
        <td>—</td><td>—</td>
        <td>—</td>
        <td><span class="chip" style="background:var(--bdim);color:var(--t2)">Turnos huérfanos</span></td>
        <td style="display:flex;gap:5px">
          <button class="btn bd xs" onclick="deleteOrphanMonth('${k}')" title="Borrar estos turnos de BD">🗑 Limpiar</button>
        </td>
      </tr>`);
    }
  });

  tbody.innerHTML = genRows + orphanRows.join('');
}

function updSendSel(){
  const sel=document.getElementById('sendMesSel');
  const info=document.getElementById('sendMesInfo');
  if(!sel||!info) return;
  const gi=parseInt(sel.value);
  const g=GENS[gi];
  if(g) info.textContent=`${g.func} funcionarios · ${g.alertas} alertas · Generado ${g.fecha}`;
  else info.textContent='';
}

function populateSendMes(){
  const sel=document.getElementById('sendMesSel');
  if(!sel) return;
  sel.innerHTML='<option value="">Seleccioná una generación aprobada...</option>'+
    GENS.map((g,i)=>`<option value="${i}" ${g.estado!=='aprobada'?'disabled':''}>
      ${genLabel(g)} ${g.estado==='aprobada'?'✓':g.estado==='borrador'?'(pendiente validación)':'(cancelada)'}
    </option>`).join('');
}

function openValidate(genIdx){
  window._currentGenIdx = genIdx;
  openM('genValidM');
  renderGenGrid();
  const g = GENS[genIdx];
  document.querySelector('#genValidM .mh-t').textContent = `✓ Validar Planilla — ${g?.mes||''}`;
  const chips = document.getElementById('genValAlertChips');
  if(chips && g){
    const alert7 = g.alertas||0;
    const vacantes = DB.licencias.filter(l=>l.genera_vacante&&!l.suplente_id&&['activa','pendiente'].includes(l.estado)).length;
    chips.innerHTML = [
      alert7>0 ? `<span class="chip cr">🚨 ${alert7} 7ª guardia</span>` : '',
      vacantes>0 ? `<span class="chip ca">⚠ ${vacantes} vacante${vacantes>1?'s':''} sin cubrir</span>` : '',
      alert7===0&&vacantes===0 ? '<span class="chip cg">✓ Sin alertas</span>' : ''
    ].join(' ');
  }
}

// ........................................................
if(window.GApp?.registerLayer){
  window.GApp.registerLayer('features', {
    renderCov,
    renderDashAlerts,
    renderCal,
    renderMySched,
    renderEmps,
    renderLics,
    renderTrades,
    renderAlerts,
    renderUsers,
    renderHR,
    initEJ,
    toast,
  });
}

if(!window.__scheduleResizeBound){
  window.__scheduleResizeBound=true;
  let rt=null;
  window.addEventListener('resize', ()=>{
    clearTimeout(rt);
    rt=setTimeout(()=>{
      const v=document.getElementById('v-schedule');
      if(v && v.classList.contains('act')) renderCal();
    },120);
  });
}
// EMAIL PREVIEW
// ........................................................
function previewEmail(){
  const dbEmp=getCurrFuncionario();
  const ym=MY_AGENDA_CTX||SCHED_CTX;
  const sched=getUserSched(dbEmp?.id, ym.year, ym.month);
  const sector=dbEmp?.sector?.nombre||cUser?.sector||'—';
  const clinic=dbEmp?.clinica?.nombre||cUser?.clinic||'—';
  document.getElementById('epTo').textContent=`${cUser.name} → vista previa`;
  document.getElementById('epSubj').textContent=`Tu Agenda — ${getMonthLabel(ym.year,ym.month)} · ${sector}`;
  document.getElementById('epBody').innerHTML=buildEpHTML({
    name:cUser?.name||'Funcionaria',
    sector,
    clinic,
    year:ym.year,
    month:ym.month,
    sched,
  });
  openM('emailM');
}

function buildEpHTML(ctx){
  const year=ctx?.year ?? new Date().getFullYear();
  const month=ctx?.month ?? new Date().getMonth();
  const sched=ctx?.sched || {};
  const firstDow=((new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7);
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const weeks=Math.ceil((firstDow+daysInMonth)/7);
  const dbEmp=getCurrFuncionario();
  const bdayDate=dbEmp?.fecha_nacimiento?new Date(`${dbEmp.fecha_nacimiento}T12:00:00`):null;
  const bdayDay=bdayDate?.getUTCDate();
  const bdayMonth=bdayDate?.getUTCMonth();

  let rows='';let day=1;
  for(let w=0;w<weeks;w++){
    rows+='<tr>';
    for(let col=0;col<7;col++){
      const idx=w*7+col;
      const inMonth=idx>=firstDow && day<=daysInMonth;
      if(!inMonth){rows+='<td class="nd">—</td>';continue;}
      const dm=day++;
      const wk=col>=5;
      const code=sched[dm];
      const isBday=(bdayMonth===month && bdayDay===dm);
      const cls=code==='M'?'ep-sM':code==='LE'?'ep-sLE':'';
      rows+=`<td class="${wk?'wk':''}"><div style="font-size:9px;color:#888;margin-bottom:2px">${dm}${isBday?' 🎂':''}</div>`;
      if(code) rows+=`<span class="${cls}">${code}</span>`;
      else if(!wk) rows+=`<span class="ep-free">libre</span>`;
      rows+='</td>';
    }
    rows+='</tr>';
  }
  const worked=Object.values(sched).filter(code=>isW(code)).length;
  const hday=dbEmp?.horas_dia||6;
  const hs=worked*hday;
  return `<div class="ep">
    <div class="ep-hdr"><div class="ep-logo">+ GuardiaApp</div><div style="font-size:10px;color:#888;">Clínica ${ctx?.clinic||'—'} · ${getMonthLabel(year,month)}</div></div>
    <div style="font-size:12px;color:#555;margin-bottom:6px">Hola <strong>${ctx?.name||'Funcionaria'}</strong>,</div>
    <div style="font-family:var(--ff-display);font-weight:800;font-size:18px;color:#1a1a2e;margin-bottom:3px">Tu agenda para ${getMonthLabel(year,month)}</div>
    <div style="font-size:11px;color:#666;margin-bottom:4px">Sector: <strong>${ctx?.sector||'—'}</strong> · Régimen: <strong>${hday}hs/día</strong></div>
    <table class="ep-cal"><thead><tr><th>LUN</th><th>MAR</th><th>MIÉ</th><th>JUE</th><th>VIE</th><th>SÁB</th><th>DOM</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="ep-sum">
      <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:8px">📊 Resumen del mes</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:11px;text-align:center">
        <div><div style="color:#666">Guardias</div><div style="font-size:20px;font-weight:800;color:#3d7fff">${worked}</div></div>
        <div><div style="color:#666">Hs. trabajo</div><div style="font-size:20px;font-weight:800;color:#1ec97e">${hs}</div></div>
        <div><div style="color:#666">Días libres</div><div style="font-size:20px;font-weight:800;color:#888">${daysInMonth-worked}</div></div>
        <div><div style="color:#666">Extras</div><div style="font-size:20px;font-weight:800;color:#f5a623">0</div></div>
      </div>
    </div>
    <div style="font-size:11px;color:#444;margin-bottom:5px"><strong>Recordatorios:</strong></div>
    <div style="font-size:10px;color:#555;line-height:1.8">🔄 Cambios: GuardiaApp → Mi Agenda → Solicitar Cambio<br>🔔 Ausencias: informar con 24hs de anticipación<br>🎂 Cumpleaños: se marca automáticamente en tu calendario</div>
    <div class="ep-foot">GuardiaApp · Planificación de Enfermería · Email generado automáticamente. No responder.</div>
  </div>`;
}

// ........................................................
// EMAILJS CONFIG
// ........................................................
const EJ={
  publicKey: '83F0J8NFyNpBA0LMn',
  serviceId:  'service_uy10mhj',
  templateId: 'template_mk5ebrl',
  testEmail:  'mlorenzo@nypsrl.com',
};
let ejReady=false;
function initEJ(){
  if(typeof emailjs==='undefined'){console.warn('EmailJS no cargó');return;}
  emailjs.init({publicKey:EJ.publicKey});
  ejReady=true;
}

// Construye el HTML limpio del email (para mandar como string)
function buildEmailBody(empName, sector, clinic, guardias, hs){
  let rows='';let day=1;
  for(let w=0;w<5;w++){
    rows+='<tr>';
    for(let col=0;col<7;col++){
      const valid=(w===0&&col>=3)||(w>0);
      const dm=valid&&day<=31?day++:null;
      if(!dm){rows+='<td style="background:#f5f5f5;color:#ccc;border:1px solid #e0e0e0;padding:5px 3px;text-align:center;min-width:66px;">—</td>';continue;}
      const wk=col>=5;
      const code=MYSCHED[dm];
      const isBday=dm===22;
      let cellStyle=`border:1px solid #e0e0e0;padding:5px 3px;text-align:center;min-width:66px;${wk?'background:#fff8f0;':''}`;
      let codeHtml='';
      if(code==='M') codeHtml=`<span style="background:#dbeafe;color:#1d4ed8;border-radius:3px;padding:1px 4px;font-weight:700;font-size:9px">${code}</span>`;
      else if(code==='LE') codeHtml=`<span style="background:#fee2e2;color:#991b1b;border-radius:3px;padding:1px 4px;font-weight:700;font-size:9px">${code}</span>`;
      else if(code) codeHtml=`<span style="font-size:10px;font-weight:700">${code}</span>`;
      else if(!wk) codeHtml=`<span style="font-size:9px;color:#bbb">libre</span>`;
      rows+=`<td style="${cellStyle}"><div style="font-size:9px;color:#888;margin-bottom:2px">${dm}${isBday?' 🎂':''}</div>${codeHtml}</td>`;
    }
    rows+='</tr>';
    if(day>31) break;
  }
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f0f4ff;padding:20px;margin:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)">
    <div style="background:#1e3a6e;padding:20px 26px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-family:Arial Black,sans-serif;font-weight:900;font-size:20px;color:#fff">+ GuardiaApp</div>
      <div style="font-size:11px;color:#a0b4d0">Clínica ${clinic} · ${getMonthLabel(year,month)}</div>
    </div>
    <div style="padding:24px 26px">
      <p style="font-size:13px;color:#555;margin:0 0 6px">Hola <strong>${empName}</strong>,</p>
      <h2 style="font-size:20px;color:#1a1a2e;margin:0 0 4px;font-family:Arial Black,sans-serif">Tu agenda para ${getMonthLabel(year,month)}</h2>
      <p style="font-size:11px;color:#666;margin:0 0 16px">Sector: <strong>${sector}</strong> · Turno: <strong>Mañana</strong> · Régimen: <strong>36hs/sem · 6hs/día</strong></p>
      <table style="border-collapse:collapse;width:100%;margin:0 0 16px">
        <thead><tr>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">LUN</th>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">MAR</th>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">MIÉ</th>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">JUE</th>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">VIE</th>
          <th style="background:#374151;color:#fcd34d;padding:6px 3px;text-align:center;font-size:10px">SÁB</th>
          <th style="background:#374151;color:#fcd34d;padding:6px 3px;text-align:center;font-size:10px">DOM</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="background:#f0f7ff;border-radius:8px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:10px">📊 Resumen del mes</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center">
          <div><div style="font-size:10px;color:#666">Guardias</div><div style="font-size:22px;font-weight:800;color:#3d7fff">${guardias}</div></div>
          <div><div style="font-size:10px;color:#666">Hs. trabajo</div><div style="font-size:22px;font-weight:800;color:#1ec97e">${hs}</div></div>
          <div><div style="font-size:10px;color:#666">Días libres</div><div style="font-size:22px;font-weight:800;color:#888">${31-guardias}</div></div>
          <div><div style="font-size:10px;color:#666">Extras</div><div style="font-size:22px;font-weight:800;color:#f5a623">0</div></div>
        </div>
      </div>
      <div style="font-size:11px;color:#444;margin-bottom:6px"><strong>Recordatorios:</strong></div>
      <div style="font-size:10px;color:#555;line-height:1.9">
        🔄 Cambios de turno: GuardiaApp → Mi Agenda → Solicitar Cambio<br>
        🔔 Ausencias: informar con 24hs de anticipación a supervisora<br>
        🎂 22/01 — Media guardia libre por cumpleaños (automático)
      </div>
    </div>
    <div style="background:#f8faff;border-top:1px solid #e0e8ff;padding:12px 26px;font-size:9px;color:#999">
      GuardiaApp · Planificación de Enfermería · Este email fue generado automáticamente. Por favor no responder.
    </div>
  </div>
</body></html>`;
}

async function sendEmail(){
  if(!ejReady){toast('er','EmailJS no listo','Recargá la página e intentá de nuevo.');return;}
  const btn=document.querySelector('#emailM .btn.bs');
  if(btn){btn.textContent='⏳ Enviando...';btn.disabled=true;}
  const empData=EMPS.find(e=>e.name===cUser.name)||EMPS[2];
  const htmlBody=buildEmailBody(empData.name, empData.sector, empData.clinic, empData.g, empData.g*empData.hday);
  try{
    await emailjs.send(EJ.serviceId, EJ.templateId, {
      to_email: EJ.testEmail,
      subject:  `GuardiaApp — Tu Agenda ${getMonthLabel(MY_AGENDA_CTX.year,MY_AGENDA_CTX.month)} · ${empData.sector}`,
      message:  htmlBody,
    });
    closeM('emailM');
    toast('ok','¡Email enviado!',`Agenda de ${empData.name} enviada a ${EJ.testEmail}`);
  }catch(err){
    console.error('EmailJS error:',err);
    toast('er','Error al enviar',`${err?.text||err?.message||JSON.stringify(err)}`);
  }finally{
    if(btn){btn.textContent='📤 Enviar';btn.disabled=false;}
  }
}

// Envío masivo simulado con email real al primero
async function sendEmails(){
  if(!ejReady){toast('wa','EmailJS no listo','Recargá la página.');return;}
  toast('in','Enviando agendas...','Mandando email de prueba a mlorenzo@nypsrl.com');
  // Manda email real al mail de prueba
  const e=EMPS.find(x=>x.name===cUser?.name)||EMPS[2];
  const htmlBody=buildEmailBody(e.name,e.sector,e.clinic,e.g,e.g*e.hday);
  try{
    await emailjs.send(EJ.serviceId, EJ.templateId,{
      to_email: EJ.testEmail,
      subject: `GuardiaApp — Agenda ${getMonthLabel(MY_AGENDA_CTX.year,MY_AGENDA_CTX.month)} · ${e.sector}`,
      message: htmlBody,
    });
    toast('ok',`Email real enviado a ${EJ.testEmail}`,`Agenda de ${e.name} — En producción se enviaría a cada funcionario`);
  }catch(err){
    toast('er','Error al enviar',`${err?.text||err?.message||JSON.stringify(err)}`);
  }
  // Simula el resto
  let n=1;
  const ti=setInterval(()=>{
    n++;
    if(n<=4) toast('in',`Simulando envío (${n}/47)`,`Agenda de ${EMPS[n]?.name||'funcionario'}`);
    if(n>=47){clearInterval(ti);toast('ok','47 agendas procesadas','1 email real + 46 simulados (modo demo)');}
  },500);
}

// ........................................................
// HR REPORT
// ........................................................
let HR_CTX=(()=>{const _n=new Date();return{year:_n.getFullYear(),month:_n.getMonth(),clinic:'all'};})();
let HR_CACHE={rows:[],detailRows:[],subs:[]};

function ensureHRFilters(){
  const mSel=document.getElementById('hrMesSel');
  const cSel=document.getElementById('hrClinicSel');
  if(!mSel||!cSel) return;
  const months=getAvailableMonthsGlobal();
  if(!months.some(m=>m.year===HR_CTX.year&&m.month===HR_CTX.month)){
    const last=months[months.length-1];
    HR_CTX.year=last.year;HR_CTX.month=last.month;
  }
  const mVal=`${HR_CTX.year}-${String(HR_CTX.month+1).padStart(2,'0')}`;
  mSel.innerHTML=months.map(m=>{
    const key=`${m.year}-${String(m.month+1).padStart(2,'0')}`;
    return `<option value="${key}" ${key===mVal?'selected':''}>${m.label}</option>`;
  }).join('');
  const clinics=[...new Set((dbLoaded&&DB.funcionarios.length?DB.funcionarios.map(f=>f.clinica?.nombre||'—'):EMPS.map(e=>e.clinic)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  cSel.innerHTML=`<option value="all">Todas las clínicas</option>${clinics.map(c=>`<option value="${c}" ${HR_CTX.clinic===c?'selected':''}>${c}</option>`).join('')}`;
  const p=String(mSel.value||'').match(/^(\d{4})-(\d{2})$/);
  if(p){ HR_CTX.year=parseInt(p[1],10); HR_CTX.month=parseInt(p[2],10)-1; }
  HR_CTX.clinic=cSel.value||'all';
}

function typeLabel(code){
  if(isW(code)) return 'Trabajo';
  if(code==='LAR') return 'LAR';
  if(code==='F') return 'Falta';
  return 'Licencia';
}

function buildHRData(){
  const y=HR_CTX.year,m=HR_CTX.month;
  const daysInMonth=new Date(Date.UTC(y,m+1,0)).getUTCDate();
  let workdays=0;
  for(let d=1;d<=daysInMonth;d++){
    const wd=(new Date(Date.UTC(y,m,d)).getUTCDay()+6)%7;
    if(wd<=4) workdays++;
  }
  const rows=[];
  const detailRows=[];
  const subsRows=[];

  if(dbLoaded && DB.funcionarios.length){
    const funcs=DB.funcionarios.filter(f=>HR_CTX.clinic==='all'||(f.clinica?.nombre||'—')===HR_CTX.clinic);
    funcs.forEach(f=>{
      const name=fNombre(f);
      const hday=f.horas_dia||6;
      const turns=DB.turnos.filter(t=>t.funcionario_id===f.id).filter(t=>{
        const dt=new Date(`${t.fecha}T12:00:00`);
        return !Number.isNaN(dt.getTime()) && dt.getUTCFullYear()===y && dt.getUTCMonth()===m;
      });
      const g=turns.filter(t=>isW(t.codigo)).length;
      const faltas=turns.filter(t=>String(t.codigo).toUpperCase()==='F').length;
      const lar=turns.filter(t=>String(t.codigo).toUpperCase()==='LAR').length;
      const hs=g*hday;
      const obj=workdays*hday;
      const extras=Math.max(0,hs-obj);
      const pct=obj?Math.round((hs/obj)*100):0;
      const st=lar>0&&g===0?'lar':faltas>0?'absent':'active';
      const shift=f.turno_fijo||turns.find(t=>isW(t.codigo))?.codigo||'—';
      rows.push({
        name, clinic:f.clinica?.nombre||'—', sector:f.sector?.nombre||'—', shift, hday,
        g, hs, obj, diff:hs-obj, faltas, lar, extras, pct, status:st,
      });
      turns.forEach(t=>{
        const dt=new Date(`${t.fecha}T12:00:00`);
        const wd=(dt.getUTCDay()+6)%7;
        detailRows.push({
          date:t.fecha,
          day:DAB[wd],
          name,
          sector:f.sector?.nombre||'—',
          clinic:f.clinica?.nombre||'—',
          code:t.codigo||'—',
          type:typeLabel(t.codigo||''),
          hs:isW(t.codigo)?hday:'—',
        });
      });
    });
    const subs=(DB.suplentes||[]).filter(s=>HR_CTX.clinic==='all'||(s.clinica?.nombre||'—')===HR_CTX.clinic);
    subs.forEach(s=>{
      const turns=DB.turnos.filter(t=>t.funcionario_id===s.id).filter(t=>{
        const dt=new Date(`${t.fecha}T12:00:00`);
        return !Number.isNaN(dt.getTime()) && dt.getUTCFullYear()===y && dt.getUTCMonth()===m;
      });
      const g=turns.filter(t=>isW(t.codigo)).length;
      const hs=g*(s.horas_dia||6);
      const pct=Math.min(100,Math.round((g/Math.max(1,workdays))*100));
      subsRows.push({name:fNombre(s),g,hs,pct});
    });
  }else{
    const emps=EMPS.filter(e=>HR_CTX.clinic==='all'||e.clinic===HR_CTX.clinic);
    emps.forEach(e=>{
      const hs=e.g*e.hday;
      const obj=22*e.hday;
      rows.push({
        name:e.name,clinic:e.clinic,sector:e.sector,shift:e.shift,hday:e.hday,g:e.g,hs,obj,diff:hs-obj,
        faltas:e.faltas||0,lar:e.status==='lar'?e.g:0,extras:e.extras||0,pct:Math.round((hs/obj)*100),status:e.status||'active',
      });
      const sc=WK[e.name]||[];
      for(let d=1;d<=7;d++){
        const code=sc[d-1];
        if(!code) continue;
        detailRows.push({
          date:`${HR_CTX.year}-${String(HR_CTX.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`,
          day:DAB[(3+d-1)%7],
          name:e.name,sector:e.sector,clinic:e.clinic,code,type:typeLabel(code),hs:isW(code)?e.hday:'—',
        });
      }
    });
    SUBS.forEach(s=>subsRows.push({name:s.name,g:s.g,hs:s.g*6,pct:s.pct}));
  }

  rows.sort((a,b)=>a.name.localeCompare(b.name,'es'));
  detailRows.sort((a,b)=>a.date===b.date?a.name.localeCompare(b.name,'es'):a.date.localeCompare(b.date));
  subsRows.sort((a,b)=>b.pct-a.pct);
  return {rows,detailRows,subsRows};
}

function renderHR(){
  const body=document.getElementById('hrSBody');if(!body)return;
  ensureHRFilters();
  const {rows,detailRows,subsRows}=buildHRData();
  HR_CACHE={rows,detailRows,subs:subsRows};
  const sMap={active:'dg',lar:'da',cert:'da',absent:'dr2'};
  const lMap={active:'Activo',lar:'En LAR',cert:'CERT',absent:'Falta'};
  body.innerHTML=rows.map(e=>{
    const pc=e.pct>=90?'cg':e.pct>=75?'ca':'cr';
    const ds=e.diff>0?`+${e.diff}`:e.diff<0?`${e.diff}`:'=';
    const dc=e.diff>0?'pos':e.diff<0?'neg':'neu';
    return `<tr>
      <td><strong>${e.name}</strong></td>
      <td style="font-size:10px;color:var(--t2)">${e.clinic}</td>
      <td style="font-size:10px;color:var(--t2)">${e.sector}</td>
      <td><span class="sh ${shCls(e.shift)}" style="font-size:10px">${e.shift}</span></td>
      <td class="mn">${e.g}</td>
      <td class="mn" style="color:var(--blue)">${e.hs}</td>
      <td class="mn" style="color:var(--t3)">${e.obj}</td>
      <td><span class="${dc}">${ds}</span></td>
      <td class="mn" style="color:${e.faltas>0?'var(--red)':'var(--t3)'}">${e.faltas||'—'}</td>
      <td class="mn" style="color:${e.lar>0?'var(--green)':'var(--t3)'}">${e.lar||'—'}</td>
      <td class="mn" style="color:${e.extras>0?'var(--amber)':'var(--t3)'}">${e.extras>0?'+'+e.extras+' hs':'—'}</td>
      <td><span class="chip ${pc}">${e.pct}%</span></td>
      <td><span class="dot ${sMap[e.status]||'dn2'}"></span><span style="font-size:11px">${lMap[e.status]||'—'}</span></td>
    </tr>`;
  }).join('')||'<tr><td colspan="13" style="text-align:center;color:var(--t3);padding:20px">Sin datos para el filtro seleccionado</td></tr>';

  const totalHs=rows.reduce((a,r)=>a+r.hs,0);
  const totalObj=rows.reduce((a,r)=>a+r.obj,0);
  const totalF=rows.reduce((a,r)=>a+r.faltas,0);
  const totalL=rows.reduce((a,r)=>a+r.lar,0);
  const totalEx=rows.reduce((a,r)=>a+r.extras,0);
  const pct=totalObj?Math.round((totalHs/totalObj)*100):0;
  const topEx=rows.filter(r=>r.extras>0).sort((a,b)=>b.extras-a.extras).slice(0,2).map(r=>r.name).join(' · ');
  const setTxt=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setTxt('hrKpiHours',String(totalHs));
  setTxt('hrKpiTarget',`Objetivo: ${totalObj} hs`);
  setTxt('hrKpiFaltas',String(totalF));
  setTxt('hrKpiFaltasSub',`${totalF} faltas · ${totalL} días LAR`);
  setTxt('hrKpiExtras',`${totalEx} hs`);
  setTxt('hrKpiExtrasSub',topEx||'Sin horas extra');
  setTxt('hrKpiCumpl',`${pct}%`);
  setTxt('hrKpiCumplSub',`${rows.length?rows.filter(r=>r.pct>=90).length:0}/${rows.length||0} en objetivo`);

  const det=document.getElementById('hrDetSel');
  if(det){
    const cur=det.value||'all';
    det.innerHTML='<option value="all">Todos los funcionarios</option>'+rows.map(r=>`<option value="${r.name}">${r.name}</option>`).join('');
    if([...det.options].some(o=>o.value===cur)) det.value=cur;
  }
  renderHRDet();
  renderHRRank();
}

function renderHRDet(){
  const emp=document.getElementById('hrDetSel')?.value||'all';
  const body=document.getElementById('hrDBody');if(!body)return;
  const list=(HR_CACHE.detailRows||[]).filter(r=>emp==='all'||r.name===emp);
  body.innerHTML=list.map(r=>`<tr>
    <td class="mn" style="font-style:italic">${new Date(`${r.date}T12:00:00`).toLocaleDateString('es-UY')}</td>
    <td class="mn">${r.day}</td>
    <td><strong>${r.name}</strong></td>
    <td style="font-size:11px;color:var(--t2)">${r.sector}</td>
    <td style="font-size:10px;color:var(--t3)">${r.clinic}</td>
    <td><span class="sh ${shCls(r.code)}">${r.code}</span></td>
    <td style="font-size:11px;color:var(--t2)">${r.type}</td>
    <td class="mn" style="color:var(--blue)">${r.hs}</td>
  </tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--t3);padding:20px">Sin registros para el filtro seleccionado</td></tr>';
}

function renderHRRank(){
  const r1=document.getElementById('hrRBody');
  const rs=document.getElementById('hrSubBody');
  if(r1) r1.innerHTML='';
  if(rs) rs.innerHTML='';
  if(r1){
    [...(HR_CACHE.rows||[])].sort((a,b)=>b.pct-a.pct).slice(0,8).forEach((e,i)=>{
      r1.innerHTML+= `<tr>
        <td class="mn" style="color:${i<3?'var(--amber)':'var(--t3)'}">${i+1}</td>
        <td><strong>${e.name}</strong></td>
        <td style="font-size:10px;color:var(--t2)">${e.clinic}</td>
        <td><span class="chip ${e.pct>=95?'cg':e.pct>=80?'ca':'cr'}">${e.pct}%</span></td>
        <td class="mn">${e.hs}hs</td>
      </tr>`;
    });
  }
  if(rs){
    (HR_CACHE.subs||[]).forEach((s,i)=>{
      rs.innerHTML+=`<tr>
        <td><strong>${s.name}</strong></td>
        <td class="mn">${s.g}</td>
        <td class="mn">${s.hs}hs</td>
        <td><span class="chip ${s.pct>=90?'cg':s.pct>=80?'ca':'cr'}">${s.pct}%</span></td>
        <td><span class="chip ${i===0?'cg':i===1?'ca':'cr'}">${i+1}°</span></td>
      </tr>`;
    });
  }
}

// ........................................................
// USERS
// ........................................................

// Derivar username visible desde el email almacenado en usuarios
function appConfirm(title, msg, onConfirm, okLabel){
  document.getElementById('confirmMTitle').textContent = title;
  document.getElementById('confirmMMsg').textContent   = msg;
  document.getElementById('confirmMOk').textContent    = okLabel||'Confirmar';
  window._confirmCb = onConfirm;
  openM('confirmM');
}
function usernameFromEmail(email){
  if(!email) return '—';
  return email.endsWith('@guardiapp.app') ? email.replace('@guardiapp.app','') : email;
}

// Generar username a partir de un funcionario
function genUsername(func){
  const base=(func.apellido||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'');
  const num=func.numero_funcionario||func.numero||'';
  return num?`${base}_${num}`:base||`func_${String(func.id||'').slice(0,6)}`;
}

// Autollenar username cuando se elige un funcionario en el modal de usuario
function onUEmpChange(){
  const funcId=document.getElementById('uEmp')?.value;
  const info=document.getElementById('uFuncInfo');
  if(!funcId){
    if(info) info.style.display='none';
    return;
  }
  if(!dbLoaded) return;
  const func=[...DB.funcionarios,...DB.suplentes,...(DB.funcionariosAll||[])].find(f=>String(f.id)===String(funcId));
  if(!func) return;
  // Auto-generar username si no fue editado manualmente
  const uun=document.getElementById('uUsername');
  if(uun&&!uun.dataset.manual) uun.value=genUsername(func);
  // Mostrar info del funcionario (read-only)
  if(info){
    const rows=[
      func.sector?.nombre   ? `<span><strong>Sector:</strong> ${esc(func.sector.nombre)}</span>` : '',
      func.turno_fijo       ? `<span><strong>Turno:</strong> ${esc(func.turno_fijo)}</span>` : '',
      func.telefono         ? `<span><strong>Tel:</strong> ${esc(func.telefono)}</span>` : '',
      func.fecha_nacimiento ? `<span><strong>F.Nac:</strong> ${func.fecha_nacimiento}</span>` : '',
      func.email            ? `<span><strong>Email:</strong> ${esc(func.email)}</span>` : '',
    ].filter(Boolean);
    info.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:10px">${rows.join('')}</div>`;
    info.style.display='';
  }
}

function renderUsers(){
  const body=document.getElementById('usersBody');if(!body)return;
  const search=(document.getElementById('uSearch')?.value||'').toLowerCase().trim();
  const filterRol=document.getElementById('uFilterRol')?.value||'';
  const filterEstado=document.getElementById('uFilterEstado')?.value||'';
  let users = dbLoaded&&DB.usuarios.length
    ? DB.usuarios.map((u,i)=>({
        id:u.id||i,
        name:u.funcionario?`${u.funcionario.apellido}, ${u.funcionario.nombre}`:usernameFromEmail(u.email),
        username:usernameFromEmail(u.email),
        email:u.email||'',
        notifEmail:u.funcionario?.email||'',
        role:u.rol,
        sector:u.funcionario?.sector?.nombre||'—',
        last:u.ultimo_acceso?new Date(u.ultimo_acceso).toLocaleDateString('es-UY'):'Nunca',
        active:u.activo,
        mustChange:u.must_change_password||false,
        funcionario_id:u.funcionario_id,
      }))
    : USERS_DATA;
  if(search) users=users.filter(u=>u.name.toLowerCase().includes(search)||u.username.toLowerCase().includes(search));
  if(filterRol) users=users.filter(u=>u.role===filterRol);
  if(filterEstado==='activo') users=users.filter(u=>u.active);
  else if(filterEstado==='inactivo') users=users.filter(u=>!u.active);
  else if(filterEstado==='cambio') users=users.filter(u=>u.mustChange);
  const cnt=document.getElementById('usersCount');
  if(cnt) cnt.textContent=users.length===DB.usuarios.length?`${users.length} usuarios`:`${users.length} de ${DB.usuarios.length} usuarios`;
  const rChip={admin:'cb2',supervisor:'cg',nurse:'cp'};
  const rLabel={admin:'Admin/Gerencia',supervisor:'Supervisor',nurse:'Enfermero'};
  body.innerHTML=users.map((u,i)=>`<tr>
    <td><strong>${u.name}</strong></td>
    <td class="mn" style="font-family:var(--ff-mono);font-size:10px">${u.username}</td>
    <td class="mn" style="font-size:10px;color:var(--t3)">${u.notifEmail||'—'}</td>
    <td><span class="chip ${rChip[u.role]||'cn'}">${rLabel[u.role]||u.role}</span></td>
    <td style="font-size:11px;color:var(--t2)">${u.sector}</td>
    <td>
      <span class="dot ${u.active?'dg':'dn2'}"></span>${u.active?'Activo':'Inactivo'}
      ${u.mustChange?'<br><span style="font-size:9px;color:var(--amber);font-weight:600">🔑 cambio requerido</span>':''}
    </td>
    <td><div style="display:flex;gap:4px">
      <button class="btn bg xs" onclick="editUser(${i})" title="Editar">✏️</button>
      <button class="btn bg xs" onclick="openResetPassModal('${u.email}','${u.name.replace(/'/g,"\\'")}')" title="Resetear contraseña">🔑</button>
      ${u.active
        ? `<button class="btn bd xs" onclick="toggleUser(${i})">Deshabilitar</button>`
        : `<button class="btn bs xs" onclick="toggleUser(${i})">Habilitar</button>`}
    </div></td>
  </tr>`).join('');
}

function editUser(i){
  const users = dbLoaded&&DB.usuarios.length
    ? DB.usuarios.map((u,idx)=>({
        id:u.id||idx,
        name:u.funcionario?`${u.funcionario.apellido}, ${u.funcionario.nombre}`:usernameFromEmail(u.email),
        username:usernameFromEmail(u.email),
        notifEmail:u.funcionario?.email||'',
        role:u.rol, active:u.activo,
        telefono:u.funcionario?.telefono,
        fnac:u.funcionario?.fecha_nacimiento,
        funcionario_id:u.funcionario_id,
      }))
    : USERS_DATA;
  const u=users[i]; if(!u) return;
  window._editUserId = u.id;
  document.querySelector('#userM .mh-t').textContent = '✏️ Editar Usuario — '+u.name;
  const set = (id, val) => { const el=document.getElementById(id); if(el&&val!=null) el.value=val; };
  set('newRole',   u.role||'nurse');
  set('uUsername', u.username||'');
  // Username es readonly en edición — cambiarlo requiere API de admin
  const uun=document.getElementById('uUsername');
  if(uun){
    uun.readOnly=true;
    uun.dataset.manual='1';
    uun.style.opacity='0.5';
    uun.title='El usuario no puede modificarse. Usá 🔑 Resetear contraseña para cambiar credenciales.';
  }
  // Mostrar nota aclaratoria bajo el campo de usuario
  let unote=document.getElementById('uUsernameNote');
  if(!unote){
    unote=document.createElement('div');
    unote.id='uUsernameNote';
    unote.style.cssText='font-size:10px;color:var(--t3);margin-top:3px';
    uun?.parentNode?.appendChild(unote);
  }
  unote.textContent='Solo podés cambiar el rol y el funcionario asociado.';
  // Asegurar opciones frescas y restaurar funcionario asociado
  populateSels();
  const uEmp=document.getElementById('uEmp');
  if(uEmp) uEmp.value = u.funcionario_id || '';
  // Mostrar info del funcionario actual
  onUEmpChange();
  // Edit mode UI: hide password row, change button label
  const passRow = document.getElementById('uPassRow');
  if(passRow) passRow.style.display = 'none';
  const saveBtn = document.getElementById('userMSaveBtn');
  if(saveBtn) saveBtn.textContent = '💾 Guardar cambios';
  updPD();
  openM('userM');
}

async function toggleUser(i){
  const users = USERS_DATA;
  if(!users[i]) return;
  const newState = !users[i].active;
  const action = newState ? 'habilitar' : 'deshabilitar';
  appConfirm(
    newState ? 'Habilitar usuario' : 'Deshabilitar usuario',
    `¿Querés ${action} al usuario "${users[i].name}"?`,
    async (ok) => { if(!ok) return;
      users[i].active = newState;
      if(sb&&users[i].id) await sb.from('usuarios').update({activo:newState}).eq('id',users[i].id);
      renderUsers();
      toast(newState?'ok':'wa', newState?'Usuario habilitado':'Usuario deshabilitado', users[i].name);
    }, newState ? 'Habilitar' : 'Deshabilitar'
  );
}

const PDESC={
  admin:'Acceso total al sistema: planilla, empleados, licencias, cambios, generación automática, reportes RRHH, usuarios y configuración.',
  supervisor:'Planilla, empleados (su sector), licencias, cambios (aprobar/rechazar), generación automática, reportes RRHH. Sin acceso a usuarios ni config global.',
  nurse:'Solo su agenda personal, solicitar licencias propias, solicitar cambios de turno. Sin acceso a planilla general, otros funcionarios ni reportes.',
};
function updPD(){const r=document.getElementById('newRole')?.value;const d=document.getElementById('permDesc');if(d&&r) d.textContent=PDESC[r]||'';}

// ........................................................
// MODALS & ACTIONS
// ........................................................
function openM(id){
  document.getElementById(id)?.classList.add('open');
  if(id==='tradeM'){
    populateSels(); // always refresh selects when opening trade modal
    renderTradeAvail();
  }
  if(id==='larM'){
    populateSels();
    populateLarEmpPicker();
    const inp=document.getElementById('larEmpInput');
    if(inp) inp.value='';
    const info=document.getElementById('larEmpInfo');
    if(info){ info.style.display='none'; info.innerHTML=''; }
    const now=new Date();
    const y=now.getUTCFullYear();
    const m=String(now.getUTCMonth()+1).padStart(2,'0');
    const d=String(now.getUTCDate()).padStart(2,'0');
    const from=document.getElementById('larDesde');
    const to=document.getElementById('larHasta');
    if(from) from.value=`${y}-${m}-${d}`;
    if(to) to.value=`${y}-${m}-${d}`;
  }
  if(id==='userM' && !window._editUserId) { // fresh open: reset
    ['uEmail','uTel','uFnac'].forEach(elid=>{const el=document.getElementById(elid);if(el)el.value='';});
    const uEmpEl=document.getElementById('uEmp');if(uEmpEl){populateSels();uEmpEl.selectedIndex=0;}
    const passRow=document.getElementById('uPassRow');if(passRow) passRow.style.display='';
    const saveBtn=document.getElementById('userMSaveBtn');if(saveBtn) saveBtn.textContent='💾 Crear y Enviar Invitación';
  }
}
function openTradeWith(name){
  openM('tradeM');
  // Pre-select candidate card when available
  setTimeout(()=>{
    const idx=(TRADE_CTX.candidates||[]).findIndex(c=>c.name===name&&c.available);
    if(idx>=0) selectTradeCandidate(idx);
  }, 100);
}

function closeM(id){
  document.getElementById(id)?.classList.remove('open');
  if(id==='tradeM'){
    TRADE_CTX = {selectedDate:'', myCode:'', candidates:[], selectedIdx:-1, showUnavailable:false};
  }
}

function swTab(el,pane){
  const tabs=el.parentElement.querySelectorAll('.tab');
  const tps=el.closest('.view')?.querySelectorAll('.tp');
  tabs.forEach(t=>t.classList.remove('act'));el.classList.add('act');
  if(tps){tps.forEach(p=>p.classList.remove('act'));document.getElementById(pane)?.classList.add('act');}
  if(pane==='tHRD') renderHRDet();
}

function _showPostApprovalPrompt(emp, year, month){
  const existing=document.getElementById('postApprovalOv');
  if(existing) existing.remove();
  const ov=document.createElement('div');
  ov.id='postApprovalOv'; ov.className='ov open';
  ov.innerHTML=`<div class="modal" style="width:400px">
    <div class="mh"><div class="mh-t">Planilla aprobada modificada</div><button class="mh-x" onclick="document.getElementById('postApprovalOv').remove()">✕</button></div>
    <div class="mb">
      <p style="font-size:13px;color:var(--t2);margin-bottom:16px">Se editó un turno en una planilla <strong style="color:var(--text)">aprobada</strong>.<br>¿Enviar agenda actualizada a <strong style="color:var(--text)">${fNombre(emp)}</strong>?</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn bg" onclick="document.getElementById('postApprovalOv').remove()">No, ahora no</button>
        <button class="btn bp" onclick="
          sendOneAgenda([...DB.funcionarios,...DB.suplentes].find(f=>String(f.id)==='${emp.id}'),${year},${month});
          document.getElementById('postApprovalOv').remove();
        ">Sí, enviar agenda</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(ov);
}

async function saveShift(){
  const empName = document.getElementById('smEmp')?.value;
  const code    = document.getElementById('smCode')?.value;
  const fecha   = document.getElementById('smFecha')?.value||new Date().toISOString().slice(0,10);
  if(!empName||!code){ toast('wa','Completá los campos','Seleccioná funcionario y código'); return; }
  const emp = [...DB.funcionarios,...DB.suplentes].find(f=>fNombre(f)===empName) ||
              EMPS.find(e=>e.name===empName);
  // Store locally for immediate grid refresh
  setShiftChange(empName, fecha, code);
  // Update WK data for demo view
  const d=new Date(fecha); const dayIdx=(d.getDay()+6)%7;
  if(WK[empName]) WK[empName][dayIdx]=code;
  if(sb && emp?.id){
    const res = await saveTurno(emp.id, fecha, code, emp.sector_id||null, '');
    if(res){
      closeM('shiftM');
      renderCal();
      toast('ok','Turno guardado en BD',`${empName} · ${code} · ${fecha}`);
      // Si la planilla del mes ya fue aprobada, preguntar si enviar agenda actualizada
      const shiftYear=new Date(fecha+'T12:00:00').getFullYear();
      const shiftMonth=new Date(fecha+'T12:00:00').getMonth()+1;
      const genAp=(GENS||[]).find(g=>g.anio===shiftYear&&g.mesNum===shiftMonth&&g.estado==='aprobada');
      if(genAp && emp?.id) _showPostApprovalPrompt(emp, shiftYear, shiftMonth);
      return;
    }
  }
  closeM('shiftM');
  renderCal();
  toast('ok','Turno guardado',`${empName} · ${code}`);
}
async function saveLic(){
  const empTxt  = document.getElementById('licEmpInput')?.value;
  const tipo    = document.getElementById('licType')?.value||'LAR';
  const desde   = document.getElementById('licDesde')?.value;
  const hasta   = document.getElementById('licHasta')?.value;
  const obs     = document.getElementById('licObs')?.value||'';
  const rule = LIC_RULES[tipo]||LIC_RULES.LAR;
  const genVac  = !!rule.forceVac;
  const subSel  = document.getElementById('licSubSel')?.value;
  if(!empTxt){ toast('wa','Seleccioná un funcionario',''); return; }
  if(!desde||!hasta){ toast('wa','Completá las fechas',''); return; }
  if(desde>hasta){ toast('wa','Rango inválido','La fecha desde no puede ser mayor que hasta.'); return; }
  const days = Math.max(1, Math.round((new Date(hasta)-new Date(desde))/(86400000))+1);
  if(days<rule.minDays || days>rule.maxDays){
    toast('wa','Duración inválida',`${tipo} permite entre ${rule.minDays} y ${rule.maxDays} días.`);
    return;
  }
  if(tipo==='MAT' && days<84){
    toast('wa','Maternal inválida','Para MAT se requieren al menos 84 días.');
    return;
  }
  let empSelResolved = empTxt;
  const subNm = subSel||'Sin asignar';
  // Local state push is handled by saveLicencia() below for DB users
  // For offline mode only (no sb), push locally:
  const offlinePush = !sb;
  if(offlinePush){
    _licIdCounter++;
    LIC_DATA.push({
      id:_licIdCounter, emp:empSelResolved, sec:'—', type:tipo,
      from:desde, to:hasta, days, vac:genVac,
      sub:genVac?(subNm==='Sin asignar'?'Sin asignar':subNm):'—',
      st:genVac&&subNm==='Sin asignar'?'uncovered':'active'
    });
  }
  // Save to Supabase (await so LIC_DATA is updated before renderLics)
  if(sb){
    const rr=resolveFuncionarioByInput(empTxt,{onlyFijo:true});
    if(!rr.emp){
      toast('wa','Funcionario inválido','Elegí un funcionario válido de la lista.');
      return;
    }
    const emp=rr.emp;
    empSelResolved=fNombre(emp);
    const conflict = hasLicOverlap(emp?.id, desde, hasta);
    if(conflict){
      toast('wa','Solapamiento detectado',`Ya existe ${conflict.tipo} entre ${conflict.fecha_desde} y ${conflict.fecha_hasta}.`);
      return;
    }
    const selSub=[...DB.suplentes,...DB.funcionarios].find(f=>fNombre(f)===subSel);
    const payload={
      funcionario_id:emp?.id||1,
      suplente_id: genVac && selSub?.id ? selSub.id : null,
      tipo, fecha_desde:desde, fecha_hasta:hasta, dias:days,
      genera_vacante:genVac, observaciones:obs,
      estado: genVac && !selSub?.id ? 'pendiente' : 'activa'
    };
    const res = await saveLicencia(payload);
    if(res){
      // saveLicencia already pushed to LIC_DATA — remove the local push to avoid dupe
      const dupIdx = LIC_DATA.findIndex(l=>!l.id&&l.emp===empSelResolved&&l.type===tipo);
      if(dupIdx>=0) LIC_DATA.splice(dupIdx,1);
      await applyLicToTurnos(emp?.id, desde, hasta, tipo, emp?.sector_id||null);
    }
  }
  toast('ok','Licencia guardada',`${empSelResolved} · ${tipo} · ${days} días`);
  renderLics();
  // Switch to Activas tab
  const actTab=document.querySelector('#v-licenses .tabs .tab');
  if(actTab) swTab(actTab,'tLicA');
}

function toggleCicloRef(){
  const p=document.getElementById('ePatron')?.value;
  const box=document.getElementById('eCicloRefBox');
  const sabBox=document.getElementById('eTurnoSabBox');
  const domBox=document.getElementById('eTurnoDomBox');
  const cicloBox=document.getElementById('eTurnoCicloBox');
  // ciclo_ref solo aplica a patrones cíclicos (4x1, 6x1)
  if(box) box.style.display=(p==='4x1'||p==='6x1')?'':'none';
  // turno_ciclo solo aplica a 4x1 o 6x1
  if(cicloBox) cicloBox.style.display=(p==='4x1'||p==='6x1')?'':'none';
  // turno_sabado solo aplica a Lunes-Sábado (LS)
  if(sabBox) sabBox.style.display=(p==='LS')?'':'none';
  // turno_domingo aplica a LS, 4x1, 6x1, 36H (cualquier patrón que trabaje domingos)
  if(domBox) domBox.style.display=(p==='LS'||p==='4x1'||p==='6x1'||p==='36H')?'':'none';
}

function editEmp(btn){
  const row = btn.closest('tr');
  const name = row?.querySelector('td strong')?.textContent?.trim()||'';
  if(name) editEmpByName(name);
}

function setSelByText(id, txt){
  const sel=document.getElementById(id); if(!sel) return;
  const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const t=norm(txt);
  const opt=[...sel.options].find(o=>norm(o.text)===t || norm(o.value)===t || norm(o.text).includes(t));
  if(opt) sel.value=opt.value;
}

function editEmpByName(name){
  const dbEmp=[...(DB.funcionariosAll||DB.funcionarios),...(DB.suplentesAll||DB.suplentes)].find(f=>fNombre(f)===name);
  if(!dbEmp){
    toast('wa','No encontrado',`No se encontró ${name} en BD.`);
    return;
  }
  window._editEmpId=dbEmp.id;
  window._editEmpRow=null;
  const full=fNombre(dbEmp);
  if(document.getElementById('eNumero')) document.getElementById('eNumero').value=dbEmp.numero||'';
  if(document.getElementById('eApNom')) document.getElementById('eApNom').value=full;
  if(document.getElementById('eTipo')) document.getElementById('eTipo').value=(dbEmp.tipo==='suplente'?'Suplente':'Fijo');
  setSelByText('eCli', dbEmp.clinica?.nombre||'');
  setSelByText('eSec', dbEmp.sector?.nombre||'');
  // Normalizar código de turno al valor del <option> (M, T, V, N, ROT)
  const tCode=String(dbEmp.turno_fijo||'').toUpperCase();
  const tNorm={TS:'T',NO:'N',ROTATIVO:'ROT'}[tCode]||tCode||'M';
  const turnoEl=document.getElementById('eTurno'); if(turnoEl) turnoEl.value=tNorm;
  if(document.getElementById('eFnac')) document.getElementById('eFnac').value=dbEmp.fecha_nacimiento||'';
  if(document.getElementById('eFIng')) document.getElementById('eFIng').value=dbEmp.fecha_ingreso||'';
  if(document.getElementById('eAlertDias')) document.getElementById('eAlertDias').value=dbEmp.alerta_ingreso_dias||45;
  if(document.getElementById('eTel')) document.getElementById('eTel').value=dbEmp.telefono||'';
  if(document.getElementById('eEmail')) document.getElementById('eEmail').value=dbEmp.email||'';
  if(document.getElementById('eHs')) document.getElementById('eHs').value=dbEmp.horas_semana||36;
  const patronEl=document.getElementById('ePatron'); if(patronEl) patronEl.value=dbEmp.patron||'LV';
  const cicloEl=document.getElementById('eCicloRef'); if(cicloEl) cicloEl.value=dbEmp.ciclo_ref||'';
  const turnoSabEl=document.getElementById('eTurnoSab'); if(turnoSabEl) turnoSabEl.value=dbEmp.turno_sabado||'';
  // Nuevos campos: turno_domingo, turno_ciclo, turno_semana
  const turnoDomEl=document.getElementById('eTurnoDom'); if(turnoDomEl) turnoDomEl.value=dbEmp.turno_domingo||'';
  const turnoCicloEl=document.getElementById('eTurnoCiclo'); if(turnoCicloEl) turnoCicloEl.value=(dbEmp.turno_ciclo||[]).join(',');
  const ts=dbEmp.turno_semana||{};
  for(let i=1;i<=7;i++){
    const sel=document.getElementById(`eTsem${i}`); if(sel) sel.value=ts[String(i)]||'';
  }
  // Expandir detalles de turno_semana si tiene algún valor seteado
  const semDet=document.getElementById('eTurnoSemDet');
  if(semDet) semDet.open=Object.values(ts).some(v=>v);
  toggleCicloRef();
  document.querySelector('#empM .mh-t').textContent='✏️ Editar Funcionario — '+full;
  openM('empM');
}

async function deleteEmpByName(name){
  const dbEmp=[...(DB.funcionariosAll||DB.funcionarios),...(DB.suplentesAll||DB.suplentes)].find(f=>fNombre(f)===name);
  if(!dbEmp){
    toast('wa','No encontrado',`No se encontró ${name} en BD.`);
    return;
  }
  const ok = await new Promise(r => appConfirm('Eliminar funcionario', `¿Eliminar a ${name}? Esta acción lo desactiva (no borra historial).`, r, 'Eliminar'));
  if(!ok) return;
  if(sb){
    const res=await deleteFuncionario(dbEmp.id);
    if(!res) return;
    await loadDB();
  } else {
    DB.funcionarios=DB.funcionarios.filter(f=>f.id!==dbEmp.id);
    DB.suplentes=DB.suplentes.filter(f=>f.id!==dbEmp.id);
    buildDynamicData();
  }
  renderEmps();
  renderSubs2();
  toast('ok','Funcionario eliminado',`${name} fue desactivado/a.`);
}

async function restoreEmpByName(name){
  const dbEmp=[...(DB.funcionariosAll||DB.funcionarios),...(DB.suplentesAll||DB.suplentes)].find(f=>fNombre(f)===name);
  if(!dbEmp){
    toast('wa','No encontrado',`No se encontró ${name} en BD.`);
    return;
  }
  const ok = await new Promise(r => appConfirm('Reactivar funcionario', `¿Reactivar a ${name}?`, r, 'Reactivar'));
  if(!ok) return;
  if(sb){
    const res=await updateFuncionario(dbEmp.id,{activo:true});
    if(!res) return;
    await loadDB();
  } else {
    dbEmp.activo=true;
    buildDynamicData();
  }
  renderEmps();
  renderSubs2();
  toast('ok','Funcionario reactivado',name);
}

function toggleTitularidad(checked){
  const box=document.getElementById('eTitSectorBox');
  if(box) box.style.display=checked?'block':'none';
}

function onEmpTipoChange(){
  const tipo=document.getElementById('eTipo')?.value||'';
  const titBox=document.getElementById('eTitBox');
  if(titBox) titBox.style.display=(tipo==='Suplente')?'block':'none';
  if(tipo!=='Suplente'){
    const chk=document.getElementById('eTitular'); if(chk) chk.checked=false;
    toggleTitularidad(false);
  }
}

function resetAndOpenEmpModal(tipoDefault='fijo'){
  window._editEmpRow=null;
  window._editEmpId=null;
  document.querySelector('#empM .mh-t').textContent='＋ Nuevo Funcionario';
  ['eNumero','eApNom','eEmail','eTel','eFnac','eFIng'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const hsEl=document.getElementById('eHs'); if(hsEl) hsEl.value='36';
  const adEl=document.getElementById('eAlertDias'); if(adEl) adEl.value='45';
  // Reset selects to first option
  ['eTipo','eCli','eSec','eTurno','ePatron'].forEach(id=>{ const el=document.getElementById(id); if(el) el.selectedIndex=0; });
  const cicloEl=document.getElementById('eCicloRef'); if(cicloEl) cicloEl.value='';
  const cicloBox=document.getElementById('eCicloRefBox'); if(cicloBox) cicloBox.style.display='none';
  const turnoSabEl=document.getElementById('eTurnoSab'); if(turnoSabEl) turnoSabEl.value='';
  const turnoSabBox=document.getElementById('eTurnoSabBox'); if(turnoSabBox) turnoSabBox.style.display='none';
  const chk=document.getElementById('eTitular'); if(chk) chk.checked=false;
  toggleTitularidad(false);
  const t=document.getElementById('eTipo');
  if(t) t.value=(String(tipoDefault).toLowerCase()==='suplente'?'Suplente':'Fijo');
  onEmpTipoChange();
  openM('empM');
}

async function getIdByNombre(table, nombre){
  if(!sb || !nombre) return null;
  const {data,error}=await sb.from(table).select('id,nombre');
  if(error || !data?.length) return null;
  const norm=v=>String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
  const target=norm(nombre);
  const exact=data.find(r=>norm(r.nombre)===target);
  if(exact) return exact.id;
  const partial=data.find(r=>norm(r.nombre).includes(target)||target.includes(norm(r.nombre)));
  return partial?.id||null;
}

async function saveEmp(){
  if(cRole !== 'admin'){ toast('wa','Sin permiso','Solo el administrador puede crear funcionarios'); return; }
  const raw   = document.getElementById('eApNom')?.value.trim();
  const email = document.getElementById('eEmail')?.value.trim();
  const tel   = document.getElementById('eTel')?.value.trim();
  const fnac  = document.getElementById('eFnac')?.value;
  const fing  = document.getElementById('eFIng')?.value||null;
  const alertDias = parseInt(document.getElementById('eAlertDias')?.value)||45;
  const hs    = parseInt(document.getElementById('eHs')?.value)||36;
  const tipo  = document.getElementById('eTipo')?.value==='Fijo'?'fijo':'suplente';
  const titularidad_temp = tipo==='suplente' && !!(document.getElementById('eTitular')?.checked);
  const cliTxt = document.getElementById('eCli')?.value||'';
  const secTxt = titularidad_temp
    ? (document.getElementById('eTitSector')?.value||document.getElementById('eSec')?.value||'')
    : (document.getElementById('eSec')?.value||'');
  const turnoFijo = document.getElementById('eTurno')?.value||'M';
  const numeroRaw = parseInt(document.getElementById('eNumero')?.value)||null;
  if(!raw){ toast('wa','Completá el nombre','Campo obligatorio'); return; }
  const parts = raw.split(',');
  const apellido = (parts[0]||'').trim().toUpperCase();
  const nombre   = (parts[1]||'').trim().toUpperCase();
  if(sb){
    const clinicaId = await getIdByNombre('clinicas', cliTxt);
    const sectorId  = await getIdByNombre('sectores', secTxt);
    const turnoSabVal=document.getElementById('eTurnoSab')?.value||null;
    const turnoDomVal=document.getElementById('eTurnoDom')?.value||null;
    const turnoCicloRaw=document.getElementById('eTurnoCiclo')?.value||'';
    const turnoCicloArr=turnoCicloRaw.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean);
    const turnoSemOb={};
    for(let i=1;i<=7;i++){const v=document.getElementById(`eTsem${i}`)?.value||''; if(v) turnoSemOb[String(i)]=v;}
    const payload = { apellido, nombre, tipo, email:email||null,
      telefono:tel||null, fecha_nacimiento:fnac||null,
      fecha_ingreso:fing||null, alerta_ingreso_dias:alertDias,
      titularidad_temp: titularidad_temp||false,
      horas_semana:hs, horas_dia:6, activo:true,
      clinica_id:clinicaId, sector_id:sectorId, turno_fijo:turnoFijo,
      turno_sabado:turnoSabVal||null,
      turno_domingo:turnoDomVal||null,
      turno_ciclo:turnoCicloArr.length?turnoCicloArr:null,
      turno_semana:Object.keys(turnoSemOb).length?turnoSemOb:{},
      patron:document.getElementById('ePatron')?.value||'LV',
      ciclo_ref:document.getElementById('eCicloRef')?.value||null };
    if(numeroRaw) payload.numero=numeroRaw;
    if(window._editEmpRow || window._editEmpId){
      // Update existing — find by stored ID or by name
      const targetId = window._editEmpId;
      const existing = targetId
        ? [...DB.funcionarios,...DB.suplentes].find(f=>f.id===targetId)
        : [...DB.funcionarios,...DB.suplentes].find(f=>
            f.apellido===apellido || 
            `${f.apellido}, ${f.nombre}`===raw.toUpperCase() ||
            `${f.apellido} ${f.nombre}`.toLowerCase()===`${apellido} ${nombre}`.toLowerCase()
          );
      if(existing?.id){
        const res = await updateFuncionario(existing.id, payload);
        if(res){
          await loadDB();
          renderEmps(); renderSubs2();
          toast('ok','Funcionario actualizado',`${apellido}, ${nombre}`);
        }
      } else {
        toast('wa','No encontrado en BD','No se pudo identificar el funcionario para actualizar.');
      }
    } else {
      const {data:res, error} = await sb.from('funcionarios').insert(payload).select().single();
      if(error){ toast('er','Error BD', error.message); return; }
      if(tipo==='fijo') DB.funcionarios.push(res); else DB.suplentes.push(res);
      await loadDB();
    }
    renderEmps(); renderSubs2();
    toast('ok','Funcionario guardado en BD',`${apellido}, ${nombre}`);
  } else {
    toast('ok','Funcionario guardado','(modo demo)');
  }
  window._editEmpRow=null;
  document.querySelector('#empM .mh-t').textContent='＋ Nuevo Funcionario';
  closeM('empM');
}
async function saveUser(){
  const rolSel      = document.getElementById('newRole')?.value||'nurse';
  const notifEmail  = (document.getElementById('uEmail')?.value||'').trim().toLowerCase();
  const isEdit      = !!window._editUserId;
  if(isEdit){
    // En edición: actualizar rol + funcionario vinculado (username no cambia)
    const newFuncId=document.getElementById('uEmp')?.value||null;
    if(sb){
      const {error:updErr}=await sb.from('usuarios')
        .update({rol:rolSel, funcionario_id:newFuncId||null})
        .eq('id',window._editUserId);
      if(updErr){ toast('er','Error al actualizar',updErr.message); return; }
      // Re-fetch para tener datos frescos (incluye join de funcionario)
      const {data:fresh}=await sb.from('usuarios')
        .select('id,email,rol,activo,must_change_password,auth_user_id,funcionario_id,funcionario:funcionario_id(id,apellido,nombre,email,sector:sector_id(nombre),clinica:clinica_id(nombre))')
        .eq('id',window._editUserId).maybeSingle();
      if(fresh){
        const idx=DB.usuarios.findIndex(u=>u.id===window._editUserId);
        if(idx>-1) DB.usuarios[idx]=fresh; else DB.usuarios.push(fresh);
      }
    }
    toast('ok','Usuario actualizado',`Rol: ${rolSel}${newFuncId?' · funcionario vinculado':''}`);
  } else {
    // Nuevo usuario — requiere username
    const usernameInp=(document.getElementById('uUsername')?.value||'').trim().toLowerCase();
    if(!usernameInp){ toast('er','Usuario requerido','Generá o ingresá un nombre de usuario.'); return; }
    if(!/^[a-z0-9._-]+$/.test(usernameInp)){ toast('er','Usuario inválido','Solo letras, números, punto, guion y guion bajo.'); return; }
    if(DB.usuarios.some(u=>u.email===usernameInp)){ toast('er','Usuario ya existe','Ya hay un usuario con ese nombre. Elegí otro.'); return; }
    const passInp=document.getElementById('uPass')?.value||'Clinica2026!';
    if(passInp.length<6){ toast('er','Contraseña muy corta','Mínimo 6 caracteres.'); return; }
    const mustChange=document.getElementById('uMustChange')?.value==='si';
    const funcId=document.getElementById('uEmp')?.value||'';
    const funcIdClean=funcId||null;
    // Construir email virtual para Supabase Auth
    const authEmail=usernameInp.includes('@')?usernameInp:`${usernameInp}@guardiapp.app`;
    if(sb){
      // 1. Crear cuenta en Supabase Auth con email virtual
      const {data:authData,error:authErr}=await sb.auth.signUp({email:authEmail, password:passInp});
      if(authErr){
        const isDupe=authErr.message?.toLowerCase().includes('already');
        toast('er', isDupe?'Usuario ya existe en Auth':'Error al crear usuario', isDupe?'Ese nombre de usuario ya está registrado en el sistema de autenticación.':authErr.message);
        return;
      }
      const authUserId=authData?.user?.id||null;
      // 2. Registrar en tabla usuarios
      const {error:uErr}=await sb.from('usuarios').insert({
        email:usernameInp, rol:rolSel, activo:true, funcionario_id:funcIdClean,
        auth_user_id:authUserId, must_change_password:mustChange
      });
      if(uErr){ toast('er','Error BD',uErr.message); return; }
      // 3. Si hay email de notificaciones, guardar en funcionario
      if(notifEmail&&funcIdClean){
        await sb.from('funcionarios').update({email:notifEmail}).eq('id',funcIdClean);
      }
      // 4. Notificar credenciales
      if(ejReady){
        const rolesLabel={admin:'Admin / Gerencia',supervisor:'Supervisor',nurse:'Enfermero'};
        await emailjs.send(EJ.serviceId,EJ.templateId,{
          to_email:notifEmail||EJ.testEmail,
          subject:`GuardiaApp — Acceso creado`,
          message:`Se creó tu usuario en GuardiaApp:\n\nUsuario: ${usernameInp}\nContraseña: ${passInp}\nRol: ${rolesLabel[rolSel]||rolSel}\n\nIngresá con tu usuario (no el email) en la pantalla de login.`,
        }).catch(()=>{});
      }
      toast('ok','Usuario creado',`${usernameInp} · ${rolSel}`);
    } else {
      toast('ok','Usuario creado','(modo demo)');
    }
  }
  window._editUserId=null;
  document.querySelector('#userM .mh-t').textContent='🛡️ Nuevo Usuario del Sistema';
  const _pr=document.getElementById('uPassRow');if(_pr)_pr.style.display='';
  const _sb=document.getElementById('userMSaveBtn');if(_sb)_sb.textContent='💾 Crear y Enviar Invitación';
  ['uUsername','uEmail'].forEach(id=>{
    const el=document.getElementById(id);
    if(el){ el.value=''; el.readOnly=false; el.style.opacity=''; el.title=''; delete el.dataset.manual; }
  });
  const unote=document.getElementById('uUsernameNote');if(unote)unote.remove();
  const uEmpEl=document.getElementById('uEmp');if(uEmpEl)uEmpEl.selectedIndex=0;
  const uFuncInfo=document.getElementById('uFuncInfo');if(uFuncInfo)uFuncInfo.style.display='none';
  renderUsers();
  closeM('userM');
}
function populateLarEmpPicker(){
  const dl=document.getElementById('larEmpList');
  if(!dl) return;
  const rows = dbLoaded && (DB.funcionariosAll?.length || DB.funcionarios.length)
    ? (DB.funcionariosAll?.length?DB.funcionariosAll:DB.funcionarios)
    : [];
  const uniq=[];
  const seen=new Set();
  rows.forEach(f=>{
    if(f.tipo && f.tipo!=='fijo') return;
    const n=fNombre(f);
    const k=nTxt(n);
    if(!n || seen.has(k)) return;
    seen.add(k);
    uniq.push(n);
  });
  uniq.sort((a,b)=>a.localeCompare(b,'es'));
  dl.innerHTML=uniq.map(n=>`<option value="${n}"></option>`).join('');
}

function resolveLarEmpByInput(raw){
  const q=nTxt(raw);
  if(!q) return {emp:null, matches:[]};
  const rows=[...(DB.funcionariosAll||DB.funcionarios||[]), ...(DB.suplentesAll||DB.suplentes||[])].filter(f=>!f.tipo || f.tipo==='fijo');
  const exact=rows.filter(f=>nTxt(fNombre(f))===q);
  if(exact.length===1) return {emp:exact[0], matches:exact};
  const starts=rows.filter(f=>nTxt(fNombre(f)).startsWith(q));
  if(starts.length===1) return {emp:starts[0], matches:starts};
  const includes=rows.filter(f=>nTxt(fNombre(f)).includes(q));
  if(includes.length===1) return {emp:includes[0], matches:includes};
  return {emp:null, matches: exact.length?exact:(starts.length?starts:includes)};
}

async function saveLAR(){
  const empTxt=document.getElementById('larEmpInput')?.value||'';
  const desde=document.getElementById('larDesde')?.value||'';
  const hasta=document.getElementById('larHasta')?.value||'';
  if(!empTxt){ toast('wa','Seleccioná funcionario','Escribí y elegí un funcionario de la lista.'); return; }
  if(!desde||!hasta){ toast('wa','Completá período','Ingresá fecha desde y hasta.'); return; }
  if(desde>hasta){ toast('wa','Rango inválido','La fecha desde no puede ser mayor que hasta.'); return; }
  const days=Math.max(1,Math.round((new Date(`${hasta}T12:00:00`)-new Date(`${desde}T12:00:00`))/86400000)+1);
  const rule=LIC_RULES.LAR;
  if(days<rule.minDays || days>rule.maxDays){
    toast('wa','Duración inválida',`LAR permite entre ${rule.minDays} y ${rule.maxDays} días.`);
    return;
  }
  const resolved=resolveLarEmpByInput(empTxt);
  const emp=resolved.emp;
  if(!emp){
    if(resolved.matches.length>1){
      toast('wa','Selección ambigua',`Hay ${resolved.matches.length} coincidencias. Escribí nombre completo.`);
    }else{
      toast('wa','Funcionario no encontrado','Elegí un funcionario válido de la lista.');
    }
    return;
  }
  const empSel=fNombre(emp);

  const conflict=hasLicOverlap(emp.id,desde,hasta);
  if(conflict){
    toast('wa','Solapamiento detectado',`Ya existe ${conflict.tipo} entre ${conflict.fecha_desde} y ${conflict.fecha_hasta}.`);
    return;
  }

  let created=0;
  if(sb){
    const res=await saveLicencia({
      funcionario_id:emp.id, tipo:'LAR', fecha_desde:desde, fecha_hasta:hasta,
      dias:days, genera_vacante:false, estado:'activa', observaciones:'Carga LAR por período'
    });
    if(res){
      await applyLicToTurnos(emp.id, desde, hasta, 'LAR', emp.sector_id||null);
      created=1;
    }
  }else{
    LIC_DATA.push({id:Date.now(), emp:empSel, sec:emp.sector?.nombre||'—', type:'LAR', from:desde, to:hasta, days, vac:false, sub:'—', st:'active'});
    created=1;
  }
  renderLAR();
  renderLics();
  closeM('larM');
  toast('ok','LAR guardada',created?`${empSel} · ${desde} a ${hasta} (${days} días)`:'No se pudo guardar');
}
async function handleLicImport(evt){
  const file = evt.target.files[0];
  evt.target.value = '';
  if(!file){ return; }
  if(typeof XLSX === 'undefined'){ toast('er','Error','Librería XLSX no disponible.'); return; }
  if(!sb){ toast('wa','Sin conexión','Se necesita conexión a Supabase para importar.'); return; }

  toast('in','Importando...', file.name);

  let buf;
  try{ buf = await file.arrayBuffer(); }
  catch(e){ toast('er','Error al leer archivo', String(e)); return; }

  const wb = XLSX.read(buf, {type:'array'});

  const normStr = s => String(s||'').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();

  // Build lookup maps: numero → funcionario
  const byNum = {};
  const byApel = {};
  [...DB.funcionarios, ...DB.suplentes].forEach(f => {
    if(f.numero) byNum[String(f.numero)] = f;
    const ap = normStr(f.apellido||'');
    if(ap) byApel[ap] = f;
  });

  function findFunc(numRaw, nomRaw){
    const num = String(parseInt(numRaw)||'').trim();
    if(num && byNum[num]) return byNum[num];
    const parts = normStr(nomRaw||'').split(/\s+/);
    const ap = parts[parts.length-1]||'';
    if(ap && byApel[ap]) return byApel[ap];
    // partial match first 4 chars
    if(ap.length >= 4){
      for(const [k,f] of Object.entries(byApel)){
        if(k.startsWith(ap.slice(0,4))) return f;
      }
    }
    return null;
  }

  let total = 0, unmatched = [];

  for(const sname of wb.SheetNames){
    const data = XLSX.utils.sheet_to_json(wb.Sheets[sname], {header:1, defval:''});
    if(data.length < 3) continue;

    // Detect first data column: SIAM has col-index 5 with 'feriado'-related header;
    // Heuristic: if row[0][10] looks like a day number (1-31) → SIAM (firstCol=10), else ALBINCO (firstCol=11)
    const row0 = data[0]||[];
    const chk10 = parseInt(row0[10]);
    const firstCol = (chk10 >= 1 && chk10 <= 31) ? 10 : 11;

    const recs = [];
    for(let r = 2; r < data.length; r++){
      const row = data[r];
      const numRaw = String(row[0]||'').trim();
      const nomRaw = String(row[1]||'').trim();
      if(!numRaw || numRaw.toLowerCase() === 'nan' || !numRaw.match(/\d/)) continue;

      const f = findFunc(numRaw, nomRaw);
      if(!f){ if(numRaw) unmatched.push(`${numRaw} ${nomRaw}`); continue; }

      for(let m = 0; m < 12; m++){
        const b = firstCol + m * 4;
        const desde = parseInt(row[b]);
        const al    = parseInt(row[b+1]);
        if(!desde || !al || isNaN(desde) || isNaN(al)) continue;
        if(desde < 1 || al > 31 || al < desde) continue;
        const yr = new Date().getFullYear();
        recs.push({
          funcionario_id: f.id,
          tipo: 'LAR',
          fecha_desde: `${yr}-${String(m+1).padStart(2,'0')}-${String(desde).padStart(2,'0')}`,
          fecha_hasta:  `${yr}-${String(m+1).padStart(2,'0')}-${String(al).padStart(2,'0')}`,
          genera_vacante: true,
          estado: 'activa',
          observaciones: `Importado de ${file.name} / ${sname}`,
        });
      }
    }

    // Batch insert 100 at a time
    for(let i = 0; i < recs.length; i += 100){
      const {data: res, error} = await sb.from('licencias').insert(recs.slice(i, i+100)).select('id');
      if(res) total += res.length;
      if(error) console.warn('licImport error', error.message);
    }
  }

  if(unmatched.length) console.warn('Sin match:', unmatched);
  await loadDB();
  renderLics();
  renderLAR();
  toast('ok', `${total} licencias LAR importadas`, `${file.name}${unmatched.length ? ` · ${unmatched.length} sin match` : ''}`);
}

async function submitTrade(){
  const candSel    = TRADE_CTX.candidates?.[TRADE_CTX.selectedIdx];
  const receptor   = candSel?.name||'—';
  const miTurno    = document.getElementById('trdMiFecha')?.value||'?';
  const miCod      = document.getElementById('trdMiCod')?.value||'M';
  const suFecha    = document.getElementById('trdSuFecha')?.value||'?';
  const suCod      = document.getElementById('trdSuCod')?.value||'M';
  const motivo     = document.getElementById('trdMotivo')?.value||'';
  if(!TRADE_CTX.selectedDate){
    toast('wa','Seleccioná un día en tu agenda','Iniciá la solicitud haciendo click en un día con turno.');
    return;
  }
  if(!candSel){
    toast('wa','Seleccioná a quién solicitar','Elegí un disponible de la lista.');
    return;
  }
  if(!candSel.available){
    toast('wa','No disponible para intercambio',`Estado: ${candSel.label}. Elegí otro funcionario.`);
    return;
  }
  const solicitante = [...DB.funcionarios,...DB.suplentes].find(f=>fNombre(f)===cUser.name);
  const rec = candSel?.id ? ([...DB.funcionarios,...DB.suplentes].find(f=>String(f.id)===String(candSel.id))||null)
                          : ([...DB.funcionarios,...DB.suplentes].find(f=>fNombre(f)===receptor)||null);
  const solicitanteId = solicitante?.id;
  const receptorId = rec?.id;
  if(!solicitanteId || !receptorId){
    toast('er','Error','No se encontró el funcionario. Verificá tu perfil vinculado.');
    return;
  }

  // Prevent duplicates in-session + loaded DB (same pair and same requested swap)
  const isDupLocal = (MY_CAMBIOS||[]).some(t=>
    (t.estado||'pendiente')==='pendiente' &&
    (t.con||'')===receptor &&
    (t.miTurno||'')===`${miCod} ${miTurno}` &&
    (t.recibo||'')===`${suCod} ${suFecha}`
  );
  const isDupDb = (DB.cambios||[]).some(c=>
    c.estado==='pendiente' &&
    String(c.solicitante_id||'')===String(solicitanteId) &&
    String(c.receptor_id||'')===String(receptorId) &&
    (c.fecha_cede||'')===miTurno &&
    (c.turno_cede||'')===miCod &&
    (c.fecha_recibe||'')===suFecha &&
    (c.turno_recibe||'')===suCod
  );
  if(isDupLocal || isDupDb){
    toast('wa','Solicitud duplicada','Ya existe una solicitud pendiente con los mismos datos.');
    return;
  }

  if(sb){
    const payload = {
      solicitante_id: solicitanteId,
      receptor_id:    receptorId,
      fecha_cede:   miTurno, turno_cede:   miCod,
      fecha_recibe: suFecha, turno_recibe: suCod,
      motivo, estado:'pendiente'
    };
    const res = await saveCambio(payload);
    if(res){
      await createAlerta('info','🔄 Te proponen un cambio de turno',
        `${cUser.name} te solicita cambio: ${miCod} ${miTurno} ↔ ${suCod} ${suFecha}`,
        receptorId);
      closeM('tradeM');
      refreshTradeBadge();
      renderTrades();
      renderMySched();
      toast('in','Solicitud guardada en BD','Esperando aceptación. Visible para supervisores.');
      return;
    }
    return;
  }
  // For demo (no sb): add to DB.cambios so supervisor sees it
  if(!sb){
    MY_CAMBIOS.unshift({con:receptor, miTurno:`${miCod} ${miTurno}`, recibo:`${suCod} ${suFecha}`, estado:'pendiente', chip:'ca', label:'Pendiente'});
    refreshMyTrdBody();
    DB.cambios.unshift({
      id:Date.now(), estado:'pendiente',
      created_at: new Date().toISOString(),
      solicitante:{apellido:cUser.name.split(',')[0]||cUser.name, nombre:cUser.name.split(',')[1]||''},
      receptor:{apellido:receptor.split(',')[0]||receptor, nombre:receptor.split(',')[1]||''},
      turno_cede:`${miCod}`, fecha_cede:miTurno, turno_recibe:suCod, fecha_recibe:suFecha
    });
    const cnt=DB.cambios.filter(x=>x.estado==='pendiente').length;
    document.getElementById('tradeBadge').textContent=cnt||'';
  }
  closeM('tradeM');
  renderMySched();
  toast('in','Solicitud enviada','El supervisor la verá en Cambios de Turno.');
}

function refreshMyTrdBody(){
  const body=document.getElementById('myTrdBody');
  if(!body) return;
  const stChip={aprobado:'cg',rechazado:'cr',pendiente:'ca',aceptado:'cb2'};
  const stLabel={aprobado:'Aprobado ✓',rechazado:'Rechazado',pendiente:'Pendiente',aceptado:'Aceptado — pend. supervisor'};
  body.innerHTML=MY_CAMBIOS.map(t=>`
    <tr>
      <td>${t.con}</td>
      <td class="mn">${t.miTurno}</td>
      <td class="mn">${t.recibo}</td>
      <td><span class="chip ${stChip[t.estado]||'ca'}">${stLabel[t.estado]||t.estado}</span></td>
    </tr>`).join('');
}

// ........................................................
// GENERATION PREVIEW + VALIDATION
// ........................................................
function previewGen(genIdx){
  window._currentGenIdx = genIdx??0;
  const g = GENS[window._currentGenIdx];
  if(g) document.querySelector('#genValidM .mh-t').textContent=`Planilla — ${g.mes}`;
  openM('genValidM');
  renderGenGrid();
}

function renderGenGrid(){
  const grid=document.getElementById('genValGrid'); if(!grid) return;
  const gi=window._currentGenIdx??0;
  const gen=GENS[gi];
  const year=gen?.anio||SCHED_CTX.year;
  const month=gen?(gen.mesNum-1):SCHED_CTX.month;
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  const days=Array.from({length:daysInMonth},(_,i)=>i+1);

  let h=`<table class="ctbl" style="min-width:${daysInMonth*38+180}px"><thead><tr><th class="thn">Funcionario</th>`;
  days.forEach(d=>{
    const wd=(new Date(Date.UTC(year,month,d)).getUTCDay()+6)%7;
    const ab=DAB[wd]; const wk=wd>=5;
    h+=`<th class="${wk?'thw':''}" style="min-width:32px;padding:2px 1px"><div style="font-size:7px">${ab}</div><div style="font-family:var(--ff-mono);font-weight:700;font-size:10px">${d}</div></th>`;
  });
  h+='</tr></thead><tbody>';

  SGRP.forEach(grp=>{
    h+=`<tr class="csr"><td colspan="${daysInMonth+1}">${grp.sector}</td></tr>`;
    grp.emps.forEach(emp=>{
      const empObj=DB.funcionarios.find(f=>fNombre(f)===emp)||DB.suplentes.find(f=>fNombre(f)===emp);
      const empId=empObj?.id;
      let workDays=0;
      const dayCodes=days.map(d=>{
        const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const wd=(new Date(Date.UTC(year,month,d)).getUTCDay()+6)%7;
        let code=(empId&&dbLoaded)?getTurnoFecha(empId,dateStr)||'':'';
        if(!code){ code=(WK[emp]||[])[wd]||''; }
        if(code&&isW(code)) workDays++;
        return code;
      });
      const is7=workDays>=7;
      h+=`<tr class="cnr"><td class="cnm" style="min-width:140px">${emp}${is7?' <span class="chip cr" style="font-size:8px" title="7ª guardia consecutiva">7ª</span>':''}</td>`;
      days.forEach((d,i)=>{
        const code=dayCodes[i];
        const wd=(new Date(Date.UTC(year,month,d)).getUTCDay()+6)%7; const wk=wd>=5;
        const cls=is7&&code&&isW(code)?'s7':shCls(code);
        h+=`<td class="ccc${wk?' ccw':''}" onclick="editGenCell(this,'${emp}',${d})" title="${code||'—'}">`;
        if(code) h+=`<span class="sh ${cls}" style="font-size:9px;padding:1px 3px">${code}</span>`;
        h+='</td>';
      });
      h+='</tr>';
    });
  });
  h+='</tbody></table>';
  grid.innerHTML=h;
}

function editGenCell(td, emp, day){
  const cur=td.querySelector('.sh')?.textContent||'';
  td.innerHTML='';
  const inp=document.createElement('input');
  inp.type='text'; inp.value=cur; inp.maxLength=5;
  inp.style.cssText='width:44px;background:var(--bg3);border:1px solid var(--blue);color:var(--text);padding:2px 4px;border-radius:4px;font-size:10px;font-family:var(--ff-mono);text-align:center';
  inp.addEventListener('blur',()=>saveGenCell(inp,emp,day));
  inp.addEventListener('keydown',e=>{
    if(e.key==='Enter') inp.blur();
    if(e.key==='Escape'){ inp.value=cur; inp.blur(); }
  });
  td.appendChild(inp);
  inp.select();
}

async function saveGenCell(inp, emp, day){
  const val=inp.value.trim().toUpperCase();
  const td=inp.parentElement;
  td.innerHTML=val?`<span class="sh ${shCls(val)}">${esc(val)}</span>`:'';
  if(!val) return;
  const gi=window._currentGenIdx??0;
  const gen=GENS[gi];
  const year=gen?.anio||SCHED_CTX.year;
  const month=gen?(gen.mesNum-1):SCHED_CTX.month;
  const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const empObj=[...DB.funcionarios,...DB.suplentes].find(f=>fNombre(f)===emp);
  if(empObj?.id && sb){
    await saveTurno(empObj.id, dateStr, val, empObj.sector_id||null, '');
    toast('ok',`${emp} · día ${day} → ${val}`,'Guardado en BD');
    if(gen?.estado==='aprobada') _showPostApprovalPrompt(empObj, year, month+1);
  } else {
    toast('in',`Editado: ${emp} · día ${day}`,'Cambio local — sincronizá para persistir');
  }
}

async function approveGen(){
  closeM('genValidM');
  const gi = window._currentGenIdx??0;
  if(!GENS[gi]) return;
  if(sb && GENS[gi].id){
    const ok=await updateGeneracion(GENS[gi].id, {estado:'aprobada'});
    if(!ok){ toast('er','Error','No se pudo aprobar la planilla en BD'); return; }
  }
  GENS[gi].estado='aprobada';
  renderGenHistory();
  populateSendMes();
  if(sb) await createAlerta('ok',`Planilla ${GENS[gi].mes} aprobada`,'Aprobada por '+cUser.name,null);
  toast('ok',`Planilla ${GENS[gi].mes} aprobada`,'Podés enviar las agendas desde Notificaciones →');
  setTimeout(()=>go('notifications'),1200);
}

async function deleteGen(idx){
  const g = GENS[idx]; if(!g) return;

  // Resolver anio/mesNum con múltiples fallbacks
  let yr = g.anio, mo = g.mesNum;
  if(!yr || !mo){
    // Fallback 1: parsear etiqueta texto "Enero 2026"
    const p = parseMesLabel(g.mes||'');
    if(p){ yr = p.year; mo = p.month + 1; }
    // Fallback 2: mes almacenado como número entero en BD
    else if(!isNaN(parseInt(g.mes)) && g.anio){
      mo = parseInt(g.mes); yr = g.anio;
    } else {
      toast('er','Error','No se puede determinar el mes. Corré la migración SQL en Supabase.');
      return;
    }
  }

  if(!(await new Promise(r => appConfirm('Eliminar generación', `¿Eliminar la generación de ${genLabel(g)}? Se borrarán todos los turnos del mes. Esta acción no se puede deshacer.`, r, 'Eliminar')))) return;

  if(sb){
    const mm     = String(mo).padStart(2,'0');
    const desde  = `${yr}-${mm}-01`;
    const lastDay= new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    const hasta  = `${yr}-${mm}-${String(lastDay).padStart(2,'0')}`;

    // 1. Borrar turnos del mes
    const {error:tErr} = await sb.from('turnos').delete().gte('fecha', desde).lte('fecha', hasta);
    if(tErr){ toast('er','Error al eliminar turnos', tErr.message); return; }
    DB.turnos = DB.turnos.filter(t => t.fecha < desde || t.fecha > hasta);

    // 2. Borrar registro de generación
    if(g.id){
      const ok = await deleteGeneracion(g.id);
      if(!ok){ toast('er','Error','No se pudo eliminar el registro de generación en BD'); return; }
    }
  }

  GENS.splice(idx, 1);
  renderGenHistory();
  populateSendMes();
  populateGenMesOptions();
  buildDynamicData();
  // Actualizar planificación para que el mes eliminado desaparezca del selector
  ensureScheduleMonthSel();
  renderCal();
  renderDashAlerts(); renderDashboard();
  toast('ok', `${genLabel(g)} eliminado`, 'Turnos y registro borrados de la base de datos');
}

async function deleteOrphanMonth(key){
  // key = "yyyy-MM" (1-indexed)
  const m = String(key||'').match(/^(\d{4})-(\d{2})$/);
  if(!m) return;
  const yr=parseInt(m[1],10), mo=parseInt(m[2],10);
  const label = getMonthLabel(yr, mo-1);
  if(!(await new Promise(r => appConfirm('Borrar turnos huérfanos', `¿Borrar todos los turnos huérfanos de ${label}? Estos turnos no tienen generación asociada. No se puede deshacer.`, r, 'Borrar')))) return;
  if(sb){
    const desde = `${yr}-${String(mo).padStart(2,'0')}-01`;
    const lastDay = new Date(Date.UTC(yr, mo, 0)).getUTCDate();
    const hasta = `${yr}-${String(mo).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
    const {error} = await sb.from('turnos').delete().gte('fecha',desde).lte('fecha',hasta);
    if(error){ toast('er','Error al eliminar turnos',error.message); return; }
    DB.turnos = DB.turnos.filter(t=>t.fecha<desde||t.fecha>hasta);
  }
  buildDynamicData();
  ensureScheduleMonthSel();
  renderCal();
  renderGenHistory();
  renderDashAlerts(); renderDashboard();
  toast('ok',`${label} limpiado`,'Turnos huérfanos borrados de la base de datos');
}

function downloadGenXLSX(genIdx){
  if(typeof XLSX==='undefined'){toast('er','Error','Librería XLSX no disponible.');return;}
  const gi=genIdx??window._currentGenIdx??0;
  const gen=GENS[gi];
  if(!gen){toast('er','Error','Generación no encontrada.');return;}

  const year=gen.anio, mi=gen.mesNum-1, mesLabel=gen.mes;
  const nDays=new Date(year,mi+1,0).getDate();
  const m2=String(mi+1).padStart(2,'0');
  const mesFrom=`${year}-${m2}-01`, mesTo=`${year}-${m2}-${String(nDays).padStart(2,'0')}`;
  const allDays=Array.from({length:nDays},(_,i)=>`${year}-${m2}-${String(i+1).padStart(2,'0')}`);
  const DAY_ES=['LU','MA','MI','JU','VI','SÁ','DO'];

  // ── Turno map from in-memory DB.turnos ─────────────────────────────────────
  const tmap={};
  (DB.turnos||[]).forEach(t=>{
    if(t.fecha<mesFrom||t.fecha>mesTo) return;
    if(!tmap[t.funcionario_id]) tmap[t.funcionario_id]={};
    tmap[t.funcionario_id][t.fecha]=t.codigo;
  });

  // ── Licencia days per fijo ──────────────────────────────────────────────────
  const licDays={};
  (DB.licencias||[]).filter(l=>l.estado!=='cancelada'&&l.fecha_desde<=mesTo&&l.fecha_hasta>=mesFrom)
    .forEach(lic=>{
      const fid=lic.funcionario_id;
      if(!licDays[fid]) licDays[fid]=new Set();
      allDays.forEach(d=>{if(d>=lic.fecha_desde&&d<=lic.fecha_hasta) licDays[fid].add(d);});
    });

  // ── Suplente assignments + coverage summary ─────────────────────────────────
  // Lógica idéntica al script Python export_marzo_excel.py / export_abril_excel.py
  const supDays={};    // {supId: {fecha: turnoCode}}
  const supWorkload={}; // {supId: Set<fecha>} — para calcular carga y detectar conflictos
  const coverage=[];
  // Disponibilidad desde DB (campo seteado por SQL migration).
  // Equivale a get_disp() del Python: tarde-vespertino→['T','V'], mañana-tarde→['M','T'], total→['M','T','V','N']
  const DISP_ALLOW={'tarde-vespertino':['T','V'],'mañana-tarde':['M','T'],'total':['M','T','V','N']};

  (DB.licencias||[]).filter(l=>l.genera_vacante&&l.estado!=='cancelada'&&l.fecha_desde<=mesTo&&l.fecha_hasta>=mesFrom)
    .forEach(lic=>{
      const licList=allDays.filter(d=>d>=lic.fecha_desde&&d<=lic.fecha_hasta);
      if(!licList.length) return;
      const fijo=DB.funcionarios.find(f=>f.id===lic.funcionario_id)||{};
      const fijoName=`${fijo.apellido||'?'} ${fijo.nombre||''}`.trim();
      const fijoTurno=fijo.turno_fijo||'M'; // código base: 'M','T','V','N'
      if(lic.suplente_id){
        // Suplente ya asignado en DB — igual que Python: "if sid: for ds: sup_days[sid][ds]=fijo_turno"
        if(!supDays[lic.suplente_id]) supDays[lic.suplente_id]={};
        if(!supWorkload[lic.suplente_id]) supWorkload[lic.suplente_id]=new Set();
        licList.forEach(d=>{supDays[lic.suplente_id][d]=fijoTurno; supWorkload[lic.suplente_id].add(d);});
        const sup=DB.suplentes.find(s=>s.id===lic.suplente_id)||{};
        coverage.push({fijoName,supName:`${sup.apellido||'?'} ${sup.nombre||''}`.trim(),days:licList,turno:fijoTurno,origen:'DB'});
      } else {
        // Auto-asignar — idéntico al Python:
        // "if fijo_turno not in disp['turnos']: continue"  → match exacto sobre turno_fijo
        // "if any(ds in sup_workload[sup_id] for ds in lic_days): continue"
        // "score = -len(sup_workload[sup_id])"  → menor carga = mejor candidato
        let best=null,bestScore=-Infinity;
        DB.suplentes.forEach(sup=>{
          const allow=DISP_ALLOW[sup.disponibilidad||'total']||['M','T','V','N'];
          if(!allow.includes(fijoTurno)) return; // match exacto como Python
          const wl=supWorkload[sup.id]||new Set();
          if(licList.some(d=>wl.has(d))) return; // conflicto de días
          const score=-(wl.size);
          if(score>bestScore){bestScore=score;best=sup;}
        });
        if(best){
          if(!supDays[best.id]) supDays[best.id]={};
          if(!supWorkload[best.id]) supWorkload[best.id]=new Set();
          licList.forEach(d=>{supDays[best.id][d]=fijoTurno; supWorkload[best.id].add(d);});
          coverage.push({fijoName,supName:`${best.apellido||'?'} ${best.nombre||''}`.trim(),days:licList,turno:fijoTurno,origen:'AUTO'});
        } else {
          coverage.push({fijoName,supName:'??? SIN SUPLENTE',days:licList,turno:fijoTurno,origen:'NONE'});
        }
      }
    });

  // ── Group fijos by sector ────────────────────────────────────────────────────
  // Orden idéntico al Python: sorted por (sector_label, apellido, nombre)
  const secGroups={};
  [...DB.funcionarios]
    .sort((a,b)=>{
      const sa=a.sector?.nombre||'Sin sector', sb=b.sector?.nombre||'Sin sector';
      if(sa!==sb) return sa.localeCompare(sb);
      const ap=(a.apellido||'').localeCompare(b.apellido||'');
      if(ap!==0) return ap;
      return (a.nombre||'').localeCompare(b.nombre||'');
    })
    .forEach(f=>{
      const sn=f.sector?.nombre||'Sin sector';
      if(!secGroups[sn]) secGroups[sn]=[];
      secGroups[sn].push(f);
    });
  // sectores ya en orden porque los fijos se insertaron ordenados
  const sortedSecs=Object.entries(secGroups);

  // ── Style helpers ────────────────────────────────────────────────────────────
  // HDR = azul oscuro (encabezado principal), HDR2 = azul medio (días de semana)
  // Matches Python: FILL_HDR='2F5496', FILL_HDR2='4472C4'
  const HDR='2F5496',HDR2='4472C4',SEP='DDEBF7',SAB='FFF9E6',DOM='FDE9E0';
  const PAL=[['1F4E79','D6E4F7'],['375623','D8F0C8'],['843C0C','FCE8D8'],['4B2C8C','EAD9F7'],['7B2D00','FAD5B5'],['005757','C8EFEF']];
  const TCOLORS={M:'BDD7EE',T:'FCE4D6',V:'E2EFDA',N:'D6DCE4',CMP:'FFD966',LIC:'D9D9D9',
    MS:'BDD7EE',MC:'BDD7EE',MG:'BDD7EE',MO:'BDD7EE',MU:'BDD7EE',MD:'BDD7EE',I:'BDD7EE',
    TS:'FCE4D6',TG:'FCE4D6',TO:'FCE4D6',TU:'FCE4D6',TD:'FCE4D6',RS:'FCE4D6',E:'FCE4D6',
    NO:'EDE9FE',NU:'EDE9FE',VO:'ECFDF5',VU:'ECFDF5',VD:'ECFDF5',
    LE:'FFEDD5',FI:'FEE2E2',CERT:'A7F3D0',BPS:'A7F3D0',BSE:'A7F3D0',LAR:'D1FAE5',LM:'D1FAE5'};
  TCOLORS['TC']='FCE4D6'; // key 'TC' outside literal to avoid parse ambiguity with var name

  function mk(v,bg,bold,center,white,italic){
    const s={font:{bold:!!bold,italic:!!italic,size:9,color:{rgb:white?'FFFFFF':'1A1A1A'}},
             alignment:{horizontal:center?'center':'left',vertical:'center',wrapText:true}};
    if(bg) s.fill={fgColor:{rgb:bg}};
    return {v:v===undefined||v===null?'':v, t:typeof v==='number'?'n':'s', s};
  }
  function dayC(code,ds){
    const wd=(new Date(ds+'T12:00:00').getUTCDay()+6)%7; // 0=Mon,5=Sat,6=Sun
    const wkBg=wd===5?SAB:wd===6?DOM:null;
    if(!code){
      const s={alignment:{horizontal:'center',vertical:'center'}};
      if(wkBg) s.fill={fgColor:{rgb:wkBg}};
      return {v:'',t:'s',s};
    }
    const bg=TCOLORS[code]||wkBg;
    const s={font:{size:8},alignment:{horizontal:'center',vertical:'center'}};
    if(bg) s.fill={fgColor:{rgb:bg}};
    return {v:code,t:'s',s};
  }
  // Day header: weekdays=HDR2(4472C4), Sat=SAB, Sun=DOM — matches Python FILL_HDR2
  function dayHdr(ds){
    const wd=(new Date(ds+'T12:00:00').getUTCDay()+6)%7;
    const dayNum=parseInt(ds.slice(-2));
    const bg=wd===5?SAB:wd===6?DOM:HDR2;
    const whiteText=wd<5; // white text on blue, black text on Sat/Sun tints
    return {v:`${dayNum}\n${DAY_ES[wd]}`,t:'s',s:{fill:{fgColor:{rgb:bg}},font:{bold:true,color:{rgb:whiteText?'FFFFFF':'000000'},size:8},alignment:{horizontal:'center',vertical:'center',wrapText:true}}};
  }

  // ── Build rows ───────────────────────────────────────────────────────────────
  const ncols=5+nDays;
  const rows=[];
  const mergeRows=[];
  function addMerge(text,bg,bold,white){
    mergeRows.push(rows.length);
    rows.push([mk(text,bg,bold,false,white),...Array(ncols-1).fill(mk('',bg))]);
  }

  // Title: white background, blue bold text size 13 — matches Python FONT_TITLE
  mergeRows.push(rows.length);
  rows.push([{v:`PLANIFICACIÓN ${mesLabel.toUpperCase()}  —  MP ENFERMERÍA`,t:'s',s:{font:{bold:true,size:13,color:{rgb:'2F5496'}},alignment:{horizontal:'center',vertical:'center'}}},...Array(ncols-1).fill({v:'',t:'s'})]);

  // Column header: NRO/NOMBRE/SECTOR/PAT/TF on HDR(2F5496), day cols on HDR2(4472C4)
  rows.push([mk('NRO',HDR,true,true,true),mk('NOMBRE',HDR,true,false,true),mk('SECTOR',HDR,true,false,true),mk('PAT',HDR,true,true,true),mk('TF',HDR,true,true,true),...allDays.map(dayHdr)]);

  // Fijos grouped by sector
  sortedSecs.forEach(([sn,emps],si)=>{
    const [hc,rc]=PAL[si%PAL.length];
    addMerge(`  \u258c ${sn.toUpperCase()}  (${emps.length} empleados)`,hc,true,true);
    emps.forEach((f,ei)=>{
      const bg=ei%2===1?rc:null;
      const licSet=licDays[f.id]||new Set();
      rows.push([
        mk(f.numero||'',bg,false,true),
        mk(`${f.apellido||''}${f.nombre?', '+f.nombre:''}`,bg),
        mk(sn,bg),
        mk(f.patron||'',bg,false,true),
        mk(f.turno_fijo||'',bg,false,true),
        ...allDays.map(ds=>licSet.has(ds)
          ?{v:'LIC',t:'s',s:{fill:{fgColor:{rgb:TCOLORS.LIC}},font:{size:8},alignment:{horizontal:'center',vertical:'center'}}}
          :dayC(tmap[f.id]?.[ds]||'',ds))
      ]);
    });
  });

  // Suplentes section
  rows.push(Array(ncols).fill({v:'',t:'s'}));
  addMerge('  \u258c SUPLENTES ASIGNADOS',SEP,true,false);
  rows.push([mk('',HDR,true,true,true),mk('SUPLENTE',HDR,true,false,true),mk('DISP.',HDR,true,true,true),mk('SEC',HDR,true,false,true),mk('',HDR,true,true,true),...allDays.map(dayHdr)]);

  const DLABEL={'tarde-vespertino':'T/V','mañana-tarde':'M/T','total':'TOTAL'};
  const supsConAsig=DB.suplentes.filter(s=>supDays[s.id]&&Object.keys(supDays[s.id]).length).sort((a,b)=>(a.apellido||'').localeCompare(b.apellido||''));
  const supsSin=DB.suplentes.filter(s=>!supDays[s.id]||!Object.keys(supDays[s.id]).length).sort((a,b)=>(a.apellido||'').localeCompare(b.apellido||''));

  supsConAsig.forEach(sup=>{
    // COL layout matches Python: NRO='SUP' | NOMBRE | SECTOR=disp.label | PAT=sec | TF=primary_turno
    const dispLabel=DLABEL[sup.disponibilidad]||'TOTAL';
    const secLabel=sup.sector?.nombre||'-';
    const DISP_TURNOS={'tarde-vespertino':['T','V'],'mañana-tarde':['M','T'],'total':['M','T','V','N']};
    const primaryTurno=(DISP_TURNOS[sup.disponibilidad]||['M'])[0];
    rows.push([
      mk('SUP',null,false,true),
      mk(`${sup.apellido||''}${sup.nombre?', '+sup.nombre:''}`,null),
      mk(dispLabel,null,false,true),
      mk(secLabel,null,false,false),
      mk(primaryTurno,null,false,true),
      ...allDays.map(ds=>dayC(supDays[sup.id]?.[ds]||'',ds))
    ]);
  });

  if(supsSin.length){
    // Matches Python: "Sin asignación en [Mes]: APELLIDO [T/V], ..."
    const lista=supsSin.map(s=>`${s.apellido||''} [${DLABEL[s.disponibilidad]||'TOTAL'}]`).join(', ');
    mergeRows.push(rows.length);
    rows.push([{v:`  Sin asignación en ${mesLabel}: ${lista}`,t:'s',s:{fill:{fgColor:{rgb:'FFF9C4'}},font:{italic:true,size:9,color:{rgb:'595959'}},alignment:{horizontal:'left',vertical:'center'}}},...Array(ncols-1).fill(mk('','FFF9C4'))]);
  }

  // Coverage summary
  if(coverage.length){
    rows.push(Array(ncols).fill({v:'',t:'s'}));
    addMerge('  \u258c RESUMEN DE COBERTURAS',SEP,true,false);
    rows.push([mk('Fijo ausente',HDR,true,false,true),mk('Suplente asignado',HDR,true,false,true),mk('Turno',HDR,true,true,true),mk('Desde',HDR,true,true,true),mk('Hasta',HDR,true,true,true),mk('Origen',HDR,true,true,true)]);
    coverage.forEach(({fijoName,supName,days,turno,origen})=>{
      const bg=origen==='NONE'?'FFCCCC':origen==='AUTO'?'FFF9C4':null;
      rows.push([mk(fijoName,bg),mk(supName,bg),mk(turno,bg,false,true),mk(days[0]||'',bg,false,true),mk(days[days.length-1]||'',bg,false,true),mk(origen,bg,false,true)]);
    });
  }

  // ── Build sheet ──────────────────────────────────────────────────────────────
  const wb=XLSX.utils.book_new();
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:6},{wch:24},{wch:16},{wch:5},{wch:4},...Array.from({length:nDays},()=>({wch:3.6}))];
  ws['!rows']=rows.map((_,i)=>({hpt:i===0?20:i===1?28:14}));
  ws['!merges']=mergeRows.map(ri=>({s:{r:ri,c:0},e:{r:ri,c:ncols-1}}));
  ws['!freeze']={xSplit:5,ySplit:2};

  const sheetName=mesLabel.replace(/ /g,'_').toUpperCase().slice(0,31);
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  const fname=`Planilla_${mesLabel.replace(/ /g,'_')}.xlsx`;
  XLSX.writeFile(wb,fname);
  toast('ok','Excel descargado',fname);
}

// ........................................................
// EXCEL EXPORT
// ........................................................
function downloadXLSX(){
  if(typeof XLSX==='undefined'){toast('er','Error','Librería XLSX no disponible.');return;}
  const wb=XLSX.utils.book_new();

  // RESUMEN GLOBAL
  const sumData=[['FUNCIONARIO','CLÍNICA','SECTOR','TURNO','GUARDIAS','HS. TRABAJO','OBJ. HS.','DIFERENCIA','FALTAS','LAR (días)','EXTRAS (hs)','CUMPL.%','ESTADO']];
  EMPS.forEach(e=>{
    const hs=e.g*e.hday;const obj=22*e.hday;const diff=hs-obj;const pct=Math.round(e.g/22*100);
    const status={active:'Activo',lar:'En LAR',cert:'Certificación',absent:'Falta'}[e.status]||'—';
    sumData.push([e.name,e.clinic,e.sector,e.shift,e.g,hs,obj,diff>0?'+'+diff:diff<0?diff:'=',e.faltas||0,e.status==='lar'?e.g:0,e.extras||0,pct+'%',status]);
  });
  const wsSum=XLSX.utils.aoa_to_sheet(sumData);
  wsSum['!cols']=[{wch:22},{wch:12},{wch:16},{wch:8},{wch:10},{wch:12},{wch:10},{wch:12},{wch:8},{wch:10},{wch:10},{wch:9},{wch:14}];
  XLSX.utils.book_append_sheet(wb,wsSum,'RESUMEN GLOBAL');

  // HOJAS POR CLÍNICA
  const clinics={};
  EMPS.forEach(e=>{if(!clinics[e.clinic])clinics[e.clinic]=[];clinics[e.clinic].push(e);});
  Object.entries(clinics).forEach(([clin,emps])=>{
    const d=[['FUNCIONARIO','SECTOR','TURNO','GUARDIAS','HS. TRABAJO','OBJ.','DIFERENCIA','FALTAS','EXTRAS','CUMPL.%','ESTADO']];
    emps.forEach(e=>{
      const hs=e.g*e.hday;const obj=22*e.hday;const diff=hs-obj;
      d.push([e.name,e.sector,e.shift,e.g,hs,obj,diff>0?'+'+diff:diff<0?diff:'=',e.faltas||0,e.extras||0,Math.round(e.g/22*100)+'%',{active:'Activo',lar:'En LAR',cert:'CERT',absent:'Falta'}[e.status]||'—']);
    });
    const ws=XLSX.utils.aoa_to_sheet(d);
    ws['!cols']=[{wch:22},{wch:16},{wch:8},{wch:10},{wch:12},{wch:10},{wch:12},{wch:8},{wch:10},{wch:9},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws,clin.toUpperCase().slice(0,31));
  });

  // HOJAS POR SUPLENTE
  SUBS.forEach(s=>{
    const d=[['FECHA','DÍA','CÓDIGO','TIPO','HS.','OBSERVACIÓN']];
    const sc=WK[s.name]||[];
    sc.forEach((code,i)=>{
      if(!code) return;
      const d1=i+1;
      const ab=DAB[(3+i)%7];
      d.push([`${d1.toString().padStart(2,'0')}/${String(HR_CTX.month+1).padStart(2,'0')}/${HR_CTX.year}`,ab,code,isW(code)?'Trabajo':code==='LAR'?'LAR':code==='F'?'Falta':'Licencia',isW(code)?6:0,'']);
    });
    const ws=XLSX.utils.aoa_to_sheet(d);
    ws['!cols']=[{wch:14},{wch:5},{wch:9},{wch:14},{wch:6},{wch:30}];
    const shName=s.name.replace(/\. /g,'_').replace(/\./g,'').replace(/ /g,'_').slice(0,28);
    XLSX.utils.book_append_sheet(wb,ws,shName);
  });

  // LEYENDA
  const leg=[['CÓDIGO','NOMBRE','HORARIO','HS.'],['M','Mañana estándar','06:00—12:00',6],['TS','Tarde Setiembre','12:00—18:00',6],['NO','Noche Observación','00:00—06:00',6],['VO','Vespertino Obs.','18:00—24:00',6],['LAR','Lic. Anual Reglamentaria','—',0],['CERT','Certificación médica','—',0],['F','Falta Imprevista','—  Genera vacante',0]];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(leg),'LEYENDA');

  const _hrLabel=getMonthLabel(HR_CTX.year,HR_CTX.month).replace(' ','_');
  XLSX.writeFile(wb,`RRHH_Enfermeria_${_hrLabel}.xlsx`);
  toast('ok','Excel descargado',`RRHH_Enfermeria_${_hrLabel}.xlsx — resumen por clínica + hoja por suplente`);
}

function expEmpXLSX(){
  if(typeof XLSX==='undefined'){toast('er','Error','Librería no disponible.');return;}
  const wb=XLSX.utils.book_new();
  const data=[['FUNCIONARIO','CLÍNICA','SECTOR','TURNO','GUARDIAS','HS/MES','EXTRAS','FALTAS','ESTADO']];
  DB.funcionarios.forEach(f=>data.push([fNombre(f),f.clinica?.nombre||'—',f.sector?.nombre||'—',f.turno||'—','—','—',0,0,'Activo']));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'Funcionarios');
  const _empLabel=getMonthLabel(HR_CTX.year,HR_CTX.month).replace(' ','_');
  XLSX.writeFile(wb,`Funcionarios_${_empLabel}.xlsx`);
  toast('ok','Excel exportado','Listado de funcionarios descargado.');
}

// ........................................................
// TOAST
// ........................................................
function toast(type,title,desc){
  const icons={ok:'✓',wa:'⚠️',er:'✕',in:'ℹ️'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span style="font-size:14px;margin-top:1px">${icons[type]||'•'}</span><div style="flex:1"><div class="t-t">${esc(title)}</div>${desc?`<div class="t-d">${esc(desc)}</div>`:''}</div><button class="t-x" onclick="this.parentElement.remove()">✕</button>`;
  document.getElementById('tbox').appendChild(el);
  setTimeout(()=>el.remove(),5000);
}
// Init EmailJS on load

// ........................................................
// NOTIFICACIONES
// ........................................................

async function renderNotifications(){
  const el=document.getElementById('v-notifications');
  if(!el) return;

  const aprobadas=(GENS||[]).filter(g=>g.estado==='aprobada');
  const fijos=DB.funcionarios.filter(f=>f.activo!==false&&f.tipo!=='suplente').sort((a,b)=>fNombre(a).localeCompare(fNombre(b),'es'));
  const mesesOpts=aprobadas.map(g=>{
    const v=`${g.anio}-${String(g.mesNum).padStart(2,'0')}`;
    return `<option value="${v}">${g.mes}</option>`;
  }).join('');
  const empOpts=fijos.map(f=>`<option value="${f.id}">${fNombre(f)} · ${f.sector?.nombre||'—'}</option>`).join('');

  // Historial: cargar desde Supabase independientemente del estado leida
  let historial=[];
  if(sb){
    const {data}=await sb.from('alertas')
      .select('id,tipo,titulo,descripcion,created_at,funcionario_id')
      .in('tipo',['notif_agenda','notif_aviso'])
      .order('created_at',{ascending:false})
      .limit(12);
    historial=data||[];
  } else {
    historial=(DB.alertas||[]).filter(a=>['notif_agenda','notif_aviso'].includes(a.tipo)).slice(0,12);
  }

  el.innerHTML=`
  <div style="max-width:900px;display:flex;flex-direction:column;gap:14px">

    <!-- Agendas mensuales -->
    <div class="card">
      <div class="ch">
        <div class="ct">📅 Agendas mensuales</div>
      </div>
      <div class="cb">
        <div style="font-size:11px;color:var(--t3);margin-bottom:14px">Planillas aprobadas listas para enviar a los funcionarios.</div>
        ${aprobadas.length ? aprobadas.map(g=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--b);gap:12px">
            <div>
              <div style="font-size:13px;font-weight:600">${g.mes}</div>
              <div style="font-size:11px;color:var(--t3);margin-top:2px">${fijos.length} funcionarios · <span style="color:var(--green)">Aprobada ✓</span></div>
            </div>
            <div style="display:flex;gap:8px;flex-shrink:0">
              <button class="btn bg sm" onclick="previewNotifAgenda('${g.anio}-${String(g.mesNum).padStart(2,'0')}')">👁 Vista previa</button>
              <button class="btn bp sm" onclick="sendAllAgendas('${g.anio}-${String(g.mesNum).padStart(2,'0')}',this)">📨 Enviar todas</button>
            </div>
          </div>`).join('')
        : '<div style="color:var(--t3);font-size:12px;padding:6px 0">No hay planillas aprobadas aún.</div>'}
      </div>
    </div>

    <!-- Envío individual -->
    <div class="card">
      <div class="ch"><div class="ct">👤 Enviar agenda individual</div></div>
      <div class="cb">
        <div class="fr" style="grid-template-columns:2fr 1fr">
          <div class="fg">
            <label>Funcionario</label>
            <select id="notifEmp">${empOpts}</select>
          </div>
          <div class="fg">
            <label>Mes</label>
            <select id="notifMes">${mesesOpts||'<option>Sin meses aprobados</option>'}</select>
          </div>
        </div>
        <button class="btn bp sm" onclick="sendIndividualAgenda()">📨 Enviar agenda</button>
      </div>
    </div>

    <!-- Redactar aviso -->
    <div class="card">
      <div class="ch"><div class="ct">📢 Redactar aviso</div></div>
      <div class="cb">
        <div class="fr">
          <div class="fg">
            <label>Tipo</label>
            <select id="notifTipo">
              <option value="cambio">🔄 Cambio de turno</option>
              <option value="aviso">📢 Aviso general</option>
              <option value="recordatorio">🔔 Recordatorio</option>
              <option value="agenda">📅 Actualización de agenda</option>
            </select>
          </div>
          <div class="fg">
            <label>Destinatarios</label>
            <select id="notifDest">
              <option value="all">Todos los funcionarios</option>
              <option value="sector">Por sector (próximamente)</option>
              <option value="individual">Individual (próximamente)</option>
            </select>
          </div>
        </div>
        <div class="fg">
          <label>Mensaje</label>
          <input id="notifMsg" type="text" placeholder="Ej: El turno del sábado 15 se pasa a las 8:00...">
        </div>
        <button class="btn bp sm" onclick="sendCustomNotif()">📨 Enviar aviso</button>
      </div>
    </div>

    <!-- Historial -->
    <div class="card">
      <div class="ch"><div class="ct">📋 Historial de notificaciones</div></div>
      <div class="cb">
        ${historial.length ? historial.map(a=>`
          <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--b);gap:12px">
            <div>
              <div style="font-size:12px;font-weight:600">${a.titulo}</div>
              <div style="font-size:11px;color:var(--t3);margin-top:2px">${a.descripcion||''}</div>
            </div>
            <span style="font-size:10px;color:var(--t3);white-space:nowrap;flex-shrink:0">${new Date(a.created_at).toLocaleDateString('es-UY')}</span>
          </div>`).join('')
        : '<div style="color:var(--t3);font-size:12px;padding:6px 0">Sin historial de envíos.</div>'}
      </div>
    </div>

  </div>`;
}

function previewNotifAgenda(mes){
  const parts=mes.split('-').map(Number);
  const y=parts[0], mNum=parts[1]||parts[0]; // handle both "2026-03" and label-based
  const fijos=DB.funcionarios.filter(f=>f.activo!==false&&f.tipo!=='suplente');
  if(!fijos.length){toast('wa','Sin funcionarios','No hay fijos activos');return;}
  const f=fijos[0];
  // Try to parse mes as YYYY-MM, fallback to current month
  let yr=y, mo=mNum;
  if(isNaN(yr)||isNaN(mo)){
    const g=(GENS||[]).find(g2=>g2.mes===mes&&g2.estado==='aprobada');
    yr=g?.anio||new Date().getFullYear();
    mo=g?.mesNum||new Date().getMonth()+1;
  }
  const html=buildRealEmailBody(f,yr,mo);
  const info=document.getElementById('notifPreviewInfo');
  const body=document.getElementById('notifPreviewBody');
  if(info) info.innerHTML=`Vista previa: <strong>${fNombre(f)}</strong> · Planilla ${yr}-${String(mo).padStart(2,'0')} · ${fijos.length} funcionarios en total`;
  if(body){
    body.innerHTML='';
    const iframe=document.createElement('iframe');
    iframe.style.cssText='width:100%;height:520px;border:none;display:block';
    body.appendChild(iframe);
    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
  }
  openM('notifPreviewM');
}

async function sendAllAgendas(mes, btn){
  if(!ejReady){toast('wa','EmailJS no listo','Recargá la página e intentá de nuevo');return;}
  const parts=String(mes).split('-').map(Number);
  let yr=parts[0], mo=parts[1];
  if(!yr||!mo){
    const g=(GENS||[]).find(g2=>g2.mes===mes&&g2.estado==='aprobada');
    yr=g?.anio; mo=g?.mesNum;
    if(!yr||!mo){toast('er','No se pudo determinar el mes','');return;}
  }
  const fijos=DB.funcionarios.filter(f=>f.activo!==false&&f.tipo!=='suplente');
  if(!fijos.length){toast('wa','Sin funcionarios','No hay fijos activos');return;}
  const mesStr=`${yr}-${String(mo).padStart(2,'0')}`;
  if(btn){btn.disabled=true;btn.textContent='Enviando...';}
  let ok=0, errs=0;
  for(const f of fijos){
    try{
      await sendOneAgenda(f, yr, mo, {silent:true});
      if(sb) await createAlerta('notif_agenda',
        `📅 Agenda ${mesStr} enviada — ${fNombre(f)}`,
        `Destinatario: ${EJ.testEmail} · Sector: ${f.sector?.nombre||'—'} · Turno: ${f.turno_fijo||'—'}`,
        f.id);
      ok++;
    }catch(e){ errs++; }
  }
  if(btn){btn.disabled=false;btn.textContent='📨 Enviar todas';}
  if(errs) toast('wa',`${ok} enviadas, ${errs} con error`,`Mes ${mesStr}`);
  else toast('ok',`${ok} agendas enviadas`,`Mes ${mesStr} → ${EJ.testEmail}`);
  await renderNotifications();
}

async function sendIndividualAgenda(){
  if(!ejReady){toast('wa','EmailJS no listo','Recargá la página e intentá de nuevo');return;}
  const empId=document.getElementById('notifEmp')?.value;
  const mesVal=document.getElementById('notifMes')?.value;
  if(!empId||!mesVal){toast('wa','Datos incompletos','Seleccioná funcionario y mes');return;}
  const f=DB.funcionarios.find(x=>String(x.id)===String(empId));
  if(!f){toast('er','Funcionario no encontrado','');return;}
  const parts=String(mesVal).split('-').map(Number);
  const yr=parts[0], mo=parts[1];
  if(!yr||!mo){toast('er','Mes inválido','');return;}
  await sendOneAgenda(f, yr, mo);
  if(sb) await createAlerta('notif_agenda',
    `📅 Agenda ${mesVal} enviada — ${fNombre(f)}`,
    `Destinatario: ${EJ.testEmail} · Sector: ${f.sector?.nombre||'—'} · Turno: ${f.turno_fijo||'—'}`,
    f.id);
  await renderNotifications();
}

async function sendOneAgenda(f,year,month,{silent=false}={}){
  const htmlBody=buildRealEmailBody(f,year,month);
  await emailjs.send(EJ.serviceId,EJ.templateId,{
    to_email:EJ.testEmail,
    subject:`GuardiaApp — Agenda ${year}-${String(month).padStart(2,'0')} · ${fNombre(f)}`,
    message:htmlBody,
  });
  if(!silent) toast('ok',`Agenda enviada — ${fNombre(f)}`,`→ ${EJ.testEmail}`);
}

function buildRealEmailBody(f,year,month){
  const firstDow=(new Date(year,month-1,1).getDay()+6)%7; // 0=Mon
  const lastDay=new Date(year,month,0).getDate();
  const monthStr=`${year}-${String(month).padStart(2,'0')}`;
  const monthLabel=new Date(year,month-1,1).toLocaleDateString('es-UY',{month:'long',year:'numeric'});
  const monthLabelU=monthLabel.charAt(0).toUpperCase()+monthLabel.slice(1);

  // Turnos del empleado para este mes
  const empTurnos={};
  DB.turnos.filter(t=>t.funcionario_id===f.id&&t.fecha.startsWith(monthStr)).forEach(t=>{
    empTurnos[parseInt(t.fecha.slice(8))]=t.codigo;
  });

  const shColors={
    M:'background:#dbeafe;color:#1d4ed8',
    T:'background:#fef3c7;color:#92400e',
    V:'background:#ede9fe;color:#5b21b6',
    N:'background:#4C1D95;color:#f5f3ff',
  };
  const skipCodes=new Set(['LAR','CERT','LE','F','DXF','CPL','E','CMP','LX1','LX2','LX3','LX4','LXE','MAT','PAT']);
  const fnac=f.fecha_nacimiento||'';
  const bdayDay=fnac&&parseInt(fnac.slice(5,7))===month?parseInt(fnac.slice(8)):null;

  let rows='',day=1,cellIdx=0;
  while(day<=lastDay){
    rows+='<tr>';
    for(let col=0;col<7;col++){
      if(cellIdx<firstDow&&day===1){
        rows+='<td style="background:#f5f5f5;border:1px solid #e0e0e0;padding:5px 3px;min-width:60px;"></td>';
        cellIdx++;continue;
      }
      if(day>lastDay){rows+='<td style="background:#f5f5f5;border:1px solid #e0e0e0;padding:5px 3px;min-width:60px;"></td>';cellIdx++;continue;}
      const isWknd=col>=5;
      const code=empTurnos[day];
      const isBday=bdayDay===day;
      let codeHtml='';
      if(isBday) codeHtml=`<span style="font-size:9px">🎂 CMP</span>`;
      else if(code){
        const sc=shColors[code]||'background:#f3f4f6;color:#374151';
        codeHtml=`<span style="${sc};border-radius:3px;padding:1px 4px;font-weight:700;font-size:9px">${code}</span>`;
      } else if(!isWknd) codeHtml=`<span style="font-size:9px;color:#bbb">libre</span>`;
      rows+=`<td style="border:1px solid #e0e0e0;padding:5px 3px;text-align:center;min-width:60px;${isWknd?'background:#fff8f0;':''}"><div style="font-size:9px;color:#888;margin-bottom:2px">${day}</div>${codeHtml}</td>`;
      day++;cellIdx++;
    }
    rows+='</tr>';
    if(day>lastDay)break;
  }

  const guardias=Object.values(empTurnos).filter(c=>c&&!skipCodes.has(c)).length;
  const hday=f.horas_dia||6;
  const turnoLabel={M:'Mañana',T:'Tarde',V:'Vespertino',N:'Noche'}[f.turno_fijo]||f.turno_fijo||'—';

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f0f4ff;padding:20px;margin:0">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1)">
    <div style="background:#1e3a6e;padding:20px 26px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-family:Arial Black,sans-serif;font-weight:900;font-size:20px;color:#fff">+ GuardiaApp</div>
      <div style="font-size:11px;color:#a0b4d0">${f.clinica?.nombre||''} · ${monthLabelU}</div>
    </div>
    <div style="padding:24px 26px">
      <p style="font-size:13px;color:#555;margin:0 0 6px">Hola <strong>${fNombre(f)}</strong>,</p>
      <h2 style="font-size:20px;color:#1a1a2e;margin:0 0 4px;font-family:Arial Black,sans-serif">Tu agenda para ${monthLabelU}</h2>
      <p style="font-size:11px;color:#666;margin:0 0 16px">Sector: <strong>${f.sector?.nombre||'—'}</strong> · Turno: <strong>${turnoLabel}</strong> · Patrón: <strong>${f.patron||'LV'}</strong></p>
      <table style="border-collapse:collapse;width:100%;margin:0 0 16px">
        <thead><tr>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">LUN</th>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">MAR</th>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">MIÉ</th>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">JUE</th>
          <th style="background:#3d7fff;color:#fff;padding:6px 3px;text-align:center;font-size:10px">VIE</th>
          <th style="background:#374151;color:#fcd34d;padding:6px 3px;text-align:center;font-size:10px">SÁB</th>
          <th style="background:#374151;color:#fcd34d;padding:6px 3px;text-align:center;font-size:10px">DOM</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="background:#f0f7ff;border-radius:8px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:10px">📊 Resumen del mes</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center">
          <div><div style="font-size:10px;color:#666">Guardias</div><div style="font-size:22px;font-weight:800;color:#3d7fff">${guardias}</div></div>
          <div><div style="font-size:10px;color:#666">Hs. trabajo</div><div style="font-size:22px;font-weight:800;color:#1ec97e">${guardias*hday}</div></div>
          <div><div style="font-size:10px;color:#666">Días libres</div><div style="font-size:22px;font-weight:800;color:#888">${lastDay-guardias}</div></div>
          <div><div style="font-size:10px;color:#666">Extras</div><div style="font-size:22px;font-weight:800;color:#f5a623">0</div></div>
        </div>
      </div>
      <div style="font-size:11px;color:#444;margin-bottom:6px"><strong>Recordatorios:</strong></div>
      <div style="font-size:10px;color:#555;line-height:1.9">
        🔄 Cambios de turno: GuardiaApp → Mi Agenda → Solicitar Cambio<br>
        🔔 Ausencias: informar con 24hs de anticipación a supervisora
      </div>
    </div>
    <div style="background:#f8faff;border-top:1px solid #e0e8ff;padding:12px 26px;font-size:9px;color:#999">
      GuardiaApp · ${new Date().toLocaleDateString('es-UY')} · Mensaje automático — no responder.
    </div>
  </div></body></html>`;
}

async function sendCustomNotif(){
  const tipo=document.getElementById('notifTipo')?.value||'aviso';
  const dest=document.getElementById('notifDest')?.value||'all';
  const msg=document.getElementById('notifMsg')?.value?.trim();
  if(!msg){toast('wa','Mensaje vacío','Escribí el aviso antes de enviar');return;}
  const tipoLabel={cambio:'🔄 Cambio de turno',aviso:'📢 Aviso general',recordatorio:'🔔 Recordatorio',agenda:'📅 Actualización de agenda'}[tipo]||tipo;
  const titulo=`${tipoLabel}`;
  const desc=msg.slice(0,200)+' — Por '+(cUser?.name||'Supervisora');
  if(dest==='all'){
    // broadcast: funcionario_id null = visible a todos
    if(sb) await createAlerta('notif_aviso',titulo,desc,null);
    toast('ok','Aviso registrado',`Destinatarios: todos los funcionarios`);
  } else {
    // sector/individual: persiste como broadcast por ahora y avisa
    if(sb) await createAlerta('notif_aviso',titulo,desc,null);
    toast('ok','Aviso registrado',`Filtro por ${dest==='sector'?'sector':'funcionario'} disponible próximamente`);
  }
  const inp=document.getElementById('notifMsg'); if(inp) inp.value='';
  await renderNotifications();
}

// ........................................................
// SECTORES CRUD
// ........................................................
function renderSectors(){
  if(!dbLoaded){ document.getElementById('sectorsBody').innerHTML='<tr><td colspan="4" style="color:var(--t3);padding:20px;text-align:center">Cargando...</td></tr>'; return; }
  const funcsAll = [...(DB.funcionariosAll||[]), ...(DB.suplentesAll||[])];
  const rows = (DB.sectores||[]).map(s=>{
    const count = funcsAll.filter(f=>f.sector?.nombre===s.nombre).length;
    return `<tr>
      <td><strong>${s.nombre}</strong></td>
      <td>${s.codigo||'—'}</td>
      <td>${count}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="btn bg sm" onclick="openSectorModal('${s.id}')">✏️ Editar</button>
        <button class="btn sm" style="color:var(--red)" onclick="deleteSector('${s.id}','${s.nombre.replace(/'/g,"\\'")}')">🗑</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="4" style="color:var(--t3);padding:20px;text-align:center">No hay sectores cargados</td></tr>';
  document.getElementById('sectorsBody').innerHTML = rows;
}

function openSectorModal(id){
  document.getElementById('sSectorId').value = id||'';
  if(id){
    const s = (DB.sectores||[]).find(x=>x.id===id);
    document.getElementById('sectorMTitle').textContent = '🏥 Editar Sector';
    document.getElementById('sSectorNombre').value = s?.nombre||'';
    document.getElementById('sSectorCodigo').value = s?.codigo||'';
  } else {
    document.getElementById('sectorMTitle').textContent = '🏥 Nuevo Sector';
    document.getElementById('sSectorNombre').value = '';
    document.getElementById('sSectorCodigo').value = '';
  }
  openM('sectorM');
}

async function saveSector(){
  if(!sb){ toast('er','Sin conexión','Supabase no iniciado'); return; }
  const id = document.getElementById('sSectorId').value||null;
  const nombre = document.getElementById('sSectorNombre').value.trim().toUpperCase();
  const codigo = document.getElementById('sSectorCodigo').value.trim().toUpperCase();
  if(!nombre){ toast('wa','Nombre requerido','Ingresá el nombre del sector'); return; }
  let error;
  if(id){
    ({error} = await sb.from('sectores').update({nombre,codigo}).eq('id',id));
  } else {
    ({error} = await sb.from('sectores').insert({nombre,codigo}));
  }
  if(error){ toast('er','Error guardando sector',error.message); return; }
  toast('ok',id?'Sector actualizado':'Sector creado',nombre);
  closeM('sectorM');
  const {data} = await sb.from('sectores').select('id,nombre,codigo').order('nombre');
  if(data){ DB.sectores = data; populateSels(); }
  renderSectors();
}

async function deleteSector(id, nombre){
  if(!sb){ toast('er','Sin conexión','Supabase no iniciado'); return; }
  const funcsAll = [...(DB.funcionariosAll||[]), ...(DB.suplentesAll||[])];
  const count = funcsAll.filter(f=>f.sector?.nombre===nombre).length;
  if(count > 0){ toast('wa','No se puede eliminar',`${count} funcionario(s) usan este sector`); return; }
  if(!(await new Promise(r => appConfirm('Eliminar sector', `¿Eliminar el sector "${nombre}"?`, r, 'Eliminar')))) return;
  const {error} = await sb.from('sectores').delete().eq('id',id);
  if(error){ toast('er','Error eliminando sector',error.message); return; }
  toast('ok','Sector eliminado',nombre);
  DB.sectores = (DB.sectores||[]).filter(s=>s.id!==id);
  populateSels();
  renderSectors();
}

// ........................................................
// GESTIÓN DE CONTRASEÑAS DE USUARIOS
// ........................................................

function openResetPassModal(email, name){
  document.getElementById('rpUserEmail').value = email;
  document.getElementById('rpNewPass').value   = 'Clinica2026!';
  document.getElementById('rpMustChange').value = '1';
  document.getElementById('resetPassMTitle').textContent = `🔑 Resetear contraseña — ${name}`;
  openM('resetPassM');
}

async function saveResetPass(){
  if(!sb){ toast('er','Sin conexión',''); return; }
  const userEmail   = document.getElementById('rpUserEmail')?.value||'';
  const newPassword = (document.getElementById('rpNewPass')?.value||'').trim();
  const mustChange  = document.getElementById('rpMustChange')?.value === '1';
  if(newPassword.length < 6){ toast('er','Contraseña muy corta','Mínimo 6 caracteres.'); return; }
  const btn = document.querySelector('#resetPassM .btn.bp');
  if(btn){ btn.disabled=true; btn.textContent='Guardando...'; }
  try {
    const {data:{session}} = await sb.auth.getSession();
    if(!session){ toast('er','Sin sesión','Recargá la página e ingresá de nuevo.'); return; }
    const res = await fetch('/.netlify/functions/admin-reset-password', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` },
      body: JSON.stringify({ userEmail, newPassword, mustChange })
    });
    if(!res.ok){
      const err = await res.json().catch(()=>({}));
      toast('er','Error al resetear', err.error||'Error desconocido'); return;
    }
    toast('ok','Contraseña actualizada', mustChange?'El usuario deberá cambiarla al ingresar.':'Contraseña lista.');
    // Actualizar indicador local
    const dbU = DB.usuarios.find(u=>u.email===userEmail);
    if(dbU) dbU.must_change_password = mustChange;
    closeM('resetPassM');
    renderUsers();
  } finally {
    if(btn){ btn.disabled=false; btn.textContent='💾 Guardar'; }
  }
}

// ........................................................
// MIGRAR CUENTAS AUTH AL DOMINIO @guardiapp.app
// ........................................................
async function migrateAuthAccounts(){
  if(!sb){ toast('er','Sin conexión',''); return; }
  appConfirm(
    'Migrar cuentas Auth',
    'Esto actualizará TODOS los usuarios de Supabase Auth que no usen @guardiapp.app al dominio correcto. Operación segura, no cambia contraseñas. ¿Continuar?',
    async () => {
      const btn = document.querySelector('button[onclick="migrateAuthAccounts()"]');
      if(btn){ btn.disabled=true; btn.textContent='Migrando...'; }
      try {
        const { data:{ session } } = await sb.auth.getSession();
        const token = session?.access_token;
        if(!token){ toast('er','Sin sesión','Recargá e intentá de nuevo.'); return; }
        const res = await fetch('/.netlify/functions/admin-migrate-auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        });
        const result = await res.json();
        if(!res.ok){ toast('er','Error', result.error||res.status); return; }
        const { total, migrated, skipped, errors } = result;
        if(migrated > 0){
          toast('ok', `${migrated} cuenta(s) migradas`, `${skipped} ya correctas · ${errors} errores de ${total} total`);
          await sb.from('usuarios').select('*').limit(1); // trigger reload
        } else if(errors > 0){
          toast('er', `${errors} error(es)`, `Revisá la consola para detalles`);
          console.error('[migrateAuth] errors:', result.detail?.errors);
        } else {
          toast('ok', 'Todo en orden', `Todas las ${total} cuentas ya usan @guardiapp.app`);
        }
        console.log('[migrateAuth] result:', result);
      } catch(e){
        toast('er','Error inesperado', e.message);
      } finally {
        if(btn){ btn.disabled=false; btn.textContent='🔧 Migrar cuentas'; }
      }
    },
    'Migrar'
  );
}

// Paso 1: abrir modal con confirmación previa
async function bulkCreateUsers(){
  if(!sb){ toast('er','Sin conexión',''); return; }
  if(!dbLoaded){ toast('wa','Esperá','La base de datos aún está cargando.'); return; }
  const allFuncs = [...(DB.funcionariosAll||DB.funcionarios), ...(DB.suplentesAll||DB.suplentes)]
    .filter(f => f.activo !== false && f.id);
  const {data:allUsers} = await sb.from('usuarios').select('email,funcionario_id');
  const existingFuncIds = new Set((allUsers||[]).map(u=>String(u.funcionario_id)).filter(Boolean));
  window._bulkMissing   = allFuncs.filter(f => !existingFuncIds.has(String(f.id)));
  window._bulkEmails    = new Set((allUsers||[]).map(u=>u.email).filter(Boolean));
  if(!window._bulkMissing.length){
    toast('ok','Sin pendientes','Todos los funcionarios ya tienen usuario en el sistema.'); return;
  }
  // Mostrar pane de confirmación
  document.getElementById('bulkConfirmPane').style.display='';
  document.getElementById('bulkRunPane').style.display='none';
  document.getElementById('bulkCloseBtn').style.display='none';
  document.getElementById('bulkSteps').innerHTML='';
  document.getElementById('bulkSummary').style.display='none';
  document.getElementById('bulkConfirmMsg').textContent=
    `Se van a crear ${window._bulkMissing.length} usuario(s) con contraseña "Clinica2026!" y cambio obligatorio al primer login.`;
  openM('bulkUsersM');
}

// Paso 2: ejecutar el proceso con log en tiempo real
async function bulkCreateStart(){
  const missing  = window._bulkMissing||[];
  const existingEmails = window._bulkEmails||new Set();
  if(!missing.length){ closeM('bulkUsersM'); return; }

  // Cambiar a pane de proceso
  document.getElementById('bulkConfirmPane').style.display='none';
  document.getElementById('bulkRunPane').style.display='';
  const stepsEl  = document.getElementById('bulkSteps');
  const statusEl = document.getElementById('bulkStatus');
  const spinEl   = document.getElementById('bulkSpin');

  const log = (icon, username, msg, color) => {
    stepsEl.insertAdjacentHTML('beforeend',
      `<div style="padding:4px 2px;border-bottom:1px solid var(--brd);color:${color||'var(--t2)'}">
        <span style="display:inline-block;width:16px;text-align:center">${icon}</span>
        <strong>${username}</strong> — ${msg}
      </div>`);
    stepsEl.scrollTop = stepsEl.scrollHeight;
  };

  // Obtener token de sesión para llamar a la función admin
  const {data:{session}} = await sb.auth.getSession();
  const token = session?.access_token;
  if(!token){ log('✗','—','Sin sesión activa','var(--red)'); return; }

  let created=0, skipped=0, linked=0;
  const errorList=[];

  for(let idx=0; idx<missing.length; idx++){
    const func = missing[idx];
    const username = genUsername(func);
    const nombre   = `${func.apellido||''} ${func.nombre||''}`.trim() || username;
    statusEl.textContent = `Procesando ${idx+1} de ${missing.length}: ${nombre}`;
    await new Promise(r=>setTimeout(r,30)); // yield UI

    if(!username){
      log('✗', nombre, 'sin username generado', 'var(--red)');
      errorList.push(`${nombre}: sin username`); continue;
    }
    if(existingEmails.has(username)){
      log('—', username, 'ya existe, omitido', 'var(--t3)');
      skipped++; continue;
    }

    log('⟳', username, 'creando...', 'var(--text)');

    let res, resBody;
    try {
      res = await fetch('/.netlify/functions/admin-create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password:'Clinica2026!', funcionario_id:func.id, rol:'nurse', authHeader:`Bearer ${token}` })
      });
      resBody = await res.json();
    } catch(e) {
      stepsEl.lastElementChild?.remove();
      log('✗', username, `Error de red: ${e.message}`, 'var(--red)');
      errorList.push(`${username}: ${e.message}`); continue;
    }

    stepsEl.lastElementChild?.remove();
    if(!res.ok){
      log('✗', username, resBody?.error || `Error ${res.status}`, 'var(--red)');
      errorList.push(`${username}: ${resBody?.error||res.status}`); continue;
    }
    if(resBody?.linked){
      log('↗', username, 'ya en Auth — vinculado a tabla', 'var(--amber)');
      existingEmails.add(username); linked++; continue;
    }
    log('✓', username, 'creado correctamente', 'var(--green)');
    existingEmails.add(username);
    created++;
  }

  // Recargar y renderizar
  statusEl.textContent = 'Actualizando lista de usuarios...';
  const {data:freshUsers} = await sb.from('usuarios').select('id, email, rol, activo, must_change_password, auth_user_id, funcionario_id, funcionario:funcionario_id(id,apellido,nombre,email,sector:sector_id(nombre),clinica:clinica_id(nombre))');
  if(freshUsers) DB.usuarios = freshUsers;
  renderUsers();

  // Ocultar spinner, mostrar resumen
  spinEl.style.display='none';
  statusEl.textContent = 'Proceso finalizado';
  const summaryEl = document.getElementById('bulkSummary');
  summaryEl.innerHTML = [
    created  ? `<span style="color:var(--green)">✓ ${created} usuario(s) creado(s)</span>` : '',
    linked   ? `<span style="color:var(--amber)">↗ ${linked} vinculado(s) (ya existían en Auth)</span>` : '',
    skipped  ? `<span style="color:var(--t3)">— ${skipped} omitido(s) (ya en tabla)</span>` : '',
    errorList.length ? `<span style="color:var(--red)">✗ ${errorList.length} con error</span>` : '',
  ].filter(Boolean).join('<br>');
  summaryEl.style.display='';
  document.getElementById('bulkCloseBtn').style.display='';
}

