// GuardiaApp — Admin Auth migration
// Migra TODOS los auth users que no tienen @guardiapp.app al dominio correcto
// Actualiza también la tabla usuarios para consistencia
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const SB_URL  = process.env.SUPABASE_URL;
  const SVC_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SB_URL || !SVC_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Configuración incompleta.' }) };

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) return { statusCode: 401, body: JSON.stringify({ error: 'No autorizado.' }) };

  // Verificar que el caller es admin
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
    return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores.' }) };
  }

  const results = { migrated: [], skipped: [], errors: [] };

  // Paginar todos los auth users (máx 1000 por página)
  let page = 1;
  let allUsers = [];
  while (true) {
    const listRes = await fetch(`${SB_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, {
      headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` }
    });
    if (!listRes.ok) break;
    const listData = await listRes.json();
    const users = listData?.users || [];
    allUsers = allUsers.concat(users);
    if (users.length < 1000) break;
    page++;
  }

  for (const user of allUsers) {
    const email = user.email || '';
    if (!email) { results.skipped.push({ id: user.id, reason: 'sin email' }); continue; }
    if (email.endsWith('@guardiapp.app')) { results.skipped.push({ email, reason: 'ya correcto' }); continue; }

    const username = email.replace(/@.+$/, '');
    const newEmail = `${username}@guardiapp.app`;

    // Verificar que no exista ya una cuenta @guardiapp.app para este username
    const checkRpc = await fetch(`${SB_URL}/rest/v1/rpc/get_auth_user_id`, {
      method: 'POST',
      headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_email: newEmail })
    });
    const existingId = checkRpc.ok ? await checkRpc.json().catch(() => null) : null;
    if (existingId && existingId !== user.id) {
      // Ya existe un @guardiapp.app distinto — vincular usuarios a ese y borrar el viejo si está huérfano
      await fetch(`${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(username)}`, {
        method: 'PATCH',
        headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ auth_user_id: existingId })
      });
      results.skipped.push({ email, reason: `cuenta @guardiapp.app ya existe (${existingId})` });
      continue;
    }

    // Migrar: cambiar email del auth user al dominio @guardiapp.app
    const patchRes = await fetch(`${SB_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, email_confirm: true })
    });

    if (!patchRes.ok) {
      const err = await patchRes.json().catch(() => ({}));
      results.errors.push({ email, error: err.message || patchRes.status });
      continue;
    }

    // Actualizar tabla usuarios: limpiar dominio del email y asegurar auth_user_id
    // Intentar por email completo original primero, luego por username
    const patchUsr1 = await fetch(
      `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(email)}`,
      { method: 'PATCH', headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ email: username, auth_user_id: user.id }) }
    );
    if (!patchUsr1.ok || patchUsr1.status === 204) {
      // Si no encontró por email completo, intentar por username
      await fetch(
        `${SB_URL}/rest/v1/usuarios?email=eq.${encodeURIComponent(username)}`,
        { method: 'PATCH', headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ auth_user_id: user.id }) }
      );
    }

    results.migrated.push({ from: email, to: newEmail });
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      total: allUsers.length,
      migrated: results.migrated.length,
      skipped: results.skipped.length,
      errors: results.errors.length,
      detail: results
    })
  };
};
