// /descargar?prod=<slug>&payment_id=<id> — re-verifica el pago con Mercado Pago
// y solo entonces entrega el ZIP (guardado privado en KV, nunca público).
const FILES = {
  'compra-con-ia':     'Compra-con-IA-ZerchNoMore.zip',
  'ahorra-con-ia':     'Ahorra-con-IA-ZerchNoMore.zip',
  'vende-con-ia':      'Vende-con-IA-ZerchNoMore.zip',
  'busca-pega-con-ia': 'Busca-Pega-con-IA-ZerchNoMore.zip',
  'emprende-con-ia':   'Emprende-con-IA-ZerchNoMore.zip',
  'suite-con-ia':      'Suite-con-IA-ZerchNoMore.zip',
};

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const prod = url.searchParams.get('prod');
  const paymentId = url.searchParams.get('payment_id');
  const filename = FILES[prod];

  if (!filename || !paymentId || !env.MP_ACCESS_TOKEN) {
    return new Response('No autorizado', { status: 403 });
  }

  // Verificar el pago server-side
  let pay;
  try {
    const res = await fetch('https://api.mercadopago.com/v1/payments/' + encodeURIComponent(paymentId), {
      headers: { Authorization: 'Bearer ' + env.MP_ACCESS_TOKEN },
    });
    pay = await res.json();
  } catch (_) {
    return new Response('No se pudo verificar el pago. Intenta de nuevo.', { status: 502 });
  }

  if (!pay || pay.status !== 'approved' || pay.external_reference !== prod) {
    return new Response('Pago no verificado para este producto.', { status: 403 });
  }

  if (!(env && env.CLICKS)) return new Response('Almacenamiento no disponible.', { status: 500 });
  const bytes = await env.CLICKS.get('file:' + prod, 'arrayBuffer');
  if (!bytes) return new Response('El archivo no está disponible. Escríbenos a zerchnomore@gmail.com.', { status: 404 });

  return new Response(bytes, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="' + filename + '"',
      'cache-control': 'private, no-store',
    },
  });
}
