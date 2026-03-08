"""
update_from_nomina.py
Actualiza funcionarios existentes y carga nuevos suplentes desde
"Nómina Enfermería_24.02.2026 c regimenes y lugares.xlsx"

Acciones:
  1. Actualiza tipo (fijo/suplente), patron, turno_fijo, fecha_nacimiento,
     fecha_ingreso para todos los registros que matcheen por numero.
  2. Inserta suplentes nuevos que no existan en la BD.
"""

import pandas as pd, urllib.request, json, unicodedata, re, os
from pathlib import Path

SB_URL = 'https://mrrjipzarpqksogrnalz.supabase.co'
SB_KEY = 'sb_publishable_Av-rU1CVm1CRV2D8WZuxLQ_Uxa_2OTF'
H = {'apikey': SB_KEY, 'Authorization': f'Bearer {SB_KEY}',
     'Content-Type': 'application/json', 'Prefer': 'return=representation'}

EXCEL = Path(r"C:\Users\sanch\OneDrive\Desktop\Nómina Enfermería_24.02.2026 c regimenes y lugares.xlsx")

# ── helpers ────────────────────────────────────────────────────────────────

def api(method, path, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(f'{SB_URL}/rest/v1/{path}', data=data, headers=H, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            txt = r.read()
            return json.loads(txt) if txt else []
    except urllib.error.HTTPError as e:
        msg = e.read().decode()
        print(f'  HTTP {e.code}: {msg[:200]}')
        return None

def norm(s):
    s = str(s or '').strip()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return s.upper()

# ── regimen → patron ───────────────────────────────────────────────────────

def get_patron(regimen_raw):
    r = norm(regimen_raw).lower()
    if '4 y 1' in r or '4y1' in r or 'turnante' in r:
        return '4x1'
    if '6x1' in r or '6 y 1' in r:
        return '6x1'
    return 'LV'  # lunes a viernes / 36hs / sabado-domingo / default

# ── turno → turno_fijo ────────────────────────────────────────────────────

def get_turno_fijo(turno_raw, tipo):
    t = norm(turno_raw).lower()
    if not t or t in ('nan', '-', '—'):
        return None
    if 'manana' in t or 'mañana' in t or '7 a 13' in t or '7 a 14' in t:
        return 'M'
    if 'noche' in t:
        return 'N'
    if 'vespertino' in t or 'vesp' in t:
        return 'V'
    if 'tarde' in t or '13 a 19' in t or '14 a 21' in t or '14:45' in t or '15' in t or 'cierre' in t:
        return 'T'
    if 'intermedio' in t:
        return 'T'
    # suplentes con disponibilidad variable → None
    return None

# ── clinica matching ──────────────────────────────────────────────────────

CLINICA_MAP = {
    'setiembre':              'setiembre',
    'carrasco':               'carrasco',
    'golf':                   'golf',
    'punta del este':         'maldonado',
    'maldonado':              'maldonado',
    'horneros':               'setiembre',     # edificio dentro de setiembre
    'block quirurgico':       'setiembre',
    'aguada park':            'setiembre',
    'clinica mujer':          'setiembre',
    'coworking':              None,
    'domicilio':              None,
    'todas las clinicas':     None,
    'todas':                  None,
}

def match_clinica(raw, clinicas_db):
    """Devuelve el id de clinica o None."""
    k = norm(raw).lower().strip()
    if not k or k in ('nan', '-'):
        return None
    for key, mapped in CLINICA_MAP.items():
        if key in k:
            if mapped is None:
                return None
            for c in clinicas_db:
                if mapped in norm(c['nombre']).lower():
                    return c['id']
    # fallback: buscar si el texto coincide con algun nombre de clinica
    for c in clinicas_db:
        if norm(c['nombre']).lower() in k or k in norm(c['nombre']).lower():
            return c['id']
    return None

# ── sector matching ────────────────────────────────────────────────────────

SECTOR_MAP = {
    'policlinica':   ['POLI MANANA', 'POLI TARDE'],
    'gine':          ['GINE SET'],
    'economato':     ['ECONOMATO'],
    'coordinacion':  [],
    'amnp':          ['AMNP'],
    'observacion':   ['OBSERVACION'],
    'cpb':           ['CPB'],
    'programas':     ['PROGRAMAS'],
    'urgencia':      ['OBSERVACION'],
    'domicilio':     [],
    'renal':         ['CPB'],
}

def match_sector(raw, sectores_db):
    k = norm(raw).lower().strip()
    if not k or k in ('nan', '-', 'todas'):
        return None
    for key, candidates in SECTOR_MAP.items():
        if key in k:
            if not candidates:
                return None
            for s in sectores_db:
                sn = norm(s['nombre'])
                if any(c in sn for c in candidates):
                    return s['id']
    # fallback directo
    for s in sectores_db:
        if norm(s['nombre']).lower() in k or k in norm(s['nombre']).lower():
            return s['id']
    return None

# ── main ───────────────────────────────────────────────────────────────────

def main():
    print('Leyendo Excel...')
    df = pd.read_excel(EXCEL, header=3)
    df.columns = [str(c).strip() for c in df.columns]
    col = df.columns.tolist()
    # renombrar por posicion
    df = df.rename(columns={
        col[0]: 'numero',
        col[1]: 'primer_nombre',
        col[2]: 'segundo_nombre',
        col[3]: 'apellido',
        col[4]: 'fecha_nac',
        col[5]: 'fecha_ing',
        col[6]: 'tipo_raw',
        col[7]: 'clinica_raw',
        col[8]: 'sector_raw',
        col[9]: 'turno_raw',
        col[10]: 'regimen_raw',
    })
    # filtrar: solo titulares y suplentes, no "no contar"
    def is_valid(v):
        v = str(v).lower().strip()
        return v in ('titular', 'suplente')
    df = df[df['tipo_raw'].apply(is_valid)].copy()
    df['numero'] = pd.to_numeric(df['numero'], errors='coerce').dropna()
    df = df.dropna(subset=['numero'])
    df['numero'] = df['numero'].astype(int)
    print(f'  {len(df)} empleados válidos ({len(df[df.tipo_raw.str.lower()=="titular"])} titulares, '
          f'{len(df[df.tipo_raw.str.lower()=="suplente"])} suplentes)')

    # Fetch DB
    print('Cargando datos de Supabase...')
    func_db  = api('GET', 'funcionarios?select=id,numero,nombre,apellido,tipo,sector_id,clinica_id&limit=500') or []
    clinicas = api('GET', 'clinicas?select=id,nombre&limit=50') or []
    sectores = api('GET', 'sectores?select=id,nombre&limit=50') or []
    print(f'  {len(func_db)} funcionarios en BD, {len(clinicas)} clinicas, {len(sectores)} sectores')

    # numero in DB is stored as string — normalize both sides to str for lookup
    by_num = {str(f['numero']): f for f in func_db if f.get('numero') is not None}

    updated = 0
    inserted = 0
    skipped  = 0

    for _, row in df.iterrows():
        num     = int(row['numero'])
        tipo    = 'fijo' if str(row['tipo_raw']).lower().strip() == 'titular' else 'suplente'
        patron  = get_patron(row['regimen_raw'])
        turno   = get_turno_fijo(row['turno_raw'], tipo)
        cli_id  = match_clinica(str(row['clinica_raw']), clinicas)
        sec_id  = match_sector(str(row['sector_raw']), sectores)

        # fecha_nacimiento
        fn = None
        try:
            fn = pd.Timestamp(row['fecha_nac']).strftime('%Y-%m-%d') if pd.notna(row['fecha_nac']) else None
        except:
            pass

        # fecha_ingreso
        fi = None
        try:
            fi = pd.Timestamp(row['fecha_ing']).strftime('%Y-%m-%d') if pd.notna(row['fecha_ing']) else None
        except:
            pass

        if str(num) in by_num:
            # UPDATE
            payload = {'tipo': tipo, 'patron': patron}
            if turno:
                payload['turno_fijo'] = turno
            if fn:
                payload['fecha_nacimiento'] = fn
            if fi:
                payload['fecha_ingreso'] = fi
            # only update clinica/sector if DB still null
            db_rec = by_num[str(num)]
            if not db_rec.get('clinica_id') and cli_id:
                payload['clinica_id'] = cli_id
            if not db_rec.get('sector_id') and sec_id:
                payload['sector_id'] = sec_id

            r = api('PATCH', f'funcionarios?numero=eq.{num}', payload)
            if r is not None:
                print(f'  UPD {num:4d} {row["apellido"]:<20s} tipo={tipo} patron={patron} turno={turno}')
                updated += 1
            else:
                skipped += 1

        else:
            # INSERT nuevo suplente
            apel = str(row['apellido']).strip().upper()
            nom1 = str(row['primer_nombre']).strip().upper()
            nom2 = str(row['segundo_nombre']).strip()
            nom2 = '' if nom2.lower() in ('nan', '-') else nom2.strip().upper()
            nombre_completo = f"{nom1} {nom2}".strip()

            payload = {
                'numero': num,
                'apellido': apel,
                'nombre': nombre_completo,
                'tipo': 'suplente',
                'activo': True,
                'patron': patron,
            }
            if turno:
                payload['turno_fijo'] = turno
            if fn:
                payload['fecha_nacimiento'] = fn
            if fi:
                payload['fecha_ingreso'] = fi
            if cli_id:
                payload['clinica_id'] = cli_id
            if sec_id:
                payload['sector_id'] = sec_id

            r = api('POST', 'funcionarios', payload)
            if r:
                new_id = r[0]['id'] if isinstance(r, list) else r.get('id')
                print(f'  INS {num:4d} {apel:<20s} {nombre_completo:<20s} clinica_id={cli_id} sec_id={sec_id}')
                inserted += 1
            else:
                print(f'  ERR insertar {num} {apel}')
                skipped += 1

    print(f'\nListo: {updated} actualizados, {inserted} insertados, {skipped} errores/omitidos')

if __name__ == '__main__':
    main()
