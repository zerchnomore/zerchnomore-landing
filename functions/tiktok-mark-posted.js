// POST /tiktok-mark-posted?k=<secret>&idx=N — marca el item N de la cola como publicado.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== 'zerch-tiktok-2026-q9f') return new Response('no autorizado', { status: 401 });
  const idx = parseInt(url.searchParams.get('idx'), 10);
  if (!(env && env.CLICKS) || Number.isNaN(idx)) return new Response(JSON.stringify({ error: 'faltan datos' }), { status: 400 });

  let queue;
  try {
    queue = JSON.parse((await env.CLICKS.get('tiktok:queue')) || '[]');
  } catch (_) {
    return new Response(JSON.stringify({ error: 'cola corrupta' }), { status: 500 });
  }

  if (!queue[idx]) return new Response(JSON.stringify({ error: 'idx inválido' }), { status: 400 });
  queue[idx].posted = true;
  queue[idx].posted_at = new Date().toISOString();
  await env.CLICKS.put('tiktok:queue', JSON.stringify(queue));

  const restantes = queue.filter(v => !v.posted).length;
  return new Response(JSON.stringify({ ok: true, idx, restantes }), { headers: { 'content-type': 'application/json' } });
}
