import pandas as pd, urllib.request, json, unicodedata, re

SB_URL = 'https://mrrjipzarpqksogrnalz.supabase.co'
SB_KEY = 'sb_publishable_Av-rU1CVm1CRV2D8WZuxLQ_Uxa_2OTF'
H = {'apikey': SB_KEY, 'Authorization': f'Bearer {SB_KEY}',
     'Content-Type': 'application/json', 'Prefer': 'return=representation'}

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
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s

def fmt_date(val):
    if pd.isna(val): return None
    try:
        return pd.Timestamp(val).strftime('%Y-%m-%d')
    except:
        return None

SECTORS = {
    'POLI MANANA':  (1,  1),
    'POLI TARDE':   (2,  1),
    'OBSERVACION':  (3,  1),
    'AMNP':         (4,  1),
    'CPB':          (5,  1),
    'ECONOMATO':    (6,  1),
    'GINE SET':     (7,  1),
    'HORNEROS':     (8,  1),
    'PROGRAMAS':    (9,  1),
    'ANEXO':        (10, 1),
    'APOYO':        (33, 1),
    'POLI MC':      (11, 2),
    'CARRASCO':     (11, 2),
    'URGENCIA C':   (12, 2),
    'POLI GOLF':    (13, 3),
    'GOLF':         (13, 3),
    'MAL. MANANA':  (14, 4),
    'MALDONADO':    (14, 4),
    'MAL. TARDE':   (15, 4),
    'DOMICILIO':    (31, 13),
    'COORDINACION': (32, 13),
    'CLINICA DE LA MUJER': (7, 1),
}

SHEET_OVERRIDE = {
    'Clinica de la Mujer': (7, 1),
    'Horneros':            (8, 1),
    'Golf':                (13, 3),
}

# Row-level filters: skip rows where 'nom' matches these (shift summaries, labels, etc.)
NOM_SKIP = re.compile(r'^(T\.(MANANA|MAÑANA|TARDE)|AMNP$|CIERRE$|GINE$|NOCHE$|INTERNACION$|U1$|U2$|ECOESTRESS$|COBERT)', re.I)

# Sector-level filters: skip sector labels that are shift summaries (NOT real sectors)
SEC_SKIP = re.compile(r'^(COBERTURA)', re.I)

# ---- Extract MARZO mapping ----
marzo_file = r'C:\Users\sanch\Downloads\MARZO MP 2026 (1).xlsx'
skip_sheets = {'MARZO 26', 'REFERENCIAS'}
rows_extracted = []

for sheet_name, df in pd.read_excel(marzo_file, sheet_name=None, header=None).items():
    if sheet_name in skip_sheets:
        continue
    sub = df.iloc[:, :2].copy()
    sub.columns = ['sec', 'nom']
    sub['sec'] = sub['sec'].ffill()
    mask = (
        sub['nom'].notna() &
        ~sub['nom'].isin(['NOMBRE', 'l']) &
        ~sub['nom'].astype(str).str.match(r'^NaN$')
    )
    for _, row in sub[mask].iterrows():
        sec_raw_orig = str(row['sec']).strip()
        sec_norm = norm(sec_raw_orig)
        nom_raw = str(row['nom']).strip().rstrip(' -')
        # Skip coverage/summary rows by sector name
        if SEC_SKIP.match(sec_norm):
            continue
        # Skip non-employee rows by nom content
        if NOM_SKIP.match(norm(nom_raw)):
            continue
        if sheet_name in SHEET_OVERRIDE:
            sid, cid = SHEET_OVERRIDE[sheet_name]
        else:
            entry = SECTORS.get(sec_norm)
            sid, cid = entry if entry else (None, None)
        rows_extracted.append({
            'sheet': sheet_name, 'sector': sec_norm,
            'nom': nom_raw, 'sector_id': sid, 'clinica_id': cid
        })

print(f'Filas MARZO extraidas: {len(rows_extracted)}')

