// GET /tiktok-next?k=<secret> — devuelve el próximo video pendiente de la cola de TikTok.
// No lo marca publicado (eso lo hace /tiktok-mark-posted tras confirmar el publish real).
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== 'zerch-tiktok-2026-q9f') return new Response('no autorizado', { status: 401 });
  if (!(env && env.CLICKS)) return new Response(JSON.stringify({ error: 'KV no vinculado' }), { status: 500 });

  let queue;
  try {
    queue = JSON.parse((await env.CLICKS.get('tiktok:queue')) || '[]');
  } catch (_) {
    return new Response(JSON.stringify({ error: 'cola corrupta' }), { status: 500 });
  }

  const idx = queue.findIndex(v => !v.posted);
  if (idx < 0) {
    return new Response(JSON.stringify({ done: true, mensaje: 'Cola de TikTok vacía — no quedan videos por publicar.' }), {
      headers: { 'content-type': 'application/json' },
    });
  }

  const item = queue[idx];
  return new Response(JSON.stringify({ idx, video_url: item.video_url, title: item.title, product: item.product, duration_sec: item.duration_sec || 10, restantes: queue.filter(v => !v.posted).length }), {
    headers: { 'content-type': 'application/json' },
  });
}
