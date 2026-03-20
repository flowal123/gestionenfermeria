// GuardiaApp — Admin password reset
// Netlify serverless function — Node 18+ (native fetch, no dependencies)
// Required Netlify env vars:
//   SUPABASE_URL            = https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY = eyJ...  (from Supabase > Settings > API)
//   SUPABASE_ANON_KEY       = eyJ...

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SB_URL  = process.env.SUPABASE_URL;
  const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SB_URL || !SVC_KEY) {
    console.error('[admin-reset-password] Missing env vars');
    return { statusCode: 500, body: JSON.stringify({ error: 'Configuración del servidor incompleta.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'JSON inválido.' }) }; }

  const { userEmail, newPassword, mustChange } = body;
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';

  if (!userEmail || !newPassword || !authHeader.startsWith('Bearer ')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltan campos requeridos.' }) };
  }

  // 1. Verificar que el caller está autenticado
  const callerRes = await fetch(`${SB_URL}/auth/v1/user`, {
    headers: { Authorization: authHeader, apikey: SVC_KEY }
  });
  if (!callerRes.ok) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Sesión inválida.' }) };
  }
  const callerData = await callerRes.json();
  if (!callerData?.email) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No autenticado.' }) };
  }

  // 2. Verificar que el caller tiene rol admin en tabla usuarios
  // callerData.email viene de Supabase Auth (con dominio) — se convierte a username para buscar en tabla
  const callerUsername = callerData.email.replace(/@guardiapp\.app$/, '');
  const roleRes = await fetch(
    `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(callerUsername)}&activo=eq.true&select=rol`,
    { headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } }
  );
  const roles = await roleRes.json();
  if (!Array.isArray(roles) || roles[0]?.rol !== 'admin') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden resetear contraseñas.' }) };
  }

  // 3. Obtener auth_user_id desde tabla usuarios
  const uRes = await fetch(
    `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(userEmail)}&select=auth_user_id`,
    { headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` } }
  );
  const uRows = await uRes.json();
  let authUserId = uRows?.[0]?.auth_user_id;

  // Fallback: buscar en auth.users por email via RPC si auth_user_id es null
  if (!authUserId) {
    const rpcRes = await fetch(`${SB_URL}/rest/v1/rpc/get_auth_user_id`, {
      method: 'POST',
      headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: userEmail })
    });
    if (rpcRes.ok) authUserId = await rpcRes.json();
  }

  if (!authUserId) {
    return { statusCode: 404, body: JSON.stringify({ error: `Usuario no encontrado en auth: ${userEmail}` }) };
  }

  // 4. Actualizar la contraseña
  const updateRes = await fetch(`${SB_URL}/auth/v1/admin/users/${authUserId}`, {
    method: 'PUT',
    headers: {
      apikey: SVC_KEY,
      Authorization: `Bearer ${SVC_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password: newPassword })
  });
  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    return { statusCode: 400, body: JSON.stringify({ error: err.message || 'Error al actualizar contraseña.' }) };
  }

  // 5. Actualizar must_change_password en tabla usuarios
  const patch = {};
  if (mustChange !== undefined) patch.must_change_password = mustChange;

  await fetch(`${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(userEmail)}`, {
    method: 'PATCH',
    headers: {
      apikey: SVC_KEY,
      Authorization: `Bearer ${SVC_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(patch)
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
