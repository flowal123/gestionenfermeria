"""
fix_march_2026.py
-----------------
1. Fixes 4 wrong turno_fijo values (FERREIRO/LOZA/ZUNINO -> M, PRIEU -> T)
2. Sets turno_sabado='M' for 5 LS employees (MALLO/DA SILVA/CLAVIJO/ACOSTA/FIRPO)
   NOTE: requires 'turno_sabado' column in Supabase:
         ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS turno_sabado text;
3. Deletes all March 2026 turnos
4. Re-generates March 2026 turnos with:
   - turno_sabado override on Saturdays for LS employees
   - Skip days covered by active licencias (LAR, CERT, F, etc.)
   - CMP on birthday day (if birthday falls in March)

Usage:
    python scripts/fix_march_2026.py
"""
import json, urllib.request, urllib.error, sys
from datetime import date, timedelta

SB_URL = 'https://mrrjipzarpqksogrnalz.supabase.co'
SB_KEY = 'sb_publishable_Av-rU1CVm1CRV2D8WZuxLQ_Uxa_2OTF'
H = {
    'apikey': SB_KEY,
    'Authorization': f'Bearer {SB_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
}

YEAR, MONTH = 2026, 3
MARCH_FROM = date(YEAR, MONTH, 1)
MARCH_TO   = date(YEAR, MONTH, 31)

TURNO_FIJO_FIXES = {
    221: 'M',   # FERREIRO
    161: 'M',   # LOZA
    70:  'M',   # ZUNINO
    503: 'T',   # PRIEU
}

TURNO_SABADO_FIXES = {
    619: 'M',   # MALLO
    626: 'M',   # DA SILVA
    715: 'M',   # CLAVIJO
    609: 'M',   # ACOSTA
    766: 'M',   # FIRPO
    555: 'M',   # CESAR
}

def api(method, path, body=None, extra_headers=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        f'{SB_URL}/rest/v1/{path}',
        data=data, headers={**H, **(extra_headers or {})}, method=method
    )
    try:
        with urllib.request.urlopen(req) as resp:
            txt = resp.read()
            return json.loads(txt) if txt else []
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f'  [ERR] HTTP {e.code} {method} /{path.split("?")[0]}: {err[:300]}')
        return None

def is_work_day(patron, ciclo_ref_str, d):
    wd = d.weekday()  # 0=Mon, 5=Sat, 6=Sun
    if patron == 'LV':  return wd < 5
    if patron == 'LS':  return wd < 6
    if patron == 'SD':  return wd >= 5
    if patron == '36H': return True
    if patron in ('4x1', '6x1'):
        if not ciclo_ref_str:
            return wd < 5  # fallback LV
        cr = date.fromisoformat(ciclo_ref_str)
        offset = (d - cr).days % (5 if patron == '4x1' else 7)
        return offset < (4 if patron == '4x1' else 6)
    return wd < 5  # default LV

def sep(title):
    print(f'\n{"="*55}')
    print(f'  {title}')
    print(f'{"="*55}')

# ── STEP 1: Load funcionarios (without turno_sabado column) ──────────────────
sep('STEP 1: Load & fix turno_fijo values')
SEL = 'id,numero,apellido,turno_fijo,patron,ciclo_ref,fecha_nacimiento,sector_id'
funcs = api('GET', f'funcionarios?select={SEL}&tipo=eq.fijo&activo=eq.true')
if not funcs:
    print('  Could not load funcionarios — aborting'); sys.exit(1)

print(f'  Loaded {len(funcs)} active fijo funcionarios')
by_num = {str(f.get('numero','')): f for f in funcs if f.get('numero')}

for num, turno in TURNO_FIJO_FIXES.items():
    f = by_num.get(str(num))
    if not f:
        print(f'  [WARN] Numero {num} not found'); continue
    if f.get('turno_fijo') == turno:
        print(f'  [OK]   {f["apellido"]} ({num}) already turno_fijo={turno}'); continue
    res = api('PATCH', f'funcionarios?id=eq.{f["id"]}', {'turno_fijo': turno})
    if res is not None:
        print(f'  [FIX]  {f["apellido"]} ({num}): turno_fijo {f.get("turno_fijo")} -> {turno}')
        f['turno_fijo'] = turno

# ── STEP 2: Set turno_sabado (requires column to exist in DB) ─────────────────
sep('STEP 2: Set turno_sabado for LS Saturday employees')
turno_sabado_column_ok = True
for num, turno_sab in TURNO_SABADO_FIXES.items():
    f = by_num.get(str(num))
    if not f:
        print(f'  [WARN] Numero {num} not found'); continue
    res = api('PATCH', f'funcionarios?id=eq.{f["id"]}', {'turno_sabado': turno_sab})
    if res is None:
        print(f'  [SKIP] turno_sabado column may not exist yet in DB')
        turno_sabado_column_ok = False
    else:
        print(f'  [FIX]  {f["apellido"]} ({num}): turno_sabado -> {turno_sab}')
    # Always set in local cache so regeneration uses it
    f['turno_sabado'] = turno_sab

