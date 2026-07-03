// Cloudflare Pages Function — /stats?k=zerchstats  → ranking de clicks por producto (lee del KV).
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== 'zerchstats') return new Response('no autorizado', { status: 401 });
  const H = { 'content-type': 'text/html; charset=utf-8' };
  if (!(env && env.CLICKS)) {
    return new Response('<meta charset=utf-8><p style="font-family:system-ui">El KV <b>CLICKS</b> aún no está vinculado. Cloudflare → Pages → tu proyecto → Settings → Functions → KV namespace bindings → variable <code>CLICKS</code>.</p>', { headers: H });
  }
  const rows = [];
  let day = 0;
  try {
    const list = await env.CLICKS.list({ prefix: 'clicks:' });
    for (const key of list.keys) {
      const n = parseInt((await env.CLICKS.get(key.name)) || '0', 10) || 0;
      rows.push([key.name.replace('clicks:', ''), n]);
    }
    day = parseInt((await env.CLICKS.get('day:' + new Date().toISOString().slice(0, 10))) || '0', 10) || 0;
  } catch (_) { /* noop */ }
  rows.sort((a, b) => b[1] - a[1]);
  const tr = rows.map(([id, n]) => `<tr><td>${id}</td><td style="text-align:right">${n}</td></tr>`).join('') || '<tr><td colspan=2>Sin clicks aún</td></tr>';
  const html = `<!doctype html><meta charset=utf-8><meta name=robots content=noindex><title>Zerch · clicks</title>
<style>body{font-family:system-ui;background:#0a0a0a;color:#eee;padding:2rem;max-width:640px;margin:auto}
h1{color:#a3e635;font-size:1.3rem}table{border-collapse:collapse;width:100%}td,th{padding:8px 12px;border-bottom:1px solid #2a2a2a}
.small{color:#888;font-size:.85rem}</style>
<h1>Clicks por producto</h1><p class=small>Hoy: ${day} clicks totales · ${rows.length} productos con datos</p>
<table><tr><th style="text-align:left">Producto (id)</th><th style="text-align:right">Clicks</th></tr>${tr}</table>`;
  return new Response(html, { headers: H });
}
