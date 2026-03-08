// DASHBOARD
// ........................................................
function renderCov(){
  const g=document.getElementById('covGrid');if(!g)return;
  g.innerHTML=COV.map(c=>{
    const cl=c.pct>=90?'pbg':c.pct>=75?'pba':'pbr';
    const tc=c.pct>=90?'var(--green)':c.pct>=75?'var(--amber)':'var(--red)';
    return `<div class="cvc"><div class="cvn">${c.name}</div><div class="pw"><div class="pb ${cl}" style="width:${c.pct}%"></div></div><div class="cvm"><span>${c.n} enf.</span><span style="color:${tc}">${c.pct}%</span></div></div>`;
  }).join('');
}

function renderDashAlerts(){
  const c=document.getElementById('dashAlerts');if(!c)return;
  const items=[];
  const skip=new Set(['LAR','CERT','LE','F','DXF','CPL','E','LX1','LX2','LX3','LX4','LXE','NO CONVOCAR','MAT','PAT']);

  if(dbLoaded){
    // 7ª guardia (demo-regla mensual simple)
    DB.funcionarios.forEach(f=>{
      const g=DB.turnos.filter(t=>t.funcionario_id===f.id&&t.codigo&&!skip.has(t.codigo)).length;
      if(g>=7){
        items.push({
          cls:'cr2',
          ic:'🚨',
          t:`7ª Guardia — ${fNombre(f)} (${f.sector?.nombre||''})`,
          d:`${g} guardias este mes · genera horas extra obligatorias`,
          m:f.clinica?.nombre||'',
          btn:`<button class="btn bp xs" style="flex-shrink:0" onclick="go('alerts')">Ver</button>`,
        });
      }
    });

    // Vacantes sin cubrir
    DB.licencias.filter(l=>l.genera_vacante&&!l.suplente_id&&['activa','pendiente'].includes(l.estado)).forEach(l=>{
      const emp=l.funcionario?fNombre(l.funcionario):'—';
      const sec=l.funcionario?.sector?.nombre||'—';
      items.push({
        cls:'wa',
        ic:'⚠️',
        t:`Vacante sin cubrir — ${sec}`,
        d:`${emp} · ${l.tipo} · ${l.fecha_desde}`,
        m:'Sin suplente asignado',
        btn:`<button class="btn bp xs" style="flex-shrink:0" onclick="go('licenses')">Asignar</button>`,
      });
    });

    // Cambios pendientes
    const pCambios=DB.cambios.filter(x=>x.estado==='pendiente');
    if(pCambios.length){
      items.push({
        cls:'in',
        ic:'🔄',
        t:`${pCambios.length} cambio${pCambios.length>1?'s':''} pendiente${pCambios.length>1?'s':''}`,
        d:pCambios.slice(0,2).map(x=>`${x.solicitante?fNombre(x.solicitante):'—'} — ${x.receptor?fNombre(x.receptor):'—'}`).join(' · '),
        m:'Requieren aprobación',
        btn:`<button class="btn bp xs" style="flex-shrink:0" onclick="go('trades')">Ver</button>`,
      });
    }
  }

  if(!items.length){
    c.innerHTML=`
      <div class="ai in"><span style="font-size:17px;flex-shrink:0">ℹ️</span><div><div class="ai-t">Sin alertas críticas activas</div><div class="ai-d">No hay pendientes urgentes para supervisión.</div><div class="ai-m">${dbLoaded?'Actualizado desde BD':'Modo demo'}</div></div></div>
    `;
  }else{
    c.innerHTML=items.slice(0,3).map(a=>`
      <div class="ai ${a.cls}">
        <span style="font-size:17px;flex-shrink:0">${a.ic}</span>
        <div>
          <div class="ai-t">${a.t}</div>
          <div class="ai-d">${a.d}</div>
          <div class="ai-m">${a.m}</div>
        </div>
        ${a.btn||''}
      </div>
    `).join('');
  }

  // Update dashboard stat cards dynamically
  if(dbLoaded){
    const fijos = DB.funcionarios.filter(f=>f.activo!==false&&f.tipo!=='suplente').length;
    const sups  = DB.suplentes.filter(s=>s.activo!==false).length;
    const total = fijos + sups;
    const el=id=>document.getElementById(id);
    el('dashFuncNum')&&(el('dashFuncNum').textContent=String(total));
    el('dashFuncSub')&&(el('dashFuncSub').textContent=`${fijos} fijos · ${sups} suplentes`);

    const today=new Date().toISOString().slice(0,10);
    const onLic=new Set(DB.licencias.filter(l=>l.estado==='activa'&&l.fecha_desde<=today&&l.fecha_hasta>=today).map(l=>l.funcionario_id));
    const present=total-onLic.size;
    const pct=total?Math.round(present/total*100):100;
    const col=pct>=90?'var(--green)':pct>=75?'var(--amber)':'var(--red)';
    const pctEl=el('dashCovPct'); if(pctEl){pctEl.textContent=`${pct}%`;pctEl.style.color=col;}
    const slEl=el('dashCovSl'); if(slEl) slEl.style.background=col;
    el('dashCovSub')&&(el('dashCovSub').textContent=`${present}/${total} presentes`);

    const licHoy=DB.licencias.filter(l=>l.estado==='activa'&&l.fecha_desde<=today&&l.fecha_hasta>=today);
    el('dashLicNum')&&(el('dashLicNum').textContent=String(licHoy.length));
    const byTipo={};
    licHoy.forEach(l=>{byTipo[l.tipo]=(byTipo[l.tipo]||0)+1;});
    el('dashLicSub')&&(el('dashLicSub').textContent=Object.entries(byTipo).map(([k,v])=>`${v} ${k}`).join(' · ')||'Sin licencias activas hoy');

    el('dashAlertNum')&&(el('dashAlertNum').textContent=String(items.length));
  }
}

// ........................................................
// CALENDAR
// ........................................................
let SCHED_CTX = {year:2026, month:0}; // month: 0-11

