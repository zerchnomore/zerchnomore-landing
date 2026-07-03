// TEMPORAL — limpieza de datos de prueba del KV. Protegido por ?k=zerchstats.
// Restaura la línea base real (3 productos) y borra emails/eventos/clics de testing.
// SE ELIMINA tras usarse una vez.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get("k") !== "zerchstats") return new Response("no autorizado", { status: 401 });
  if (!(env && env.CLICKS)) return new Response(JSON.stringify({ error: "KV no vinculado" }), { status: 500 });
  const done = [];

  // 1. emails de prueba
  for (const e of ["email:test-verificacion@zerch.cl", "email:auditor-verificacion@zerch.cl"]) {
    await env.CLICKS.delete(e); done.push("del " + e);
  }
  // 2. todos los eventos (los actuales son 100% testing de hoy)
  let cursor;
  do {
    const res = await env.CLICKS.list(cursor ? { prefix: "ev:", cursor } : { prefix: "ev:" });
    for (const k of res.keys) { await env.CLICKS.delete(k.name); done.push("del " + k.name); }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  // 3. restaurar línea base real
  await env.CLICKS.put("clicks:melila1HHPgLo", "7"); done.push("set melila1HHPgLo=7");
  // 4. borrar contadores de productos que solo recibieron clics de prueba
  for (const id of ["melila2oiekj2", "melila1jiYk4U", "melila1V27a4L", "melila1tnuMFk"]) {
    await env.CLICKS.delete("clicks:" + id); done.push("del clicks:" + id);
  }
  // 5. resetear contador del día
  const dkey = "day:" + new Date().toISOString().slice(0, 10);
  await env.CLICKS.delete(dkey); done.push("del " + dkey);

  return new Response(JSON.stringify({ ok: true, done }, null, 2), { headers: { "content-type": "application/json" } });
}
