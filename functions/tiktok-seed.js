// TEMPORAL — siembra la cola de TikTok en el KV. Protegido por ?k=. Se elimina tras usar.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== 'zerch-tiktok-2026-q9f') return new Response('no autorizado', { status: 401 });
  if (!(env && env.CLICKS)) return new Response('KV no vinculado', { status: 500 });
  const body = await request.text();
  let queue;
  try { queue = JSON.parse(body); } catch (_) { return new Response('JSON inválido', { status: 400 }); }
  if (!Array.isArray(queue)) return new Response('debe ser un array', { status: 400 });
  await env.CLICKS.put('tiktok:queue', JSON.stringify(queue));
  return new Response(JSON.stringify({ ok: true, total: queue.length }), { headers: { 'content-type': 'application/json' } });
}
