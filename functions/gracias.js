// /gracias — Mercado Pago redirige acá tras el pago (con payment_id + external_reference).
// Verifica el pago server-side y muestra el botón de descarga si está aprobado.
const CATALOG = {
  'compra-con-ia':     { title: 'Compra con IA' },
  'ahorra-con-ia':     { title: 'Ahorra con IA' },
  'vende-con-ia':      { title: 'Vende con IA' },
  'busca-pega-con-ia': { title: 'Busca Pega con IA' },
  'emprende-con-ia':   { title: 'Emprende con IA' },
  'suite-con-ia':      { title: 'Suite con IA — los 5 + Kit' },
};

function shell(inner) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Gracias · Zerch No More</title>
<style>body{background:#0a0a0a;color:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:520px;padding:2.5rem;text-align:center}h1{color:#B7FF2A;font-size:1.7rem;margin-bottom:.5rem}
.btn{display:inline-block;background:#B7FF2A;color:#000;font-weight:900;letter-spacing:.04em;padding:1rem 2rem;border-radius:999px;text-decoration:none;margin-top:1.2rem;font-size:1.05rem}
.dim{color:#b0b0b0;line-height:1.7}a.link{color:#B7FF2A}</style></head>
<body><div class="card">${inner}</div></body></html>`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const H = { 'content-type': 'text/html; charset=utf-8' };
  const paymentId = url.searchParams.get('payment_id') || url.searchParams.get('collection_id');
  const status = url.searchParams.get('status') || url.searchParams.get('collection_status');

  if (!env.MP_ACCESS_TOKEN || !paymentId || paymentId === 'null') {
    return new Response(shell(`<h1>Procesando…</h1><p class="dim">Si ya pagaste y no ves tu descarga, escríbenos a <a class="link" href="mailto:zerchnomore@gmail.com">zerchnomore@gmail.com</a> con tu comprobante.</p><a class="link" href="/guias/">← Volver a las guías</a>`), { headers: H });
  }

  let pay;
  try {
    const res = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId), {
      headers: { Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN },
    });
    pay = await res.json();
  } catch (_) {
    return new Response(shell(`<h1>Verificando tu pago…</h1><p class="dim">Recarga esta página en unos segundos. Si no aparece, escríbenos a <a class="link" href="mailto:zerchnomore@gmail.com">zerchnomore@gmail.com</a>.</p>`), { headers: H });
  }

  const prod = pay && pay.external_reference;
  const item = CATALOG[prod];

  if (pay && pay.status === 'approved' && item) {
    return new Response(shell(`<h1>✅ ¡Listo, gracias por tu compra!</h1>
<p class="dim">Tu <strong>${item.title}</strong> está listo para descargar. El link también sirve si necesitas bajarlo de nuevo.</p>
<a class="btn" href="/descargar?prod=${encodeURIComponent(prod)}&payment_id=${encodeURIComponent(paymentId)}">⬇ Descargar mi guía</a>
<p class="dim" style="margin-top:1.5rem;font-size:.9rem">¿Problemas con la descarga? Escríbenos a <a class="link" href="mailto:zerchnomore@gmail.com">zerchnomore@gmail.com</a></p>`), { headers: H });
  }

  if (pay && (pay.status === 'pending' || pay.status === 'in_process')) {
    return new Response(shell(`<h1>⏳ Tu pago está en proceso</h1><p class="dim">Algunos medios (como transferencia) tardan un poco en confirmarse. Apenas se apruebe, vuelve a esta página o escríbenos y te enviamos el archivo.</p><a class="link" href="/guias/">← Volver a las guías</a>`), { headers: H });
  }

  return new Response(shell(`<h1>El pago no se completó</h1><p class="dim">No se concretó el pago, así que no se hizo ningún cobro. Puedes intentarlo de nuevo.</p><a class="btn" href="/guias/">Volver a las guías</a>`), { headers: H });
}