# ---- Read Nomina ----
nom_file = r'C:\Users\sanch\Downloads\Nómina Enfermería_24.02.2026.xlsx'
dfn = pd.read_excel(nom_file, sheet_name=0, header=None, skiprows=3)
dfn.columns = ['num_fun', 'primer_nombre', 'nombre', 'apellido', 'fecha_nac', 'fecha_ing']
dfn = dfn[dfn['num_fun'].apply(
    lambda x: str(x).replace('.','').isnumeric() if pd.notna(x) else False
)].copy()
dfn['num_fun'] = dfn['num_fun'].astype(int)
dfn['apellido_n'] = dfn['apellido'].apply(norm)
dfn['pnombre_n']  = dfn['primer_nombre'].apply(norm)
dfn['snombre_n']  = dfn['nombre'].apply(norm)
print(f'Nomina: {len(dfn)} filas (puede haber num_fun duplicados)')

# Handle duplicate num_fun=489 (two different people): keep both, tag them
dup_mask = dfn.duplicated('num_fun', keep=False)
dfn.loc[dup_mask, 'num_fun_key'] = dfn[dup_mask].apply(
    lambda r: f"{int(r['num_fun'])}_{r['apellido_n']}", axis=1
)
dfn.loc[~dup_mask, 'num_fun_key'] = dfn[~dup_mask]['num_fun'].astype(str)

# ---- Match abbreviated name -> Nomina row ----
def parse_abrev(s):
    s = s.strip().rstrip(' -')
    m = re.match(r'^([A-Z])\.\s*(.+)$', s)
    if m:
        return m.group(1), norm(m.group(2))
    m = re.match(r'^([A-Z]{2,3})\s+(.+)$', s)
    if m:
        return m.group(1)[0], norm(m.group(2))
    return None, norm(s)

def fuzzy_apellido_match(ap_n, dfn):
    # Exact match
    c = dfn[dfn['apellido_n'] == ap_n]
    if not c.empty: return c
    # Substring: ap_n inside apellido (e.g. OSCAR inside DEOSCAR)
    c = dfn[dfn['apellido_n'].str.contains(ap_n, regex=False)]
    if not c.empty: return c
    # Remove doubled letters (CICCOLO -> CICOLO, COPPETTI -> COPETTI)
    ap_dedup = re.sub(r'(.)\1', r'\1', ap_n)
    c = dfn[dfn['apellido_n'].apply(lambda x: re.sub(r'(.)\1', r'\1', x)) == ap_dedup]
    if not c.empty: return c
    # Starts-with partial (min 4 chars)
    if len(ap_n) >= 4:
        c = dfn[dfn['apellido_n'].str.startswith(ap_n[:4])]
        if not c.empty: return c
    return pd.DataFrame()

# Employees not in Nomina (to be skipped)
NOT_IN_NOMINA = {'DE SOUZA', 'DEOSCAR'}  # E.DE SOUZA not in file

matched = []
unmatched = []
seen_key = {}  # num_fun_key -> True

# Also track manual overrides for ambiguous cases
MANUAL = {
    # MARZO abbreviated -> num_fun_key (force match)
    'M. PEREIRA': '539',       # JUAN MATHIAS PEREIRA (uses second name)
    'L. FAGUNDEZ': '428',      # YENICA LORENA FAGUNDEZ (uses second name)
    'L. MAGLIANO': '739',      # CRISTINA LUJAN MAGLIANO (uses second name)
    'N. TERAN': '540',         # ANDRES NICOLAS TERAN (uses second name)
    'M. FERNANDEZ': '746',     # WALTER MARTIN FERNANDEZ (uses second name)
    'A. OSCAR': '430',         # ANA MARIA DEOSCAR
    'F. CICOLLO': '557',       # FIORELLA CICCOLO (spelling)
    'C. COPETTI': '521',       # CATHERINE COPPETTI (spelling)
    'L.DOMINGUEZ': '489_DOMINGUEZ',  # LUCIA DANIELA DOMINGUEZ (dup num_fun)
    'F. RODRIGUEZ': '489_RODRIGUEZ', # MARIA FLORENCIA RODRIGUEZ (dup num_fun)
}

