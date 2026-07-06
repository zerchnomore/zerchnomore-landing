// /comprar?prod=<slug> — crea una preferencia de Mercado Pago y redirige al checkout.
// El precio y el producto se validan server-side desde este catálogo (no del cliente).
const CATALOG = {
  'compra-con-ia':     { title: 'Compra con IA',                 price: 9990 },
  'ahorra-con-ia':     { title: 'Ahorra con IA',                 price: 9990 },
  'vende-con-ia':      { title: 'Vende con IA',                  price: 9990 },
  'busca-pega-con-ia': { title: 'Busca Pega con IA',             price: 9990 },
  'emprende-con-ia':   { title: 'Emprende con IA',               price: 9990 },
  'suite-con-ia':      { title: 'Suite con IA — los 5 + Kit',    price: 29990 },
};

function page(title, msg) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Zerch No More</title>
<body style="background:#0a0a0a;color:#F5F5F5;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;text-align:center">
<div style="max-width:460px;padding:2rem"><h1 style="color:#B7FF2A">${title}</h1><p style="color:#b0b0b0;line-height:1.6">${msg}</p>
<a href="/guias/" style="color:#B7FF2A;font-weight:800">← Volver a las guías</a></div></body>`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const prod = url.searchParams.get('prod');
  const item = CATALOG[prod];
  const H = { 'content-type': 'text/html; charset=utf-8' };

  if (!item) return Response.redirect(url.origin + '/guias/', 302);
  if (!env.MP_ACCESS_TOKEN) {
    return new Response(page('Checkout en configuración', 'El pago con Mercado Pago se activa en breve. Vuelve muy pronto.'), { headers: H });
  }

  const pref = {
    items: [{
      title: 'Zerch No More · ' + item.title,
      quantity: 1,
      unit_price: item.price,
      currency_id: 'CLP',
    }],
    external_reference: prod,
    back_urls: {
      success: url.origin + '/gracias',
      pending: url.origin + '/gracias',
      failure: url.origin + '/guias/?pago=fallo',
    },
    auto_return: 'approved',
    statement_descriptor: 'ZERCHNOMORE',
  };

  try {
    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(pref),
    });
    const data = await res.json();
    if (data && data.init_point) return Response.redirect(data.init_point, 302);
    return new Response(page('No se pudo iniciar el pago', 'Intenta de nuevo en un momento. Si sigue, escríbenos a zerchnomore@gmail.com.'), { status: 502, headers: H });
  } catch (_) {
    return new Response(page('No se pudo iniciar el pago', 'Hubo un problema de conexión con Mercado Pago. Intenta otra vez.'), { status: 502, headers: H });
  }
}
