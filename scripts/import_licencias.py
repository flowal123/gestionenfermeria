"""
import_licencias.py
Importador de Licencias LAR desde planillas RRHH (SIAM y ALBINCO).

Estructura esperada de los archivos:
  - Col 0: N° Funcionario
  - Col 1: Nombre
  - Por cada mes: 3 columnas [Desde, Al, Días] (día del mes, 1-31)
  - SIAM:    datos empiezan col 10, fila 2 (header en filas 0-1)
  - ALBINCO: datos empiezan col 11, fila 2

Uso:
    python scripts/import_licencias.py

    Opcionalmente editar las rutas de los archivos y el año más abajo.
"""
import pandas as pd, urllib.request, json, unicodedata, os, sys

# ---- Config ----
YEAR = 2026
DOWNLOADS = r'C:\Users\sanch\Downloads'
SIAM_FILE    = os.path.join(DOWNLOADS, 'Licencias 2026 - Enfermeria SIAM.xlsx')
ALBINCO_FILE = next((os.path.join(DOWNLOADS, f) for f in os.listdir(DOWNLOADS) if 'ALBINCO' in f.upper()), None)

SB_URL = 'https://mrrjipzarpqksogrnalz.supabase.co'
SB_KEY = 'sb_publishable_Av-rU1CVm1CRV2D8WZuxLQ_Uxa_2OTF'
H = {'apikey': SB_KEY, 'Authorization': f'Bearer {SB_KEY}',
     'Content-Type': 'application/json', 'Prefer': 'return=representation'}

# ---- Helpers ----
def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(f'{SB_URL}/rest/v1/{path}', data=data, headers=H, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            txt = resp.read(); return json.loads(txt) if txt else []
    except Exception as e:
        print(f'ERROR {method} {path}: {e}'); return []

def norm(s):
    if not s or str(s) == 'nan': return ''
    s = str(s).strip().upper()
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn')

def to_int(v):
    try:
        f = float(str(v).strip()); return int(f) if f == f else None
    except: return None

# ---- Load funcionarios ----
print('Cargando funcionarios desde Supabase...')
funcs = api('GET', 'funcionarios?select=id,numero,apellido,nombre&limit=300')
by_num  = {str(f['numero']): f for f in funcs if f.get('numero')}
by_apel = {norm(f['apellido']): f for f in funcs}
print(f'  {len(funcs)} funcionarios cargados')

def find_func(num_raw, nombre_raw):
    num = str(to_int(num_raw) or '').strip()
    if num and num in by_num: return by_num[num]
    ap = norm((nombre_raw or '').split()[-1]) if nombre_raw else ''
    if ap and ap in by_apel: return by_apel[ap]
    for k, f in by_apel.items():
        if len(ap) >= 4 and len(k) >= 4 and k.startswith(ap[:4]): return f
    return None

# ---- Extract licencias from one sheet ----
def extract(df, first_col, source):
    recs, unmatched = [], []
    for _, row in df.iloc[2:].iterrows():
        num_raw = str(row.iloc[0]).strip()
        nom_raw = str(row.iloc[1]).strip()
        if not num_raw or num_raw.lower() == 'nan': continue
        f = find_func(num_raw, nom_raw)
        if not f:
            unmatched.append(f'{num_raw} {nom_raw}')
            continue
        for m_idx in range(12):
            base = first_col + m_idx * 4
            desde_v = to_int(row.iloc[base])     if base     < len(row.index) else None
            al_v    = to_int(row.iloc[base + 1]) if base + 1 < len(row.index) else None
            if not desde_v or not al_v: continue
            if desde_v < 1 or al_v > 31 or al_v < desde_v: continue
            recs.append({
                'funcionario_id': f['id'],
                'tipo': 'LAR',
                'fecha_desde': f'{YEAR}-{m_idx+1:02d}-{desde_v:02d}',
                'fecha_hasta': f'{YEAR}-{m_idx+1:02d}-{al_v:02d}',
                'genera_vacante': True,
                'estado': 'activa',
                'observaciones': f'Importado de {source}',
            })
    return recs, unmatched

# ---- Process files ----
all_recs = []

if os.path.exists(SIAM_FILE):
    df = pd.read_excel(SIAM_FILE, sheet_name=0, header=None)
    recs, unm = extract(df, first_col=10, source='SIAM')
    all_recs.extend(recs)
    print(f'SIAM: {len(recs)} licencias')
    if unm: print(f'  Sin match: {unm}')
else:
    print(f'SIAM no encontrado: {SIAM_FILE}')

if ALBINCO_FILE and os.path.exists(ALBINCO_FILE):
    for sname, df in pd.read_excel(ALBINCO_FILE, sheet_name=None, header=None, engine='xlrd').items():
        recs, unm = extract(df, first_col=11, source=f'ALBINCO/{sname}')
        all_recs.extend(recs)
        print(f'ALBINCO/{sname}: {len(recs)} licencias')
        if unm: print(f'  Sin match: {unm}')
else:
    print('ALBINCO no encontrado')

print(f'\nTotal a insertar: {len(all_recs)}')
if not all_recs:
    print('Nada que insertar. Verificar rutas y estructura de archivos.')
    sys.exit(0)

# ---- Batch insert ----
inserted = 0
for i in range(0, len(all_recs), 100):
    chunk = all_recs[i:i+100]
    res = api('POST', 'licencias', chunk)
    if isinstance(res, list):
        inserted += len(res)
        print(f'  Batch {i//100+1}: {len(res)} insertadas')
    else:
        print(f'  Batch {i//100+1}: ERROR - {res}')

print(f'\nTotal insertadas: {inserted} licencias LAR')
print('Listo. Recarga la app para ver las licencias.')
