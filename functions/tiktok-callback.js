// Cloudflare Pages Function — /tiktok-callback
// Recibe el redirect de TikTok tras autorizar y MUESTRA el código para copiar.
// No maneja secretos: el intercambio código→token lo hace el script local de Carlo
// (que tiene el client_secret y el code_verifier de PKCE). Este endpoint solo relaya.
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');
  const errDesc = url.searchParams.get('error_description') || '';
  const H = { 'content-type': 'text/html; charset=utf-8' };
  const shell = (inner) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Zerch · TikTok</title>
<style>body{background:#0a0a0a;color:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:560px;padding:2.5rem;text-align:center}h1{color:#B7FF2A;font-size:1.5rem}
input{width:100%;background:#161616;border:1px solid #333;color:#B7FF2A;font-family:monospace;font-size:1rem;padding:.9rem;border-radius:10px;margin:1rem 0;box-sizing:border-box}
button{background:#B7FF2A;color:#000;font-weight:900;border:0;padding:.9rem 1.6rem;border-radius:999px;font-size:1rem;cursor:pointer}
.dim{color:#888;font-size:.9rem;line-height:1.6}</style></head><body><div class="card">${inner}</div></body></html>`;

  if (error) {
    return new Response(shell(`<h1>❌ TikTok rechazó la autorización</h1><p class="dim">${esc(error)}<br>${esc(errDesc)}</p><p class="dim">Vuelve a correr el script en tu terminal.</p>`), { headers: H });
  }
  if (!code) {
    return new Response(shell(`<h1>Esperando autorización…</h1><p class="dim">Esta página recibe el código de TikTok. Si llegaste acá sin autorizar, vuelve a correr el script.</p>`), { headers: H });
  }
  return new Response(shell(`<h1>✅ Autorización recibida</h1>
<p class="dim">Copia este código y pégalo en tu terminal (donde el script te lo pide):</p>
<input id="c" value="${esc(code)}" readonly onclick="this.select()">
<button onclick="document.getElementById('c').select();document.execCommand('copy');this.textContent='¡Copiado!'">Copiar código</button>
<p class="dim" style="margin-top:1.5rem">Luego puedes cerrar esta ventana.</p>`), { headers: H });
}
