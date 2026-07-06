// TEMPORAL — carga los ZIP de producto al KV (privado). Protegido por ?k=.
// Uso: POST /admin-upload?k=<secreto>&slug=<slug>  con el binario del ZIP como body.
// SE ELIMINA tras subir todos los archivos.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== 'zerch-upload-2026-x7q') return new Response('no autorizado', { status: 401 });
  const slug = url.searchParams.get('slug');
  if (!slug) return new Response('falta slug', { status: 400 });
  if (!(env && env.CLICKS)) return new Response('KV no vinculado', { status: 500 });
  const buf = await request.arrayBuffer();
  if (!buf || buf.byteLength === 0) return new Response('body vacío', { status: 400 });
  await env.CLICKS.put('file:' + slug, buf);
  return new Response(JSON.stringify({ ok: true, slug, bytes: buf.byteLength }), { headers: { 'content-type': 'application/json' } });
}