if not turno_sabado_column_ok:
    print()
    print('  ACTION REQUIRED: Run this SQL in Supabase dashboard:')
    print('    ALTER TABLE funcionarios ADD COLUMN IF NOT EXISTS turno_sabado text;')
    print('  Then re-run this script to persist turno_sabado to DB.')
    print('  (Regeneration below will still use turno_sabado from local cache.)')

# ── STEP 3: Load licencias for March 2026 ────────────────────────────────────
sep('STEP 3: Load licencias overlapping March 2026')
lics_raw = api('GET',
    'licencias?select=funcionario_id,fecha_desde,fecha_hasta,tipo'
    '&fecha_desde=lte.2026-03-31&fecha_hasta=gte.2026-03-01')
print(f'  Found {len(lics_raw or [])} licencias')

covered_days = set()
for lic in (lics_raw or []):
    try:
        d_from = max(date.fromisoformat(lic['fecha_desde']), MARCH_FROM)
        d_to   = min(date.fromisoformat(lic['fecha_hasta']), MARCH_TO)
    except Exception:
        continue
    cur = d_from
    while cur <= d_to:
        covered_days.add((lic['funcionario_id'], cur.isoformat()))
        cur += timedelta(days=1)
print(f'  Employee-days covered by licencias: {len(covered_days)}')

# ── STEP 4: Delete March 2026 turnos ─────────────────────────────────────────
sep('STEP 4: Delete existing March 2026 turnos')
del_res = api('DELETE', 'turnos?fecha=gte.2026-03-01&fecha=lte.2026-03-31',
              extra_headers={'Prefer': 'return=minimal'})
if del_res is not None:
    print('  Deleted existing March 2026 turnos')
else:
    print('  [WARN] Delete may have failed — proceeding with upsert anyway')

# ── STEP 5: Re-generate ───────────────────────────────────────────────────────
sep('STEP 5: Re-generate March 2026 turnos')
total_saved   = 0
total_skipped = 0
alerts_7th    = []

for f in funcs:
    fid        = f['id']
    patron     = f.get('patron') or 'LV'
    turno_base = f.get('turno_fijo') or 'M'
    turno_sab  = f.get('turno_sabado')  # from local cache (set in step 2)
    sector_id  = f.get('sector_id')
    ciclo_ref  = f.get('ciclo_ref')

    bday_day = None
    fnac_str = f.get('fecha_nacimiento') or ''
    if fnac_str:
        try:
            fnac = date.fromisoformat(fnac_str)
            if fnac.month == MONTH:
                bday_day = fnac.day
        except Exception:
            pass

    batch = []
    consecutive = 0
    max_consec  = 0

    for day_num in range(1, 32):
        d = date(YEAR, MONTH, day_num)
        d_str = d.isoformat()

        if not is_work_day(patron, ciclo_ref, d):
            consecutive = 0
            continue

        if (fid, d_str) in covered_days:
            total_skipped += 1
            consecutive = 0
            continue

        is_sat = (d.weekday() == 5)
        code   = turno_sab if (is_sat and turno_sab) else turno_base
        if bday_day is not None and day_num == bday_day:
            code = 'CMP'

        batch.append({'funcionario_id': fid, 'fecha': d_str, 'codigo': code, 'sector_id': sector_id})
        consecutive += 1
        max_consec = max(max_consec, consecutive)

    if not batch:
        continue

    CHUNK = 200
    for i in range(0, len(batch), CHUNK):
        chunk = batch[i:i+CHUNK]
        res = api('POST', 'turnos?on_conflict=funcionario_id,fecha', chunk,
                  extra_headers={'Prefer': 'resolution=merge-duplicates,return=minimal'})
        if res is None:
            print(f'  [ERR]  {f["apellido"]} chunk {i//CHUNK+1}')
        else:
            total_saved += len(chunk)

    if max_consec >= 7:
        alerts_7th.append(f'{f["apellido"]} ({max_consec} consecutive days)')

print(f'\n  Saved  : {total_saved} turnos')
print(f'  Skipped: {total_skipped} days (licencias)')

if alerts_7th:
    print('\n  WARNING - potential 7th consecutive shift:')
    for a in alerts_7th:
        print(f'    - {a}')
else:
    print('  No 7th-shift alerts')

print('\nDone! Refresh the app to see updated turnos.')
