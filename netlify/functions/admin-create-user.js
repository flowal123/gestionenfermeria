// GuardiaApp — Admin bulk user creation
// Uses Supabase Admin API to create auth users without confirmation email
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const SB_URL  = process.env.SUPABASE_URL;
  const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SVC_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Configuración incompleta.' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido.' }) }; }

  const { username, password, funcionario_id, rol, authHeader } = body;
  if (!username || !password || !authHeader?.startsWith('Bearer ')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan campos requeridos.' }) };
  }

  // 1. Verificar que el caller es admin
  const callerRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: SVC_KEY }
  });
  if (!callerRes.ok) return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida.' }) };
  const callerData = await callerRes.json();
  const callerUsername = (callerData?.email || '').replace(/@guardiapp\.app$/, '');

  const roleRes = await fetch(
    `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(callerUsername)}&activo=eq.true&select=rol`,
    { headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } }
  );
  const roles = await roleRes.json();
  if (!Array.isArray(roles) || roles[0]?.rol !== 'admin') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden crear usuarios.' }) };
  }

  const email = `${username}@guardiapp.app`;

  // 2. Crear usuario en Supabase Auth (sin email de confirmación)
  const createRes = await fetch(`${SB_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true })
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    // Si ya existe, intentar recuperar el UUID via RPC
    if (err.code === 'email_exists' || (err.message||'').toLowerCase().includes('already')) {
      const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/get_auth_user_id`, {
        method: 'POST',
        headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: email })
      });
      const existingId = rpcRes.ok ? await rpcRes.json().catch(() => null) : null;
      if (existingId) return { statusCode: 200, body: JSON.stringify({ auth_user_id: existingId, linked: true }) };
    }
    return { statusCode: 400, body: JSON.stringify({ error: err.message || 'Error al crear usuario en Auth.' }) };
  }

  const authUser = await createRes.json();
  const authUserId = authUser?.id;

  // 3. Insertar en tabla usuarios
  const insertRes = await fetch(`${SB_URL}/rest/v1/usuarios`, {
    method: 'POST',
    headers: {
      apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      email: username, rol: rol || 'nurse', activo: true,
      funcionario_id: funcionario_id || null,
      auth_user_id: authUserId, must_change_password: true
    })
  });

  if (!insertRes.ok) {
    const err = await insertRes.json().catch(() => ({}));
    return { statusCode: 400, body: JSON.stringify({ error: `Auth OK pero error en BD: ${err.message || insertRes.status}` }) };
  }

  return { statusCode: 200, body: JSON.stringify({ auth_user_id: authUserId, linked: false }) };
};
