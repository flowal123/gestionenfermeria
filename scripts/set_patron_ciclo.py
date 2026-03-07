"""
set_patron_ciclo.py
Reads MARZO 26 sheet from the scheduling Excel file and:
  - Sets patron='4x1' + ciclo_ref for employees in OBSERVACION and AMNP sectors
  - Sets patron='LV' for all other employees
  - Updates all funcionarios in Supabase via REST API

Usage:
    python scripts/set_patron_ciclo.py
"""
import pandas as pd, urllib.request, json, unicodedata, re
from datetime import date, timedelta

SB_URL = 'https://mrrjipzarpqksogrnalz.supabase.co'
SB_KEY = 'sb_publishable_Av-rU1CVm1CRV2D8WZuxLQ_Uxa_2OTF'
H = {'apikey': SB_KEY, 'Authorization': f'Bearer {SB_KEY}',
     'Content-Type': 'application/json', 'Prefer': 'return=representation'}

MARZO_FILE = r'C:\Users\sanch\Downloads\MARZO MP 2026 (1).xlsx'

# Sectors that use 4x1 rotating pattern
SECTORES_4x1 = {'OBSERVACION', 'AMNP'}

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(f'{SB_URL}/rest/v1/{path}', data=data, headers=H, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            txt = resp.read()
            return json.loads(txt) if txt else []
    except Exception as e:
        print(f'ERROR {method} {path}: {e}')
        return []

def norm(s):
    if not s or str(s) == 'nan': return ''
    s = str(s).strip().upper()
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')

def fNombre(ap, nom):
    return f"{norm(ap)}, {norm(nom)}".strip(', ')

# ---- Load funcionarios from Supabase ----
print('Cargando funcionarios desde Supabase...')
funcs = api('GET', 'funcionarios?select=id,apellido,nombre,sector_id&tipo=eq.fijo&activo=eq.true&limit=200')
print(f'  {len(funcs)} funcionarios cargados')

# Load sectores to map id -> nombre
sectores = api('GET', 'sectores?select=id,nombre&limit=50')
sec_map = {s['id']: norm(s['nombre']) for s in sectores}

# ---- Read MARZO 26 sheet ----
print('Leyendo hoja MARZO 26...')
df = pd.read_excel(MARZO_FILE, sheet_name='MARZO 26', header=None)

# Find header row: row with day numbers 1..31 in columns 2+
header_row = None
for i, row in df.iterrows():
    vals = [str(v).strip() for v in row[2:33]]
    if vals[0] == '1' and vals[30] == '31':
        header_row = i
        break
if header_row is None:
    # Try numeric match
    for i, row in df.iterrows():
        nums = [v for v in row[2:33] if str(v).strip().isdigit()]
        if len(nums) >= 28:
            header_row = i
            break

if header_row is None:
    print('ERROR: No se encontró la fila de encabezado con los días 1-31')
    exit(1)

print(f'  Fila de encabezado encontrada: {header_row}')

# Rows below header_row have: col0=sector (forward-filled), col1=abbreviated name, col2..=day codes
data_df = df.iloc[header_row+1:].copy()
data_df.columns = range(len(data_df.columns))
data_df[0] = data_df[0].ffill()

# Filter valid employee rows
def is_employee_row(row):
    nom = str(row[1]).strip()
    if not nom or nom.lower() in ('nan', 'nombre', 'l'): return False
    if re.match(r'^(T\.(MANANA|MAÑANA|TARDE)|TOTAL|CIERRE|NOCHE)', nom.upper()): return False
    return True

data_df = data_df[data_df.apply(is_employee_row, axis=1)].copy()

# Build name->schedule mapping (first 31 days in columns 2..32)
schedule = {}  # norm(sector) -> {norm(abbrev_name): [code_day1..code_day31]}
for _, row in data_df.iterrows():
    sec = norm(str(row[0]))
    nom = str(row[1]).strip()
    codes = [str(row[c]).strip() if c in row.index and str(row[c]).strip() not in ('nan','') else ''
             for c in range(2, 33)]
    if sec not in schedule:
        schedule[sec] = {}
    schedule[sec][nom] = codes

print(f'  Sectores encontrados en MARZO 26: {list(schedule.keys())}')

# ---- Calculate ciclo_ref for 4x1 employees ----
def calc_ciclo_ref_4x1(codes):
    """
    Given 31 day codes for March 2026, find the ciclo_ref date.
    Pattern: 4 consecutive working days + 1 rest, repeating.
    ciclo_ref = first day of their working cycle (day where cycle offset = 0).
    We look at the first 5 days to determine the offset of March 1 within the cycle.
    Returns a date string 'YYYY-MM-DD' or None.
    """
    march1 = date(2026, 3, 1)
    # Determine if each day is a working day (has a shift code)
    working = [bool(c and c.upper() not in ('', 'LX', 'LXE', 'LX1', 'LX2', 'LX3')) for c in codes[:10]]

    # Find position within 4x1 cycle on March 1
    # Try each possible offset (0..4) and check consistency
    best_offset = None
    best_score = -1
    for offset in range(5):
        score = 0
        for d in range(10):
            cycle_pos = (offset + d) % 5
            expected_work = cycle_pos < 4
            if working[d] == expected_work:
                score += 1
        if score > best_score:
            best_score = score
            best_offset = offset

    if best_offset is None:
        return None

    # ciclo_ref = March 1 - best_offset days (so that March 1 is day `best_offset` of the cycle)
    ciclo_ref_date = march1 - timedelta(days=best_offset)
    return ciclo_ref_date.strftime('%Y-%m-%d')

# ---- Match funcionarios and update ----
updated = 0
skipped = 0

for f in funcs:
    sec_nombre = sec_map.get(f.get('sector_id'), '')
    sec_norm = norm(sec_nombre)

    if sec_norm in SECTORES_4x1:
        # Try to find this employee in MARZO 26
        full_name = fNombre(f['apellido'], f['nombre'])
        apellido_n = norm(f['apellido'])

        ciclo_ref = None
        for sec_key, emps in schedule.items():
            if sec_key not in SECTORES_4x1:
                continue
            for abbrev, codes in emps.items():
                # Match by apellido
                abbrev_norm = norm(abbrev)
                # Extract apellido from abbreviated name (e.g. "M. PEREIRA" -> "PEREIRA")
                m = re.match(r'^[A-Z]{1,3}[\.\s]+(.+)$', abbrev_norm)
                abbrev_ap = m.group(1).strip() if m else abbrev_norm
                if apellido_n and (apellido_n == abbrev_ap or apellido_n.startswith(abbrev_ap[:4]) or abbrev_ap.startswith(apellido_n[:4])):
                    ciclo_ref = calc_ciclo_ref_4x1(codes)
                    print(f'  4x1 {full_name} -> ciclo_ref={ciclo_ref} (matched "{abbrev}")')
                    break
            if ciclo_ref:
                break

        if not ciclo_ref:
            # Default: assume March 1 is day 0 of cycle
            ciclo_ref = '2026-03-01'
            print(f'  4x1 {full_name} -> ciclo_ref=2026-03-01 (no match en MARZO 26, usando default)')

        result = api('PATCH', f'funcionarios?id=eq.{f["id"]}', {'patron': '4x1', 'ciclo_ref': ciclo_ref})
        updated += 1
    else:
        # LV pattern
        result = api('PATCH', f'funcionarios?id=eq.{f["id"]}', {'patron': 'LV', 'ciclo_ref': None})
        updated += 1

print(f'\nActualizados: {updated} funcionarios')
print(f'Saltados: {skipped}')
print('\nPatrones asignados:')
print(f'  LV  (Lunes-Viernes): empleados fuera de OBSERVACION/AMNP')
print(f'  4x1 (4 trabajo + 1 descanso): sectores OBSERVACION y AMNP')
print('\nPodés ajustar el patron de cada empleado individualmente desde la app (Funcionarios → Editar).')