function getAvailableMonthsGlobal(){
  const seen=new Set();
  const out=[];
  const push=(y,m)=>{
    const key=`${y}-${m}`;
    if(seen.has(key)) return;
    seen.add(key);
    out.push({year:y,month:m,label:getMonthLabel(y,m)});
  };
  (GENS||[]).filter(g=>g.estado==='aprobada').forEach(g=>{
    if(g.anio && Number.isInteger(g.mesNum)) push(g.anio,g.mesNum-1);
    else{
      const p=parseMesLabel(g.mes);
      if(p) push(p.year,p.month);
    }
  });
  (DB.turnos||[]).forEach(t=>{
    const d=new Date(`${t.fecha}T12:00:00`);
    if(!Number.isNaN(d.getTime())) push(d.getUTCFullYear(), d.getUTCMonth());
  });
  if(!out.length) push(2026,0);
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
function setSF(btn,s){cSF=s;document.querySelectorAll('#sfBtns .btn').forEach(b=>{b.className='btn bg sm';});btn.className='btn bp sm';renderCal();}
function isMobileSchedule(){ return window.matchMedia('(max-width: 700px)').matches; }

function getCambioSideName(c, side){
  if(side==='sol'){
    if(c.solicitante) return fNombre(c.solicitante);
    return getNameByFuncionarioId(c.solicitante_id)||'';
  }
  if(c.receptor) return fNombre(c.receptor);
  return getNameByFuncionarioId(c.receptor_id)||'';
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
let MY_AGENDA_CTX = {year:2026, month:0}; // month: 0-11
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

  if(!months.length) pushMonth(2026,0); // fallback demo
  months.sort((a,b)=> a.year===b.year ? a.month-b.month : a.year-b.year);
  return months;
}

// Build schedule map {day: code} for funcionario in selected year/month
function getUserSched(empId, year=2026, month=0){
  if(!empId || !DB.turnos.length){
    // demo fallback solo para Enero 2026
    return (year===2026 && month===0) ? {...MYSCHED} : {};
  }
  const sched = {};
  DB.turnos.filter(t=>t.funcionario_id===empId).forEach(t=>{
    const d=new Date(`${t.fecha}T12:00:00`);
    if(Number.isNaN(d.getTime())) return;
    if(d.getUTCFullYear()===year && d.getUTCMonth()===month){
      sched[d.getUTCDate()]=t.codigo;
    }
  });
  // fallback demo solo si es Enero 2026 y no hay datos
  if(!Object.keys(sched).length && year===2026 && month===0) return {...MYSCHED};
  return sched;
}

function getDemoSchedForName(name, year=2026, month=0){
  if(year!==2026 || month!==0) return {};
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
function buildMyCalGrid(sched, year=2026, month=0){
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
  const sub=SUBS.find(s=>s.name===cUser.name)||SUBS[0];
  const assigned=[3,6,9,12,14,17,20,22];
  v.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div><div style="font-family:var(--ff-display);font-weight:800;font-size:18px">Mis Asignaciones — Enero 2026</div>
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
            <div style="font-weight:700;font-size:13px">${d.toString().padStart(2,'0')}/01/2026 — <span class="sh sM" style="margin-left:4px">MO</span></div>
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
  const source = dbLoaded ? (DB.funcionariosAll?.length?DB.funcionariosAll:DB.funcionarios) : [];
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
    return `<tr>
      <td><strong>${nm}</strong></td>
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
        g:DB.turnos.filter(t=>t.funcionario_id===s.id&&isW(t.codigo)).length, status:s.activo===false?'inactive':'available', idx:i
      }))
    : SUBS.map((s,i)=>({...s,idx:i}));
  body.innerHTML=rows.map((s,i)=>{
    const pc=s.pct>=90?'cg':s.pct>=80?'ca':'cr';
    const actBtn = s.status==='inactive'
      ? `<button class="btn bs xs" onclick="restoreEmpByName(decodeURIComponent('${encodeURIComponent(s.name)}'))">↩</button>`
      : `<button class="btn bd xs" onclick="deleteEmpByName(decodeURIComponent('${encodeURIComponent(s.name)}'))">🗑</button>`;
    return `<tr>
      <td><strong>${s.name}</strong></td>
      <td class="mn">${s.sen} años</td>
      <td><span class="chip ${pc}">${s.pct}%</span></td>
      <td>${s.comp.map(c=>`<span class="chip cb2" style="margin:1px">${c}</span>`).join('')}</td>
      <td class="mn">${s.g}</td>
      <td class="mn" style="color:var(--blue)">${s.g*6}hs</td>
      <td><span class="chip ${s.status==='inactive'?'cn':(s.status==='available'?'cg':'ca')}">${s.status==='inactive'?'Inactivo':(s.status==='available'?'Disponible':'En turno')}</span></td>
      <td><span class="chip ${i===0?'cg':i===1?'ca':'cr'}">${i+1}° Prioridad</span></td>
      <td><div style="display:flex;gap:4px">
        <button class="btn bg xs" onclick="editEmpByName(decodeURIComponent('${encodeURIComponent(s.name)}'))">✏️</button>
        ${actBtn}
      </div></td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" style="color:var(--t3);padding:20px;text-align:center">Sin resultados para el filtro seleccionado</td></tr>';
}

// Competencias state
let COMP_STATE = null; // {subName: Set of sectors}
function getCompState(){
  if(!COMP_STATE){
    COMP_STATE={};
    SUBS.forEach(s=>{ COMP_STATE[s.name]=new Set(s.comp||[]); });
  }
  return COMP_STATE;
}

function renderCompMat(){
  const secs=['URGENCIA','OBSERVACIÓN','CPB','ECONOMATO','DOMICILIO','HORNEROS','POLI MAÑANA','AMNP'];
  const state=getCompState();
  let h='<div style="margin-bottom:10px;font-size:11px;color:var(--t2)">Hacé click en una celda para activar/desactivar una competencia. Los cambios se guardan automáticamente.</div>';
  h+='<div class="tw"><table><thead><tr><th>Suplente</th>';
  secs.forEach(s=>h+=`<th style="text-align:center;font-size:9px">${s}</th>`);
  h+='</tr></thead><tbody>';
  const subs = dbLoaded&&DB.suplentes.length?DB.suplentes.map(s=>({name:`${s.apellido}, ${s.nombre}`,id:s.id})):SUBS.map(s=>({name:s.name,id:null}));
  subs.forEach((s,si)=>{
    const comps = state[s.name]||new Set();
    h+=`<tr><td><strong>${s.name}</strong></td>`;
    secs.forEach(sec=>{
      const has=comps.has(sec);
      h+=`<td style="text-align:center;cursor:pointer;transition:background .1s" onclick="toggleComp('${s.name}','${sec}',this)" title="${has?'Quitar':'Agregar'} competencia ${sec}">
        <span id="comp_${si}_${sec.replace(/ /g,'_')}" style="font-size:16px;transition:all .15s">${has?'✅':'⬜'}</span>
      </td>`;
    });
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  const cont=document.getElementById('compMat');if(cont)cont.innerHTML=h;
}

async function toggleComp(subName, sector, cell){
  const state=getCompState();
  if(!state[subName]) state[subName]=new Set();
  const has=state[subName].has(sector);
  if(has) state[subName].delete(sector); else state[subName].add(sector);
  const span=cell.querySelector('span');
  if(span){ span.textContent=has?'⬜':'✅'; span.style.transform='scale(1.3)'; setTimeout(()=>span.style.transform='',200); }
  cell.style.background=has?'':'rgba(30,201,126,.08)';
  setTimeout(()=>cell.style.background='',600);
  toast('ok',has?'Competencia removida':'Competencia agregada',`${subName} · ${sector}`);
  // Save to Supabase if available (future: upsert competencias table)
}

function filterT(id,val){document.querySelectorAll(`#${id} tr`).forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(val.toLowerCase())?'':'none';});}

// ........................................................
// LICENSES
// ........................................................
let LIC_FIL = 'all';

function setLicFil(btn, val){
  LIC_FIL = val;
  document.querySelectorAll('.lic-fil').forEach(b=>b.classList.remove('act'));
  btn?.classList.add('act');
  renderLics();
}

function getSuplenteSugeridos(lic){
  if(!dbLoaded || !DB.suplentes.length) return [];
  const from=new Date((lic.fecha_desde||lic.from)+'T12:00:00');
  const to=new Date((lic.fecha_hasta||lic.to)+'T12:00:00');
  const empClinica=lic.funcionario?.clinica?.nombre||lic.clinica||'';
  const empSector=lic.funcionario?.sector?.nombre||lic.sec||lic.sector||'';
  return DB.suplentes
    .filter(s=>s.activo!==false)
    .filter(s=>{
      // Check no conflicting turno in date range
      return !DB.turnos.some(t=>{
        if(t.funcionario_id!==s.id) return false;
        const td=new Date(t.fecha+'T12:00:00');
        return td>=from && td<=to && isW(t.codigo);
      });
    })
    .map(s=>{
      const sc=s.clinica?.nombre||'';
      const ss=s.sector?.nombre||'';
      const sameSector=ss===empSector||sc===empClinica?2:0;
      const guardias=DB.turnos.filter(t=>t.funcionario_id===s.id&&isW(t.codigo)).length;
      return {...s, _score:sameSector - guardias*0.01};
    })
    .sort((a,b)=>b._score-a._score)
    .slice(0,3);
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

function renderLics(){
  const body=document.getElementById('licBody');if(!body)return;
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
      const canApprove= canAct && l.st==='pendiente';
      const sugs = (canAssign && l._dbLic) ? getSuplenteSugeridos(l._dbLic) : [];
      const sugHtml = sugs.length
        ? '<div style="margin-top:4px;font-size:10px;color:var(--t2)">Sugeridos: '+
          sugs.map(s=>{const nm=fNombre(s);return `<button class="btn bs xs" style="font-size:10px" onclick="asignarSuplenteLic(${l._dbLic.id},'${s.id}','${nm.replace(/'/g,"\\'")}')">👤 ${nm}</button>`;}).join('')+
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
          ${canAssign?`<button class="btn bp xs" onclick="openAssignFromLic(${l.globalIdx},'${(l.sec||'').replace(/'/g,'&#39;')}','${l.from}')">Asignar suplente</button>`:''}
          ${sugHtml}
        </td>
      </tr>`;
    });
  });
  body.innerHTML=html;
}

function renderCobertura(){
  const body=document.getElementById('coberturaBody'); if(!body) return;
  if(!dbLoaded){ body.innerHTML='<p style="color:var(--t3);padding:20px">Cargando datos...</p>'; return; }
  const today=new Date().toISOString().slice(0,10);
  const fmtDate=d=>{try{return new Date(d+'T12:00:00').toLocaleDateString('es-UY',{day:'2-digit',month:'2-digit',year:'2-digit'});}catch(e){return d||'—';}};
  const isSup=['admin','supervisor'].includes(cRole);

  // Uncovered + not ended
  const pending=DB.licencias.filter(l=>
    l.genera_vacante && !l.suplente_id &&
    ['activa','pendiente'].includes(l.estado) &&
    l.fecha_hasta >= today
  );

  if(!pending.length){
    body.innerHTML=`
      <div style="text-align:center;padding:40px;color:var(--t3)">
        <div style="font-size:32px;margin-bottom:12px">✅</div>
        <div style="font-size:15px;font-weight:600;color:var(--green)">Sin coberturas pendientes</div>
        <div style="font-size:12px;margin-top:6px">Todas las vacantes están cubiertas o no hay licencias con vacante activa.</div>
      </div>`;
    return;
  }

  let html=`<div style="display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));padding:4px">`;
  pending.forEach(l=>{
    const emp=l.funcionario?fNombre(l.funcionario):'—';
    const sec=l.funcionario?.sector?.nombre||'—';
    const daysLeft=Math.max(0,Math.round((new Date(l.fecha_hasta+'T12:00:00')-new Date(today+'T12:00:00'))/86400000));
    const urgency=daysLeft<=3?'cr':daysLeft<=7?'ca':'cg';
    const sugs=isSup?getSuplenteSugeridos(l):[];
    const sugHtml=sugs.length
      ? sugs.map(s=>{
          const nm=fNombre(s);
          const sc=s.sector?.nombre||s.clinica?.nombre||'';
          const g=DB.turnos.filter(t=>t.funcionario_id===s.id&&isW(t.codigo)).length;
          return `<button class="btn bg sm" style="width:100%;text-align:left;padding:8px 10px;justify-content:space-between"
            onclick="asignarSuplenteLic(${l.id},'${s.id}','${nm.replace(/'/g,"\\'")}')">
            <span>👤 <strong>${nm}</strong><span style="font-size:10px;color:var(--t2);margin-left:6px">${sc}</span></span>
            <span style="font-size:10px;color:var(--t3)">${g} guard.</span>
          </button>`;
        }).join('')
      : (isSup
          ? '<p style="font-size:11px;color:var(--t3);margin:6px 0">Sin suplentes disponibles en ese período.</p>'
          : '<p style="font-size:11px;color:var(--t3);margin:6px 0">Requiere acción de supervisor.</p>');

    html+=`<div class="card" style="border-left:3px solid var(--${urgency==='cr'?'red':urgency==='ca'?'amber':'green'})">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-weight:700;font-size:13px">${emp}</div>
          <div style="font-size:11px;color:var(--t2)">${sec} · <span class="chip ${urgency==='cr'?'cn':'cn'}">${l.tipo}</span></div>
        </div>
        <span class="chip ${urgency}" style="flex-shrink:0">${daysLeft===0?'Hoy':daysLeft===1?'1 día':daysLeft+' días'}</span>
      </div>
      <div style="font-size:11px;color:var(--t2);margin-bottom:10px">
        📅 ${fmtDate(l.fecha_desde)} → ${fmtDate(l.fecha_hasta)}
        ${l.observaciones?`<div style="margin-top:2px;font-size:10px;color:var(--t3)">${l.observaciones}</div>`:''}
      </div>
      <div style="font-size:11px;color:var(--t2);font-weight:600;margin-bottom:6px">${sugs.length?'Suplentes sugeridos:':'Cobertura:'}</div>
      <div style="display:flex;flex-direction:column;gap:4px">${sugHtml}</div>
    </div>`;
  });
  html+='</div>';

  const count=pending.length;
  body.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span style="font-size:13px;font-weight:600">${count} vacante${count>1?'s':''} sin cubrir</span>
      <span style="font-size:11px;color:var(--t3)">Hacé click en un suplente para asignarlo</span>
    </div>
    ${html}`;
}

function renderLAR(){
  const body=document.getElementById('larBody');if(!body)return;
  if(dbLoaded && DB.funcionarios.length){
    const years=getAvailableMonthsGlobal().map(m=>m.year);
    const year=years.length?Math.max(...years):2026;
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
  const lar=[
    {n:'K. ACOSTA',sec:'POLI MAÑANA',total:20,m:[11,9,0,0,0,0,0,0,0,0,0,0]},
    {n:'C. MAGALLANES',sec:'POLI MAÑANA',total:20,m:[12,0,8,0,0,0,0,0,0,0,0,0]},
    {n:'F. CANTERO',sec:'ECONOMATO',total:25,m:[25,0,0,0,0,0,0,0,0,0,0,0]},
    {n:'N. OJEDA',sec:'CPB',total:20,m:[0,0,0,20,0,0,0,0,0,0,0,0]},
    {n:'M. PEREIRA',sec:'OBSERVACIÓN',total:20,m:[0,0,0,0,10,10,0,0,0,0,0,0]},
  ];
  body.innerHTML=lar.map(l=>{
    const used=l.m.reduce((a,b)=>a+b,0);const saldo=l.total-used;
    return `<tr><td><strong>${l.n}</strong></td><td style="font-size:11px">${l.sec}</td><td class="mn">${l.total}</td>
    ${l.m.map(v=>`<td class="mn" style="color:${v>0?'var(--green)':'var(--t3)'}">${v||'—'}</td>`).join('')}
    <td class="mn" style="color:${saldo>0?'var(--green)':'var(--red)'};font-weight:700">${saldo}</td></tr>`;
  }).join('');
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
    warn.innerHTML=`⚠ Solapamiento detectado con licencia <strong>${conflict.tipo}</strong> (${conflict.fecha_desde} a ${conflict.fecha_hasta}).`;
    return;
  }
  warn.style.display='block';
  warn.style.background='var(--bdim)';
  warn.style.border='1px solid rgba(61,127,255,.25)';
  warn.style.color='var(--blue)';
  warn.innerHTML=`ℹ️ No se detecta solapamiento para <strong>${tipo}</strong> en el período seleccionado.`;
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

  const dbRows=(DB.cambios||[]).map(c=>{
    const sol=c.solicitante?fNombre(c.solicitante):(getNameByFuncionarioId(c.solicitante_id)||'—');
    const rec=c.receptor?fNombre(c.receptor):(getNameByFuncionarioId(c.receptor_id)||'—');
    return {
      id:c.id||null,
      source:'db',
      estado:c.estado||'pendiente',
      date:c.created_at?new Date(c.created_at).toLocaleDateString('es-UY'):'—',
      sol, rec,
      tc:`${c.turno_cede||'?'} · ${c.fecha_cede||'?'}`,
      tr:`${c.turno_recibe||'?'} · ${c.fecha_recibe||'?'}`,
    };
  });
  const localRows=(!dbLoaded?(MY_CAMBIOS||[]):[]).map((t,idx)=>({
    id:null,
    source:'local',
    localIdx:idx,
    estado:t.estado||'pendiente',
    date:'Hoy',
    sol:myName,
    rec:t.con||'—',
    tc:t.miTurno||'—',
    tr:t.recibo||'—',
  }));
  const merged=[...dbRows,...localRows].filter(r=>{
    const k=r.sol===myName || r.rec===myName;
    return isSuperAdmin ? true : k;
  });

  const pending=merged.filter(r=>r.estado==='pendiente');
  if(isSuperAdmin){
    desc.textContent='Gestioná los cambios de turno del equipo. Los aprobados/rechazados se eliminan de pendientes.';
    pTit.textContent='Pendientes de tu aprobación';
    const pendDb=DB.cambios.filter(c=>c.estado==='pendiente');
    pend.innerHTML=pending.map((t,i)=>{
      const actionBtns=t.source==='db'
        ? `<button class="btn bs sm" onclick="appTrd(${pendDb.findIndex(x=>String(x.id)===String(t.id))})">✓ Aprobar</button>
           <button class="btn bd sm" onclick="rejTrd(${pendDb.findIndex(x=>String(x.id)===String(t.id))})">✕ Rechazar</button>`
        : `<span class="chip cn">Demo local</span>`;
      return `<div id="trd${i}" style="background:var(--card);border:1px solid var(--amber);border-radius:var(--r2);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${t.sol} <span style="color:var(--t3)">—</span> ${t.rec}</div>
          <div style="font-size:11px;color:var(--t2)">${t.tc} → ${t.tr}</div>
          <div style="margin-top:5px"><span class="chip ca">Pendiente</span> <span style="font-size:10px;color:var(--t3);font-family:var(--ff-mono);margin-left:6px">${t.date}</span></div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">${actionBtns}</div>
      </div>`;
    }).join('') || '<div style="color:var(--t3);font-size:12px;padding:10px">Sin cambios pendientes</div>';
  } else {
    desc.textContent='Tus cambios de turno solicitados y recibidos.';
    pTit.textContent='Solicitudes pendientes';
    pend.innerHTML=pending.map(t=>`
      <div style="background:var(--card);border:1px solid var(--cyan);border-radius:var(--r2);padding:14px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px">
        <div>
          <div style="font-weight:700;font-size:13px;margin-bottom:3px">${t.sol===myName?'Solicitaste a':'Te solicita'} ${t.sol===myName?t.rec:t.sol}</div>
          <div style="font-size:11px;color:var(--t2);margin-top:4px">${t.tc} → ${t.tr}</div>
          <div style="margin-top:5px"><span class="chip ca">Pendiente</span></div>
        </div>
      </div>
    `).join('')||'<div style="color:var(--t3);font-size:12px;padding:10px">No tenés cambios pendientes</div>';
  }

  const stChip={aprobado:'cg',rechazado:'cr',aceptado:'cb2',pendiente:'ca'};
  const stLabel={aprobado:'Aprobado',rechazado:'Rechazado',aceptado:'Aceptado',pendiente:'Pendiente'};
  const histRows=merged.filter(r=>r.estado!=='pendiente');
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

function acceptMyCambio(i){
  const el=document.getElementById('trd'+i);
  if(el){el.style.borderColor='var(--green)';el.querySelector('div:last-child').innerHTML='<span class="chip cg">✓ Aceptado — pasa a supervisora</span>';}
  toast('in','Cambio aceptado','Pasa ahora a aprobación de supervisora.');
}
function rejectMyCambio(i){
  const el=document.getElementById('trd'+i);
  if(el){el.style.borderColor='var(--red)';el.querySelector('div:last-child').innerHTML='<span class="chip cr">✕ Rechazado</span>';}
  toast('wa','Cambio rechazado','Se notificó al solicitante.');
}

async function appTrd(i){
  const pending = DB.cambios.filter(c=>c.estado==='pendiente');
  const item = pending[i];
  if(!item) return;
  if(sb){
    await updateCambio(item.id, 'aprobado');
  } else {
    item.estado='aprobado';
  }
  refreshTradeBadge();
  renderTrades();
  renderAlerts();
  renderDashAlerts();
  renderCal();
  toast('ok','Cambio aprobado','Movido al historial. Ambos funcionarios notificados.');
}
async function rejTrd(i){
  const pending=DB.cambios.filter(c=>c.estado==='pendiente');
  const item = pending[i];
  if(!item) return;
  if(sb){
    await updateCambio(item.id,'rechazado');
  } else {
    item.estado='rechazado';
  }
  refreshTradeBadge();
  renderTrades();
  renderAlerts();
  renderDashAlerts();
  renderCal();
  toast('wa','Cambio rechazado','Movido al historial. Funcionarios notificados.');
}
function refreshTradeBadge(){
  const cnt=DB.cambios.filter(c=>c.estado==='pendiente').length;
  document.getElementById('tradeBadge').textContent=cnt||'';
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
      // 7ª guardia
      DB.funcionarios.forEach(f=>{
        const g=DB.turnos.filter(t=>t.funcionario_id===f.id&&t.codigo&&!skip.has(t.codigo)).length;
        if(g>=7) items.push({t:'cr2',ic:'🚨',
          title:`7ª Guardia — ${fNombre(f)} (${f.sector?.nombre||''})`,
          desc:`${g} guardias este mes · genera horas extra obligatorias`,
          meta:f.clinica?.nombre||'',
          btn:`<button class="btn bp xs" onclick="toast('ok','Registrado','Confirmado en RRHH')">Confirmar</button>`
        });
      });
      // Vacantes sin suplente
      DB.licencias.filter(l=>l.genera_vacante&&!l.suplente_id&&['activa','pendiente'].includes(l.estado)).forEach(l=>{
        const emp=l.funcionario?fNombre(l.funcionario):'—';
        const sec=l.funcionario?.sector?.nombre||'—';
        items.push({t:'wa',ic:'⚠️',
          title:`Vacante sin cubrir — ${sec}`,
          desc:`${emp} · ${l.tipo} · ${l.fecha_desde}`,
          meta:'Sin suplente asignado',
          btn:`<button class="btn bp xs" onclick="go('licenses')">Asignar</button>`
        });
      });
      // Cambios pendientes de aprobación
      const pCambios=DB.cambios.filter(x=>x.estado==='pendiente');
      if(pCambios.length) items.push({t:'wa',ic:'🔄',
        title:`${pCambios.length} cambio${pCambios.length>1?'s':''} pendiente${pCambios.length>1?'s':''} de aprobación`,
        desc:pCambios.slice(0,3).map(x=>`${x.solicitante?fNombre(x.solicitante):'—'} — ${x.receptor?fNombre(x.receptor):'—'}`).join(' · '),
        meta:'Requieren tu aprobación',
        btn:`<button class="btn bp xs" onclick="go('trades')">Ver cambios</button>`
      });
      // Licencias pendientes
      const pLics=DB.licencias.filter(l=>l.estado==='pendiente');
      if(pLics.length) items.push({t:'in',ic:'📋',
        title:`${pLics.length} licencia${pLics.length>1?'s':''} pendiente${pLics.length>1?'s':''} de aprobación`,
        desc:pLics.map(l=>l.funcionario?fNombre(l.funcionario):'—').slice(0,3).join(', '),
        meta:'',
        btn:`<button class="btn bp xs" onclick="go('licenses')">Ver</button>`
      });
    } else {
      // Enfermería: solo sus propios cambios pendientes
      const myNm=cUser?.name||'';
      const myCambios=DB.cambios.filter(x=>x.estado==='pendiente'&&(
        (x.solicitante&&fNombre(x.solicitante)===myNm)||
        (x.receptor&&fNombre(x.receptor)===myNm)
      ));
      myCambios.forEach(x=>{
        const esReceptor=x.receptor&&fNombre(x.receptor)===myNm;
        items.push({t:'in',ic:'🔄',
          title:esReceptor?'Te proponen un cambio de turno':'Tu cambio pendiente de aprobación',
          desc:`Con ${esReceptor?fNombre(x.solicitante):fNombre(x.receptor)} · ${x.turno_cede||'?'} — ${x.turno_recibe||'?'}`,
          meta:'Esperando respuesta',btn:''
        });
      });
    }
    // DB alerts (from alertas table)
    DB.alertas.filter(a=>!a.leida).forEach(a=>{
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
let MY_LICS = [
  {tipo:'LE', dias:'03/01 (1 día)', estado:'aprobada', chip:'cg'},
];

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
      <div class="fr"><div class="fg"><label>Desde</label><input id="myLicDesde" type="date" value="2026-01-25" style="width:100%;background:var(--bg3);border:1px solid var(--b);color:var(--text);padding:9px;border-radius:var(--r);font-size:12.5px"></div>
      <div class="fg"><label>Hasta</label><input id="myLicHasta" type="date" value="2026-01-25" style="width:100%;background:var(--bg3);border:1px solid var(--b);color:var(--text);padding:9px;border-radius:var(--r);font-size:12.5px"></div></div>
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
function openAssignModal(sector, fecha, vacId){
  const subs = dbLoaded && DB.suplentes.length ? DB.suplentes : SUBS;
  const opts = subs.map((s,i)=>{
    const nm = s.apellido ? `${s.apellido}, ${s.nombre}` : s.name;
    const pct = s.pct || s.compliance || 80;
    const sen = s.sen || s.seniority || 1;
    return `<option value="${i}">${nm} (${i+1}° · ${sen} años · ${pct}%)</option>`;
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
      <button class="btn bp" onclick="confirmAssign('${sector}','${fecha}',${vacId})">✓ Confirmar Asignación</button>
    </div>
  </div>`;
  document.body.appendChild(ov);
}

async function confirmAssign(sector, fecha, vacId){
  const selIdx = parseInt(document.getElementById('asgSub')?.value||0);
  const code   = document.getElementById('asgCode')?.value||'M';
  const nota   = document.getElementById('asgNota')?.value||'';
  const subs   = dbLoaded && DB.suplentes.length ? DB.suplentes : SUBS;
  const sub    = subs[selIdx];
  const subNm  = sub?.apellido ? `${sub.apellido}, ${sub.nombre}` : sub?.name||'—';
  // Save to Supabase if available
  if(sb && sub?.id){
    const dateStr = fecha.includes('-') ? fecha : `2026-01-${fecha.split('/')[0].padStart(2,'0')}`;
    await saveTurno(sub.id, dateStr, code, null, nota||`Cubre vacante ${sector}`);
  }
  // Close modal
  document.getElementById('assignOv')?.remove();
  // Update license state in memory AND Supabase
  const li = window._licIdx;
  if(li != null){
    if(LIC_DATA[li]){
      LIC_DATA[li].st='covered';
      LIC_DATA[li].sub=subNm;
      // Persist to Supabase: update licencia with suplente_id
      if(sb && LIC_DATA[li].id && sub?.id){
        sb.from('licencias').update({suplente_id: sub.id, estado:'activa'}).eq('id', LIC_DATA[li].id)
          .then(({error})=>{ if(error) console.error('Error updating licencia:', error); });
      }
      // Also update DB.licencias in memory
      const dbLic = DB.licencias.find(l=>l.id===LIC_DATA[li].id);
      if(dbLic){ dbLic.suplente_id=sub?.id; }
    }
    window._licIdx = null;
  }
  // Remove assigned alert from list
  if(window._alertRemoveIdx != null){
    dismissAlert(window._alertRemoveIdx);
    window._alertRemoveIdx = null;
  }
  // Refresh alerts and licenses
  renderAlerts();
  renderLics();
  toast('ok',`${subNm} asignado/a`,`Cubrirá ${sector} el ${fecha} · Código: ${code}`);
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

function openAssignFromLic(idx, sector, fecha){
  window._licIdx = idx;
  window._alertRemoveIdx = null;
  openAssignModal(sector, fecha, idx);
}

function openAssignFromAlert(alertIdx, sector, fecha){
  window._licIdx = null;
  window._alertRemoveIdx = alertIdx;
  openAssignModal(sector, fecha, alertIdx);
}

function approveCambioFromAlert(alertIdx){
  dismissAlert(alertIdx);
  const pending = DB.cambios.filter(c=>c.estado==='pendiente');
  if(pending.length) appTrd(0);
  else toast('ok','Cambio aprobado','');
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
function saveGENS(){ try{ localStorage.setItem('guardiapp_gens', JSON.stringify(GENS)); }catch(e){} }
function loadGENS(){
  try{
    const s = localStorage.getItem('guardiapp_gens');
    if(s){ const arr=JSON.parse(s); if(Array.isArray(arr)){ GENS.splice(0,GENS.length,...arr); return; } }
  }catch(e){}
  // default seed so UI is never empty on first load
  GENS.splice(0, GENS.length, {id:1, mes:'Enero 2026', mesNum:1, anio:2026, func:47, alertas:2, estado:'aprobada', fecha:'01/01/2026'});
}
loadGENS();

// Current gen being built (not yet approved)
let DRAFT_GEN = null;
// License state (persists across re-renders)
let LIC_DATA = [
  {id:1, emp:'K. ACOSTA',    sec:'POLI MAÑANA', type:'LAR',  from:'2026-01-02',to:'2026-01-12',days:11,vac:false,sub:'—',   st:'active'},
  {id:2, emp:'C. MAGALLANES',sec:'POLI MAÑANA', type:'LAR',  from:'2026-01-20',to:'2026-01-31',days:12,vac:false,sub:'—',   st:'active'},
  {id:3, emp:'N. OJEDA',     sec:'CPB',          type:'CERT', from:'2026-01-02',to:'2026-01-08',days:7, vac:true, sub:'C. PEREZ', st:'covered'},
  {id:4, emp:'L. FAGUNDEZ',  sec:'ECONOMATO',    type:'F',    from:'2026-01-18',to:'2026-01-18',days:1, vac:true, sub:'Sin asignar',st:'uncovered'},
  {id:5, emp:'F. CANTERO',   sec:'ECONOMATO',    type:'LAR',  from:'2026-01-02',to:'2026-01-31',days:31,vac:false,sub:'—',   st:'active'},
];
let _licIdCounter = 100;
// Users state
let USERS_DATA = [
  {id:1, name:'Admin Sistema',  email:'admin@guardiapp.com',  role:'admin',      sector:'—',             last:'Hoy 09:00', active:true},
  {id:2, name:'Laura Díaz',     email:'ldiaz@clinica.com',    role:'supervisor',  sector:'Todas',         last:'Hoy 08:30', active:true},
  {id:3, name:'M. Hernández',   email:'mhernandez@clinica.com',role:'supervisor', sector:'Setiembre',     last:'Ayer 17:20',active:true},
  {id:4, name:'N. Lombardo',    email:'nlombardo@clinica.com', role:'nurse',      sector:'POLI MAÑANA',   last:'Hoy 06:15', active:true},
  {id:5, name:'M. Pereira',     email:'mpereira@clinica.com',  role:'nurse',      sector:'OBSERVACIÓN',   last:'Ayer 12:00',active:true},
  {id:6, name:'C. Pérez',       email:'cperez@clinica.com',    role:'nurse',      sector:'Suplentes',     last:'18/01 21:00',active:true},
];
// My cambios state (for nurse view)
// Pending shift changes (for schedule grid refresh)
let SHIFT_CHANGES = {}; // {empName_date: code}
function setShiftChange(emp, date, code){ SHIFT_CHANGES[`${emp}_${date}`]=code; }
function getShiftChange(emp, date){ return SHIFT_CHANGES[`${emp}_${date}`]||null; }

let MY_CAMBIOS = [];
// Alerts dismissed this session (survive re-renders)
const DISMISSED_ALERTS = new Set();

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
  'Cargando regímenes y configuración de sectores',
  'Aplicando licencias LAR planificadas para el mes',
  'Asignando turnos según régimen por sector',
  'Verificando 7ª guardia — calculando horas extra',
  'Detectando vacantes (faltas, LAR sin cobertura)',
  'Asignando suplentes por prioridad (antigüedad · cumplimiento · competencia)',
  'Verificando conflictos y reglas de negocio',
  'Generando alertas críticas para supervisoras',
  'Enviando agendas por email (47 funcionarios)',
  'Generando reporte RRHH y actualizando sistema',
];

function getGeneratedMonthKey(g){
  if(g?.anio && Number.isInteger(g?.mesNum)) return `${g.anio}-${String(g.mesNum).padStart(2,'0')}`;
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
  const src=getAvailableMonthsGlobal();
  const lastGen=(GENS||[]).map(getGeneratedMonthKey).filter(Boolean).sort().slice(-1)[0];
  const base=lastGen ? ymLabelFromKey(lastGen) : (src[src.length-1]||{year:2026,month:0});
  let y=base.year, m=base.month;
  for(let i=0;i<6;i++){
    m+=1;
    if(m>11){ m=0; y+=1; }
    const key=`${y}-${String(m+1).padStart(2,'0')}`;
    if(!generated.has(key)) months.push({key,label:getMonthLabel(y,m)});
  }
  if(!months.length){
    const now=new Date();
    const key=`${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}`;
    months.push({key,label:getMonthLabel(now.getUTCFullYear(),now.getUTCMonth())});
  }
  sel.innerHTML=months.map(mo=>`<option value="${mo.label}">${mo.label}</option>`).join('');
  if(prev && [...sel.options].some(o=>o.value===prev)) sel.value=prev;
}

async function startGen(){
  if(!dbLoaded || !DB.funcionarios.length){
    toast('wa','Sin datos','Sincronizá la base de datos primero.'); return;
  }
  const mesVal=document.getElementById('genMes')?.value||'Marzo 2026';
  const parsed=parseMesLabel(mesVal)||{year:2026,month:2};
  if(GENS.find(g=>g.mes===mesVal&&g.estado!=='cancelada')){
    toast('wa','Ya existe','Este mes ya fue generado. Buscalo en el historial para validar.'); return;
  }

  document.getElementById('genIdle').style.display='none';
  document.getElementById('genRun').classList.remove('gone');
  const steps_gen=GSTEPS.slice(0,8);
  const sd=document.getElementById('genSteps');
  sd.innerHTML=steps_gen.map((_,i)=>`<div class="genstep" id="gs${i}"><span class="gsic">○</span>${_}</div>`).join('');

  const markStep=i=>{
    if(i>0){const p=document.getElementById(`gs${i-1}`);if(p){p.className='genstep done';p.querySelector('.gsic').textContent='✓';}}
    const el=document.getElementById(`gs${i}`);
    if(el){el.className='genstep run';el.querySelector('.gsic').textContent='⟳';}
    document.getElementById('genStatus').textContent=(steps_gen[i]||'Procesando')+'...';
  };

  const {year,month}=parsed;
  const daysInMonth=new Date(Date.UTC(year,month+1,0)).getUTCDate();

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
    if(patron==='LS') return wd<6;  // Lun-Sáb (Mon=0…Sat=5, excl Dom=6)
    if(patron==='SD') return wd>=5; // Solo Sáb (5) y Dom (6)
    if(patron==='36H') return true; // Flexible — siempre disponible, supervisor asigna
    return wd<5; // LV: Lun-Vie (default)
  }

  markStep(0);
  const records=[];
  let alert7=0;
  const chunkSize=Math.ceil(DB.funcionarios.length/6)||1;

  let cmpCount=0;
  for(let fi=0;fi<DB.funcionarios.length;fi++){
    if(fi>0 && fi%chunkSize===0) markStep(Math.min(Math.floor(fi/chunkSize),5));
    const f=DB.funcionarios[fi];
    const patron=f.patron||'LV';
    const cicloRef=f.ciclo_ref||null;
    const code=f.turno_fijo||'M';
    const sectorId=f.sector_id||null;
    // Birthday detection for this month
    const bdayDate=f.fecha_nacimiento?new Date(f.fecha_nacimiento+'T12:00:00'):null;
    const bdayDay=bdayDate&&bdayDate.getUTCMonth()===month?bdayDate.getUTCDate():null;
    let consec=0; let bad7=false;
    for(let d=1;d<=daysInMonth;d++){
      const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const lic=getLicenciaCodeForDate(f.id,dateStr);
      if(lic){consec=0;continue;}
      if(isWorkDay(patron,cicloRef,dateStr)){
        // Cumpleaños: medio día CMP — no se puede mover
        const isBday=(bdayDay!==null && d===bdayDay);
        const turnoCode=isBday?'CMP':code;
        if(isBday) cmpCount++;
        records.push({funcionario_id:f.id,fecha:dateStr,codigo:turnoCode,sector_id:sectorId});
        consec++; if(consec>=7) bad7=true;
      } else {
        consec=0;
      }
    }
    if(bad7) alert7++;
  }

  // Batch upsert in chunks of 500
  markStep(6);
  const BATCH=500;
  for(let i=0;i<records.length;i+=BATCH){
    const ok=await saveTurnosBatch(records.slice(i,i+BATCH));
    if(!ok) break;
  }

  markStep(7);
  await new Promise(r=>setTimeout(r,300));
  for(let i=0;i<8;i++){const p=document.getElementById(`gs${i}`);if(p){p.className='genstep done';p.querySelector('.gsic').textContent='✓';}}
  document.getElementById('genRun').classList.add('gone');
  document.getElementById('genIdle').style.display='block';

  DRAFT_GEN={id:Date.now(),mes:mesVal,mesNum:month+1,anio:year,
    func:DB.funcionarios.length,alertas:alert7,estado:'borrador',
    fecha:new Date().toLocaleDateString('es-UY')};
  GENS.unshift(DRAFT_GEN);
  saveGENS();
  renderGenHistory();
  populateSendMes();
  populateGenMesOptions();
  await loadDB();
  toast('ok',`${mesVal} generado — ${records.length} turnos · ${alert7} alertas 7ª guardia${cmpCount?` · 🎂 ${cmpCount} cumpleaños`:''}`,
    'Revisá la planilla, editá si necesario, luego aprobá para enviar agendas.');
}

function renderGenHistory(){
  const tbody = document.getElementById('genHistBody');
  if(!tbody) return;
  populateGenMesOptions();
  tbody.innerHTML = GENS.map((g,i)=>{
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
      <td><strong>${g.mes}</strong></td>
      <td>Todas</td>
      <td>${g.func}</td>
      <td><span class="chip ${g.alertas>0?'ca':'cn'}">${g.alertas>0?g.alertas+' alertas':'Sin alertas'}</span></td>
      <td>${stChip}</td>
      <td style="display:flex;gap:5px">${actions}</td>
    </tr>`;
  }).join('');
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
      ${g.mes} ${g.estado==='aprobada'?'✓':g.estado==='borrador'?'(pendiente validación)':'(cancelada)'}
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
  const ym=MY_AGENDA_CTX||{year:2026,month:0};
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
  const year=ctx?.year ?? 2026;
  const month=ctx?.month ?? 0;
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
      <div style="font-size:11px;color:#a0b4d0">Clínica ${clinic} · Enero 2026</div>
    </div>
    <div style="padding:24px 26px">
      <p style="font-size:13px;color:#555;margin:0 0 6px">Hola <strong>${empName}</strong>,</p>
      <h2 style="font-size:20px;color:#1a1a2e;margin:0 0 4px;font-family:Arial Black,sans-serif">Tu agenda para Enero 2026</h2>
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
      subject:  `GuardiaApp — Tu Agenda Enero 2026 · ${empData.sector}`,
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
      subject: `GuardiaApp — Agenda Enero 2026 · ${e.sector} (DEMO)`,
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
let HR_CTX={year:2026,month:0,clinic:'all'};
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
          date:`2026-01-${String(d).padStart(2,'0')}`,
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
function renderUsers(){
  const body=document.getElementById('usersBody');if(!body)return;
  // Use DB users if loaded, else local state
  const users = dbLoaded&&DB.usuarios.length
    ? DB.usuarios.map((u,i)=>({
        id:u.id||i, name:u.funcionario?`${u.funcionario.apellido}, ${u.funcionario.nombre}`:u.email,
        email:u.email, role:u.rol, sector:'—', last:u.ultimo_acceso?new Date(u.ultimo_acceso).toLocaleDateString('es-UY'):'Nunca', active:u.activo
      }))
    : USERS_DATA;
  const rChip={admin:'cb2',supervisor:'cg',nurse:'cp'};
  const rLabel={admin:'Admin/Gerencia',supervisor:'Supervisor',nurse:'Enfermería'};
  body.innerHTML=users.map((u,i)=>`<tr>
    <td><strong>${u.name}</strong></td>
    <td class="mn" style="font-size:10px">${u.email}</td>
    <td><span class="chip ${rChip[u.role]||'cn'}">${rLabel[u.role]||u.role}</span></td>
    <td style="font-size:11px;color:var(--t2)">${u.sector}</td>
    <td class="mn" style="font-size:10px;color:var(--t3)">${u.last}</td>
    <td><span class="dot ${u.active?'dg':'dn2'}"></span>${u.active?'Activo':'Inactivo'}</td>
    <td><div style="display:flex;gap:4px">
      <button class="btn bg xs" onclick="editUser(${i})">✏️</button>
      ${u.active
        ? `<button class="btn bd xs" onclick="toggleUser(${i})">Deshabilitar</button>`
        : `<button class="btn bs xs" onclick="toggleUser(${i})">Habilitar</button>`}
    </div></td>
  </tr>`).join('');
}

function editUser(i){
  const users = dbLoaded&&DB.usuarios.length
    ? DB.usuarios.map((u,idx)=>({id:u.id||idx, name:u.funcionario?`${u.funcionario.apellido}, ${u.funcionario.nombre}`:u.email, email:u.email, role:u.rol, active:u.activo, telefono:u.funcionario?.telefono, fnac:u.funcionario?.fecha_nacimiento}))
    : USERS_DATA;
  const u=users[i]; if(!u) return;
  // Reset modal
  window._editUserId = u.id;
  document.querySelector('#userM .mh-t').textContent = '✏️ Editar Usuario — '+u.name;
  // Populate all fields
  const set = (id, val) => { const el=document.getElementById(id); if(el&&val!=null) el.value=val; };
  set('newRole',  u.role||'nurse');
  set('uEmail',   u.email||'');
  set('uTel',     u.telefono||'');
  set('uFnac',    u.fnac||'');
  // Select funcionario
  const uEmp=document.getElementById('uEmp');
  if(uEmp){ const opt=[...uEmp.options].find(o=>o.text.includes(u.name.split(',')[0])||(u.name&&o.text===u.name)); if(opt) opt.selected=true; }
  updPD();
  openM('userM');
}

async function toggleUser(i){
  const users = USERS_DATA;
  if(!users[i]) return;
  users[i].active=!users[i].active;
  if(sb&&users[i].id){
    await sb.from('usuarios').update({activo:users[i].active}).eq('id',users[i].id);
  }
  renderUsers();
  toast(users[i].active?'ok':'wa', users[i].active?'Usuario habilitado':'Usuario deshabilitado', users[i].name);
}

const PDESC={
  admin:'Acceso total al sistema: planilla, empleados, licencias, cambios, generación automática, reportes RRHH, usuarios y configuración.',
  supervisor:'Planilla, empleados (su sector), licencias, cambios (aprobar/rechazar), generación automática, reportes RRHH. Sin acceso a usuarios ni config global.',
  nurse:'Solo su agenda personal, solicitar licencias propias, solicitar cambios. Sin acceso a planilla general, otros funcionarios ni reportes.',
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

async function saveShift(){
  const empName = document.getElementById('smEmp')?.value;
  const code    = document.getElementById('smCode')?.value;
  const fecha   = document.getElementById('smFecha')?.value||'2026-01-18';
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
      renderCal(); // refresh grid
      toast('ok','Turno guardado en BD',`${empName} · ${code} · ${fecha}`);
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
  // ciclo_ref solo aplica a patrones cíclicos (4x1, 6x1)
  if(box) box.style.display=(p==='4x1'||p==='6x1')?'':'none';
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
  if(document.getElementById('eTel')) document.getElementById('eTel').value=dbEmp.telefono||'';
  if(document.getElementById('eEmail')) document.getElementById('eEmail').value=dbEmp.email||'';
  if(document.getElementById('eHs')) document.getElementById('eHs').value=dbEmp.horas_semana||36;
  const patronEl=document.getElementById('ePatron'); if(patronEl) patronEl.value=dbEmp.patron||'LV';
  const cicloEl=document.getElementById('eCicloRef'); if(cicloEl) cicloEl.value=dbEmp.ciclo_ref||'';
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
  const ok=confirm(`¿Eliminar a ${name}? Esta acción lo desactiva (no borra historial).`);
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
  const ok=confirm(`¿Reactivar a ${name}?`);
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

function resetAndOpenEmpModal(tipoDefault='fijo'){
  window._editEmpRow=null;
  window._editEmpId=null;
  document.querySelector('#empM .mh-t').textContent='＋ Nuevo Funcionario';
  ['eNumero','eApNom','eEmail','eTel','eFnac','eFIng'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const hsEl=document.getElementById('eHs'); if(hsEl) hsEl.value='36';
  // Reset selects to first option
  ['eTipo','eCli','eSec','eTurno','ePatron'].forEach(id=>{ const el=document.getElementById(id); if(el) el.selectedIndex=0; });
  const cicloEl=document.getElementById('eCicloRef'); if(cicloEl) cicloEl.value='';
  const cicloBox=document.getElementById('eCicloRefBox'); if(cicloBox) cicloBox.style.display='none';
  const t=document.getElementById('eTipo');
  if(t) t.value=(String(tipoDefault).toLowerCase()==='suplente'?'Suplente':'Fijo');
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
  const raw   = document.getElementById('eApNom')?.value.trim();
  const email = document.getElementById('eEmail')?.value.trim();
  const tel   = document.getElementById('eTel')?.value.trim();
  const fnac  = document.getElementById('eFnac')?.value;
  const fing  = document.getElementById('eFIng')?.value;
  const hs    = parseInt(document.getElementById('eHs')?.value)||36;
  const tipo  = document.getElementById('eTipo')?.value==='Fijo'?'fijo':'suplente';
  const cliTxt = document.getElementById('eCli')?.value||'';
  const secTxt = document.getElementById('eSec')?.value||'';
  const turnoFijo = document.getElementById('eTurno')?.value||'M'; // valor directo del <option>
  const numeroRaw = parseInt(document.getElementById('eNumero')?.value)||null;
  if(!raw){ toast('wa','Completá el nombre','Campo obligatorio'); return; }
  const parts = raw.split(',');
  const apellido = (parts[0]||'').trim().toUpperCase();
  const nombre   = (parts[1]||'').trim().toUpperCase();
  if(sb){
    const clinicaId = await getIdByNombre('clinicas', cliTxt);
    const sectorId  = await getIdByNombre('sectores', secTxt);
    const payload = { apellido, nombre, tipo, email:email||null,
      telefono:tel||null, fecha_nacimiento:fnac||null, fecha_ingreso:fing||null,
      horas_semana:hs, horas_dia:6, activo:true,
      clinica_id:clinicaId, sector_id:sectorId, turno_fijo:turnoFijo,
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
  const rolSel    = document.getElementById('newRole')?.value||'nurse';
  const emailInp  = document.getElementById('uEmail')?.value||'';
  const funcSel   = document.querySelector('#userM select:first-of-type')?.value||'';
  const isEdit    = !!window._editUserId;
  if(isEdit){
    // Update existing user
    const idx = USERS_DATA.findIndex(u=>u.id===window._editUserId);
    const tel   = document.getElementById('uTel')?.value||'';
    const fnac  = document.getElementById('uFnac')?.value||'';
    if(idx>=0){
      USERS_DATA[idx].role  = rolSel;
      USERS_DATA[idx].email = emailInp||USERS_DATA[idx].email;
      USERS_DATA[idx].telefono = tel;
      USERS_DATA[idx].fnac = fnac;
    }
    if(sb){
      await sb.from('usuarios').update({rol:rolSel}).eq('id',window._editUserId);
      // Update funcionario fields if linked
      const u=USERS_DATA[idx];
      if(u?.funcionario_id) await sb.from('funcionarios').update({telefono:tel,fecha_nacimiento:fnac||null}).eq('id',u.funcionario_id);
    }
    toast('ok','Usuario actualizado',`${funcSel||emailInp} · Rol: ${rolSel}`);
  } else {
    // New user
    const newU={id:Date.now(),name:funcSel||emailInp,email:emailInp,role:rolSel,sector:'—',last:'Nunca',active:true};
    USERS_DATA.push(newU);
    if(sb) await sb.from('usuarios').insert({email:emailInp,rol:rolSel,activo:true});
    toast('ok','Usuario creado','Invitación enviada por email.');
  }
  window._editUserId=null;
  document.querySelector('#userM .mh-t').textContent='🛡️ Nuevo Usuario del Sistema';
  ['uEmail','uTel','uFnac'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const uEmpEl=document.getElementById('uEmp');if(uEmpEl)uEmpEl.selectedIndex=0;
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
        const yr = 2026;
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
  const solicitante = [...DB.funcionarios,...DB.suplentes].find(f=>fNombre(f)===cUser.name)||DB.funcionarios[2];
  const rec = candSel?.id ? ([...DB.funcionarios,...DB.suplentes].find(f=>String(f.id)===String(candSel.id))||null)
                          : ([...DB.funcionarios,...DB.suplentes].find(f=>fNombre(f)===receptor)||null);
  const solicitanteId = solicitante?.id||3;
  const receptorId = rec?.id||11;

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
  td.innerHTML=`<input type="text" value="${cur}" maxlength="5"
    style="width:44px;background:var(--bg3);border:1px solid var(--blue);color:var(--text);padding:2px 4px;border-radius:4px;font-size:10px;font-family:var(--ff-mono);text-align:center"
    onblur="saveGenCell(this,'${emp}',${day})"
    onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){this.value='${cur}';this.blur();}"
    autofocus>`;
  td.querySelector('input').select();
}

function saveGenCell(inp, emp, day){
  const val=inp.value.trim().toUpperCase();
  const td=inp.parentElement;
  td.innerHTML=val?`<span class="sh ${shCls(val)}">${val}</span>`:'';
  if(val) toast('in',`Editado: ${emp} · día ${day}`,'Cambio registrado. Aprobá para confirmar.');
}

async function approveGen(){
  closeM('genValidM');
  const gi = window._currentGenIdx??0;
  if(!GENS[gi]) return;
  GENS[gi].estado='aprobada';
  saveGENS();
  renderGenHistory();
  populateSendMes();
  toast('ok',`Planilla ${GENS[gi].mes} aprobada`,'Las agendas se envían ahora a todos los funcionarios');
  await sendEmails();
  if(sb) await createAlerta('ok',`Planilla ${GENS[gi].mes} aprobada`,'Generada y enviada por '+cUser.name,null);
}

async function deleteGen(idx){
  const g = GENS[idx]; if(!g) return;
  if(!confirm(`¿Eliminar la generación de ${g.mes}?\nSe borrarán todos los turnos del mes de la base de datos. Esta acción no se puede deshacer.`)) return;
  if(sb){
    const desde = `${g.anio}-${String(g.mesNum).padStart(2,'0')}-01`;
    const hasta = `${g.anio}-${String(g.mesNum).padStart(2,'0')}-31`;
    const {error} = await sb.from('turnos').delete().gte('fecha', desde).lte('fecha', hasta);
    if(error){ toast('er','Error al eliminar turnos', error.message); return; }
    DB.turnos = DB.turnos.filter(t => t.fecha < desde || t.fecha > hasta);
  }
  GENS.splice(idx, 1);
  saveGENS();
  renderGenHistory();
  populateSendMes();
  populateGenMesOptions();
  buildDynamicData();
  toast('ok', `${g.mes} eliminado`, 'Turnos borrados de la base de datos');
}

function downloadGenXLSX(genIdx){
  if(typeof XLSX==='undefined'){toast('er','Error','Librería XLSX no disponible.');return;}
  const wb=XLSX.utils.book_new();
  const days=Array.from({length:31},(_,i)=>i+1);
  const header=['Funcionario','Sector',...days.map(d=>{const ab=DAB[(3+d-1)%7];return `${d}(${ab})`}),'Guardias','Hs.','7ª?'];
  const rows=[header];
  SGRP.forEach(grp=>{
    rows.push([`== ${grp.sector} ==`,...Array(33).fill('')]);
    grp.emps.forEach(emp=>{
      const sc=WK[emp]||[];
      const guardias=sc.filter(c=>isW(c)).length;
      const is7=guardias>=7;
      const emp_data=EMPS.find(e=>e.name===emp);
      rows.push([emp,emp_data?.sector||grp.sector,...Array.from({length:31},(_,i)=>sc[i%7]||''),guardias,guardias*6,is7?'⚠ SÍ':'']);
    });
  });
  const ws=XLSX.utils.aoa_to_sheet(rows);
  ws['!cols']=[{wch:22},{wch:16},...Array(31).fill({wch:6}),{wch:9},{wch:6},{wch:6}];
  // Column widths
  ws['!cols']=[{wch:24},{wch:14},...Array(7).fill({wch:5}),{wch:8},{wch:6},{wch:6}];
  // Style header row
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  for(let C=range.s.c;C<=range.e.c;C++){
    const addr=XLSX.utils.encode_cell({r:0,c:C});
    if(!ws[addr]) continue;
    ws[addr].s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'1E3A6E'}},alignment:{horizontal:'center'}};
  }
  // Color cells by shift code
  const shiftColors={
    M:'DBEAFE',MS:'DBEAFE',MC:'DBEAFE',MG:'DBEAFE',MO:'DBEAFE',MU:'DBEAFE',MD:'DBEAFE',I:'DBEAFE',
    T:'FEF3C7',TS:'FEF3C7',TC:'FEF3C7',TG:'FEF3C7',TO:'FEF3C7',TU:'FEF3C7',TD:'FEF3C7',RS:'FEF3C7',E:'FEF3C7',ES:'FEF3C7',CWT:'FEF3C7',
    NO:'EDE9FE',NU:'EDE9FE',
    VO:'ECFDF5',VU:'ECFDF5',VD:'ECFDF5',V:'ECFDF5',
    LAR:'D1FAE5',LM:'D1FAE5',
    CERT:'A7F3D0',BPS:'A7F3D0',BSE:'A7F3D0',
    NC:'FEE2E2',F:'FEE2E2',
    LE:'FFEDD5',FI:'FFEDD5',
    s7:'FCA5A5',
  };
  for(let R=1;R<=range.e.r;R++){
    for(let C=2;C<=8;C++){
      const addr=XLSX.utils.encode_cell({r:R,c:C});
      if(!ws[addr]||!ws[addr].v) continue;
      const code=String(ws[addr].v);
      const bg=shiftColors[code]||(code.startsWith('==')?'F1F5F9':'FFFFFF');
      ws[addr].s={fill:{fgColor:{rgb:bg}},font:{bold:code.startsWith('==')?true:false},alignment:{horizontal:'center'}};
    }
    // Name column
    const nameCell=XLSX.utils.encode_cell({r:R,c:0});
    if(ws[nameCell]) ws[nameCell].s={font:{bold:true}};
  }
  XLSX.utils.book_append_sheet(wb,ws,'Planilla');
  // Alerts sheet with colors
  const alertRows=[['FUNCIONARIO','ALERTA','DETALLE']];
  alertRows.push(['M. PEREIRA','7ª Guardia','25 guardias este mes — 3 horas extra']);
  alertRows.push(['D. TITO','7ª Guardia','25 guardias este mes — 3 horas extra']);
  alertRows.push(['ECONOMATO','Vacante sin cubrir','18/01 — L. FAGUNDEZ falta imprevista']);
  const wsA=XLSX.utils.aoa_to_sheet(alertRows);
  wsA['!cols']=[{wch:22},{wch:16},{wch:40}];
  ['A1','B1','C1'].forEach(addr=>{ if(wsA[addr]) wsA[addr].s={font:{bold:true,color:{rgb:'FFFFFF'}},fill:{fgColor:{rgb:'DC2626'}}}; });
  XLSX.utils.book_append_sheet(wb,wsA,'Alertas');
  const gi=genIdx??window._currentGenIdx??0;
  const gm=(GENS[gi]?.mes||'Planilla').replace(/ /g,'_');
  XLSX.writeFile(wb,`Planilla_${gm}.xlsx`);
  toast('ok','Excel descargado',`Planilla_${gm}.xlsx`);
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
      d.push([`${d1.toString().padStart(2,'0')}/01/2026`,ab,code,isW(code)?'Trabajo':code==='LAR'?'LAR':code==='F'?'Falta':'Licencia',isW(code)?6:0,'']);
    });
    const ws=XLSX.utils.aoa_to_sheet(d);
    ws['!cols']=[{wch:14},{wch:5},{wch:9},{wch:14},{wch:6},{wch:30}];
    const shName=s.name.replace(/\. /g,'_').replace(/\./g,'').replace(/ /g,'_').slice(0,28);
    XLSX.utils.book_append_sheet(wb,ws,shName);
  });

  // LEYENDA
  const leg=[['CÓDIGO','NOMBRE','HORARIO','HS.'],['M','Mañana estándar','06:00—12:00',6],['TS','Tarde Setiembre','12:00—18:00',6],['NO','Noche Observación','00:00—06:00',6],['VO','Vespertino Obs.','18:00—24:00',6],['LAR','Lic. Anual Reglamentaria','—',0],['CERT','Certificación médica','—',0],['F','Falta Imprevista','—  Genera vacante',0]];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(leg),'LEYENDA');

  XLSX.writeFile(wb,`RRHH_Enfermeria_Enero2026.xlsx`);
  toast('ok','Excel descargado','RRHH_Enfermeria_Enero2026.xlsx — resumen por clínica + hoja por suplente');
}

function expEmpXLSX(){
  if(typeof XLSX==='undefined'){toast('er','Error','Librería no disponible.');return;}
  const wb=XLSX.utils.book_new();
  const data=[['FUNCIONARIO','CLÍNICA','SECTOR','TURNO','GUARDIAS','HS/MES','EXTRAS','FALTAS','ESTADO']];
  EMPS.forEach(e=>data.push([e.name,e.clinic,e.sector,e.shift,e.g,e.g*e.hday,e.extras||0,e.faltas||0,{active:'Activo',lar:'En LAR',cert:'CERT',absent:'Falta'}[e.status]||'—']));
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),'Funcionarios');
  XLSX.writeFile(wb,'Funcionarios_Enero2026.xlsx');
  toast('ok','Excel exportado','Listado de funcionarios descargado.');
}

// ........................................................
// TOAST
// ........................................................
function toast(type,title,desc){
  const icons={ok:'✓',wa:'⚠️',er:'✕',in:'ℹ️'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span style="font-size:14px;margin-top:1px">${icons[type]||'•'}</span><div style="flex:1"><div class="t-t">${title}</div>${desc?`<div class="t-d">${desc}</div>`:''}</div><button class="t-x" onclick="this.parentElement.remove()">✕</button>`;
  document.getElementById('tbox').appendChild(el);
  setTimeout(()=>el.remove(),5000);
}
// Init EmailJS on load


// ........................................................