for row in rows_extracted:
    nom = row['nom']
    nom_key = nom.strip()

    # Check manual overrides first
    override_key = MANUAL.get(nom_key) or MANUAL.get(nom_key.replace('.', '. ').strip())
    if override_key:
        cands = dfn[dfn['num_fun_key'] == override_key]
        if not cands.empty and override_key not in seen_key:
            seen_key[override_key] = True
            matched.append({**row, 'emp': cands.iloc[0]})
            continue

    letter, ap_n = parse_abrev(nom)
    if not ap_n:
        unmatched.append(row)
        continue

    cands = fuzzy_apellido_match(ap_n, dfn)
    if cands.empty:
        unmatched.append(row)
        continue

    # Filter by first letter of first or second name
    if letter and len(cands) > 1:
        ok = cands[(cands['pnombre_n'].str.startswith(letter)) | (cands['snombre_n'].str.startswith(letter))]
        chosen = ok.iloc[0] if not ok.empty else cands.iloc[0]
    else:
        chosen = cands.iloc[0]

    key = chosen['num_fun_key']
    if key not in seen_key:
        seen_key[key] = True
        matched.append({**row, 'emp': chosen})
    # else: duplicate, skip (same person appears twice in MARZO)

print(f'Matcheados: {len(matched)}')
print(f'Sin match ({len(unmatched)}):')
for u in unmatched:
    print(f"  '{u['nom']}' -> sector={u['sector']} (sheet={u['sheet']})")

matched_keys = set(m['emp']['num_fun_key'] for m in matched)
all_keys = set(dfn['num_fun_key'].tolist())
unassigned_keys = all_keys - matched_keys

print(f'\nSin sector en MARZO ({len(unassigned_keys)}):')
for k in sorted(unassigned_keys, key=lambda x: int(x.split('_')[0])):
    r = dfn[dfn['num_fun_key'] == k].iloc[0]
    print(f"  [{r['num_fun']}] {r['primer_nombre']} {r['nombre']} {r['apellido']}")

# ---- Build insert records ----
records = []

def make_nombre(row):
    pn = norm(str(row['primer_nombre']))
    sn = norm(str(row['nombre']))
    return (pn + ' ' + sn).strip() if sn else pn

# Matched (with sector)
for m in matched:
    e = m['emp']
    records.append({
        'numero':           int(e['num_fun']),
        'apellido':         norm(str(e['apellido'])),
        'nombre':           make_nombre(e),
        'tipo':             'fijo',
        'clinica_id':       m['clinica_id'],
        'sector_id':        m['sector_id'],
        'fecha_nacimiento': fmt_date(e['fecha_nac']),
        'fecha_ingreso':    fmt_date(e['fecha_ing']),
        'activo':           True,
        'horas_semana':     36,
        'horas_dia':        6,
    })

# Unassigned (no sector yet)
for k in sorted(unassigned_keys, key=lambda x: int(x.split('_')[0])):
    r = dfn[dfn['num_fun_key'] == k].iloc[0]
    records.append({
        'numero':           int(r['num_fun']),
        'apellido':         norm(str(r['apellido'])),
        'nombre':           make_nombre(r),
        'tipo':             'fijo',
        'clinica_id':       None,
        'sector_id':        None,
        'fecha_nacimiento': fmt_date(r['fecha_nac']),
        'fecha_ingreso':    fmt_date(r['fecha_ing']),
        'activo':           True,
        'horas_semana':     36,
        'horas_dia':        6,
    })

print(f'\nTotal a insertar: {len(records)}')
print('\nMuestra (10 con sector asignado):')
for rec in [r for r in records if r['sector_id']][:10]:
    print(f"  [{rec['numero']}] {rec['apellido']}, {rec['nombre']} | c={rec['clinica_id']} s={rec['sector_id']}")

with open(r'C:\Users\sanch\AppData\Local\Temp\funcionarios_to_insert.json', 'w', encoding='utf-8') as f:
    json.dump(records, f, ensure_ascii=False, indent=2)
print('\nGuardado en funcionarios_to_insert.json')
