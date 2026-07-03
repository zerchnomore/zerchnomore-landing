// Cloudflare Pages Function — POST /subscribe  body: {email, web}
// 'web' es honeypot: si viene con contenido, se ignora en silencio (responde ok igual).
// Guarda 'email:<email en minúsculas>' = timestamp ISO en el KV CLICKS. Solo acepta POST.

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function onRequestPost({ request, env }) {
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return json({ ok: false, error: 'cuerpo inválido' }, 400);
  }

  // honeypot: los bots lo llenan → respondemos ok pero no guardamos nada
  const web = typeof body.web === 'string' ? body.web.trim() : '';
  if (web) return json({ ok: true });

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'email inválido' }, 400);
  }

  try {
    if (env && env.CLICKS) {
      await env.CLICKS.put('email:' + email, new Date().toISOString());
    }
  } catch (_) { /* noop */ }
  return json({ ok: true });
}

// cualquier método distinto de POST (onRequestPost tiene precedencia para POST)
export async function onRequest() {
  return json({ ok: false, error: 'método no permitido' }, 405);
}
