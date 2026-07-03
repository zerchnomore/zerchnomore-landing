// Cloudflare Pages Function — /click?id=<producto.id>
// Cuenta el clic (si el KV "CLICKS" está vinculado) y redirige 302 al link de afiliado REAL
// del producto (sacado de products.json, nunca de input del usuario → sin open-redirect).
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const home = url.origin + '/';
  if (!id) return Response.redirect(home, 302);

  // destino = link real del producto desde products.json
  let dest = null;
  try {
    const res = await fetch(url.origin + '/products.json', { cf: { cacheTtl: 300, cacheEverything: true } });
    if (res.ok) {
      const data = await res.json();
      const arr = Array.isArray(data) ? data : (data.productos || []);
      const p = arr.find(x => x.id === id);
      if (p && typeof p.link === 'string' && p.link.startsWith('https://')) dest = p.link;
    }
  } catch (_) { /* noop */ }
  if (!dest) return Response.redirect(home, 302);

  // contar solo si el KV está vinculado (si no, igual redirige)
  if (env && env.CLICKS) {
    try {
      const k = 'clicks:' + id;
      const n = parseInt((await env.CLICKS.get(k)) || '0', 10) || 0;
      await env.CLICKS.put(k, String(n + 1));
      const dkey = 'day:' + new Date().toISOString().slice(0, 10);
      const dn = parseInt((await env.CLICKS.get(dkey)) || '0', 10) || 0;
      await env.CLICKS.put(dkey, String(dn + 1));
    } catch (_) { /* noop */ }
  }
  return Response.redirect(dest, 302);
}
