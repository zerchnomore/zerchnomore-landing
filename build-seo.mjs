#!/usr/bin/env node
/**
 * build-seo.mjs — Genera las páginas estáticas SEO de zerchnomore.app a partir de products.json.
 *
 * Genera:
 *   - producto/<slug>/index.html      (una por producto, con JSON-LD Product)
 *   - categoria/<cat>/index.html      (una por categoría con productos)
 *   - top-hallazgos-zerch-chile/      (página evergreen)
 *   - sitemap.xml, robots.txt, 404.html
 *   - inyecta contenido estático en index.html (entre marcadores SEO:*)
 *   - enriquece products.json con campo `slug` estable
 *
 * Correr:  node build-seo.mjs   (desde la raíz del repo)
 * El pipeline lo corre automáticamente antes de cada commit (update-landing.js).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SITE = 'https://zerchnomore.app';
const TODAY = new Date().toISOString().slice(0, 10);

const CATEGORIES = {
  tech:         { label: '📱 TECH',         nombre: 'Tecnología',   copy: 'tecnología útil para el día a día: audio, almacenamiento, gadgets y accesorios que rinden de verdad' },
  herramientas: { label: '🔧 HERRAMIENTAS', nombre: 'Herramientas', copy: 'herramientas y equipo para faena, taller y pega dura' },
  hogar:        { label: '🏠 HOGAR',        nombre: 'Hogar',        copy: 'cosas para la casa que se usan de verdad, no adornos' },
  outdoor:      { label: '🌲 OUTDOOR',      nombre: 'Outdoor',      copy: 'equipo para camping, pesca, caza y vida al aire libre' },
  jardin:       { label: '🌿 JARDÍN',       nombre: 'Jardín',       copy: 'jardín, terraza y piscina' },
  cursos:       { label: '📚 CURSOS',       nombre: 'Cursos',       copy: 'cursos y capacitación online que valen la plata' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const slugify = s => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 70)
  .replace(/-+$/g, '');

// ─── Slug CORTO para URL memorable (zerchnomore.app/creatina) ────────────────
// Palabras de relleno que NO aportan al nombre corto.
const SHORT_STOP = new Set(['de','la','el','los','las','para','con','por','y','o','a','un','una','del','en','al','x','pack','set','kit','color','negro','blanco','azul','rojo','gris','verde','premium','original','nuevo','nueva']);
// Rutas reservadas del sitio — un slug corto NUNCA puede pisarlas.
const SHORT_RESERVED = new Set(['producto','categoria','top-hallazgos-zerch-chile','health','click','index','404','robots','sitemap','app','build-seo','readme','assets','img','images','static','api']);
// slug SOLO letras a-z (sin acentos, ñ, números ni símbolos) + guiones entre palabras.
const lslug = s => String(s || '')
  .toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z]+/g, '-')
  .replace(/^-+|-+$/g, '');
// Genera un slug corto (2 palabras clave) único. Usa p.short si Zerchy ya lo definió.
function shortSlug(p, taken) {
  let base = p.short ? lslug(p.short) : '';
  if (!base) {
    const words = lslug(p.titulo).split('-').filter(w => w && !SHORT_STOP.has(w));
    base = words.slice(0, 2).join('-');
  }
  base = base || lslug(p.titulo).split('-').filter(Boolean).slice(0, 2).join('-') || lslug(p.id) || 'producto';
  // Dedup SOLO letras: -b, -c, -d…
  let s = base, n = 0;
  while (SHORT_RESERVED.has(s) || taken.has(s)) s = `${base}-${String.fromCharCode(98 + n++)}`;
  taken.add(s);
  return s;
}

const clp = (n, moneda = 'CLP') => !n ? '' : (moneda === 'CLP' ? '$' + n.toLocaleString('es-CL') : n.toLocaleString());

/** Descuento VALIDADO: solo si precio_original existe y es mayor que el precio actual. */
function deal(p) {
  if (!p.precio || !p.precio_original || p.precio_original <= p.precio) return null;
  return Math.round((1 - p.precio / p.precio_original) * 100);
}

const prodUrl = p => `${SITE}/producto/${p.slug}/`;
const catUrl = id => `${SITE}/categoria/${id}/`;

// ─── Shell HTML compartido (mismo look de la home) ───────────────────────────

function shell({ title, description, canonical, jsonld, body, ogImage }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${canonical}">
${ogImage ? `<meta property="og:image" content="${esc(ogImage)}">` : ''}
<meta name="theme-color" content="#0a0a0a">
<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚡</text></svg>">
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = { theme: { extend: { colors: {
    'zerch-bg':'#0a0a0a','zerch-char':'#121212','zerch-lime':'#B7FF2A',
    'zerch-white':'#F5F5F5','zerch-gray':'#B0B0B0','zerch-dim':'#444'
  } } } }
</script>
<style>
  body { background:#0a0a0a; color:#F5F5F5; font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif; }
  .btn-cta { background:#B7FF2A; color:#000; font-weight:900; letter-spacing:0.05em; transition:all .2s; }
  .btn-cta:hover { background:#fff; transform:scale(1.02); }
  .product-card { transition:all .2s ease; }
  .product-card:hover { transform:translateY(-4px); box-shadow:0 20px 40px rgba(183,255,42,.15); }
</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body class="min-h-screen">
<header class="border-b border-zinc-900 py-6 px-6">
  <div class="max-w-3xl mx-auto text-center">
    <a href="/" class="inline-block">
      <span class="block text-3xl font-black tracking-tight">ZERCH <span class="text-zerch-lime">NO MORE</span></span>
    </a>
    <p class="text-zerch-dim text-xs mt-1 tracking-widest">@ZERCH_NOMORE · #PUBLICIDAD</p>
  </div>
</header>
${body}
<footer class="border-t border-zinc-900 py-10 px-6 mt-12">
  <div class="max-w-3xl mx-auto text-center">
    <a href="https://instagram.com/zerch_nomore" target="_blank" rel="noopener" class="inline-block btn-cta px-8 py-4 rounded-full mb-6">📲 SÍGUENOS EN INSTAGRAM →</a>
    <p class="text-zerch-dim text-xs tracking-widest">ZERCH NO MORE © 2026 · Santiago, Chile</p>
    <p class="text-zerch-dim text-xs mt-2">#publicidad · Cumplimiento SERNAC Chile · Todos los links de compra son de afiliado</p>
  </div>
</footer>
<script>
  function zerchTrack(productId, link) {
    try { navigator.sendBeacon && navigator.sendBeacon('/click', JSON.stringify({ product_id: productId, link: link, timestamp: Date.now() })); } catch (_) {}
  }
</script>
</body>
</html>
`;
}

// ─── Tarjeta de producto (estática, linkea a la ficha interna) ───────────────

function card(p) {
  const d = deal(p);
  return `<a href="/producto/${p.slug}/" class="product-card block bg-zerch-char rounded-xl overflow-hidden border border-zinc-800 hover:border-zerch-lime">
  <div class="aspect-square bg-black flex items-center justify-center overflow-hidden">
    <img src="${esc(p.imagen)}" alt="${esc(p.titulo)} — oferta en Chile" class="w-full h-full object-contain" loading="lazy">
  </div>
  <div class="p-4">
    <h3 class="text-zerch-white font-bold text-sm mb-2 leading-tight" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${esc(p.titulo_display || p.titulo)}</h3>
    <div class="flex items-baseline justify-between">
      <span class="text-zerch-lime font-black text-lg">${clp(p.precio, p.moneda)}</span>
      ${d ? `<span class="bg-zerch-lime text-black text-xs font-black px-2 py-0.5">${d}% OFF</span>` : ''}
    </div>
    ${(p.rating && p.reviews_count > 0) ? `<p class="text-zerch-dim text-xs mt-2">★ ${p.rating.toFixed(1)} · ${(p.reviews_count || 0).toLocaleString('es-CL')} reviews</p>` : ''}
  </div>
</a>`;
}

// ─── Página de producto ───────────────────────────────────────────────────────

function productPage(p, all) {
  const d = deal(p);
  const cat = CATEGORIES[p.categoria_id] || CATEGORIES.hogar;
  const fecha = (p.fecha_publicacion || '').slice(0, 10) || TODAY;
  const esAli = p.source === 'aliexpress';
  const tienda = esAli ? 'AliExpress' : (p.source_label || 'la tienda');
  const description = `${p.titulo} a ${clp(p.precio, p.moneda)} en Chile${d ? ` (${d}% bajo su precio normal)` : ''}. Hallazgo de Zerch No More con link directo a ${tienda}.`;

  const jsonld = [{
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.titulo,
    image: p.imagen,
    description,
    ...(p.rating && p.reviews_count > 0 ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.reviews_count }
    } : {}),
    offers: {
      '@type': 'Offer',
      url: prodUrl(p),
      priceCurrency: p.moneda || 'CLP',
      price: String(p.precio),
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: esAli ? 'AliExpress' : `${tienda} Chile` }
    }
  }, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: cat.nombre, item: catUrl(p.categoria_id) },
      { '@type': 'ListItem', position: 3, name: p.titulo, item: prodUrl(p) }
    ]
  }];

  const relacionados = all.filter(x => x.categoria_id === p.categoria_id && x.id !== p.id).slice(0, 3);

  const body = `
<nav class="max-w-3xl mx-auto px-6 pt-6 text-xs text-zerch-dim" aria-label="breadcrumb">
  <a href="/" class="hover:text-zerch-lime">Inicio</a> ›
  <a href="/categoria/${p.categoria_id}/" class="hover:text-zerch-lime">${esc(cat.nombre)}</a> ›
  <span class="text-zerch-gray">${esc(p.titulo_display || p.titulo)}</span>
</nav>
<main class="max-w-3xl mx-auto px-6 py-8">
  <article class="bg-zerch-char rounded-xl overflow-hidden border border-zinc-800">
    <div class="aspect-square bg-black flex items-center justify-center overflow-hidden">
      <img src="${esc(p.imagen)}" alt="${esc(p.titulo)} — precio y oferta en Chile" class="w-full h-full object-contain" loading="eager">
    </div>
    <div class="p-6 md:p-8">
      <h1 class="text-2xl md:text-3xl font-black text-zerch-white mb-4 leading-tight">${esc(p.titulo_display || p.titulo)} en Chile</h1>
      <div class="flex items-baseline gap-3 mb-4 flex-wrap">
        ${d ? `<span class="bg-zerch-lime text-black text-xs font-black px-2 py-1 tracking-widest">${d}% OFF</span>` : ''}
        <span class="text-4xl font-black text-zerch-lime">${clp(p.precio, p.moneda)}</span>
        ${d ? `<span class="text-zerch-dim line-through text-lg">${clp(p.precio_original, p.moneda)}</span>` : ''}
      </div>
      ${(p.rating && p.reviews_count > 0) ? `<p class="text-zerch-gray text-sm mb-4">★ ${p.rating.toFixed(1)} · ${(p.reviews_count || 0).toLocaleString('es-CL')} reviews${p.vendidos ? ` · ${esc(p.vendidos)}` : ''}</p>` : (p.vendidos ? `<p class="text-zerch-gray text-sm mb-4">${esc(p.vendidos)}</p>` : '')}
      <h2 class="text-zerch-lime text-xs font-bold tracking-widest mb-2">POR QUÉ ES UN BUEN HALLAZGO</h2>
      <p class="text-zerch-gray text-sm leading-relaxed mb-6">
        Parte de nuestra selección de ${esc(cat.copy)}. ${esAli ? `Viene de <strong class="text-zerch-white">AliExpress</strong> — envío internacional (suele llegar en 2-4 semanas); lo elegimos por su precio, no por entrega rápida.` : `Verificado en <strong class="text-zerch-white">${esc(tienda)}</strong> Chile, con despacho local.`}
        Precio real de ${clp(p.precio, p.moneda)}${d ? `, un ${d}% menos que su precio normal de ${clp(p.precio_original, p.moneda)}` : ''}${(p.rating && p.reviews_count > 0) ? `, con ${p.rating.toFixed(1)} estrellas de compradores reales` : ''}.
        Sin humo: si está acá, es porque lo publicaríamos igual en nuestro Instagram.
      </p>
      <a href="/click?id=${esc(p.id)}" target="_blank" rel="noopener nofollow sponsored"
         class="btn-cta block w-full py-5 rounded-full text-center text-lg">COMPRA AQUÍ EN ${esc(tienda.toUpperCase())} →</a>
      <p class="text-zerch-dim text-xs text-center mt-3">Link de afiliado · #publicidad · Precio verificado el ${fecha}</p>
    </div>
  </article>
  ${relacionados.length ? `
  <section class="mt-10">
    <h2 class="text-zerch-white text-xs font-bold tracking-widest mb-4">MÁS DE ${esc(cat.nombre.toUpperCase())}</h2>
    <div class="grid md:grid-cols-3 gap-4">${relacionados.map(card).join('\n')}</div>
  </section>` : ''}
  <p class="mt-8 text-center"><a href="/top-hallazgos-zerch-chile/" class="text-zerch-lime text-sm font-bold hover:underline">⚡ Ver los top hallazgos Zerch Chile →</a></p>
</main>`;

  return shell({
    title: `${p.titulo} a ${clp(p.precio, p.moneda)} en Chile | Zerch No More`,
    description, canonical: prodUrl(p), jsonld, body, ogImage: p.imagen
  });
}

// ─── Página de categoría ──────────────────────────────────────────────────────

function categoryPage(catId, items) {
  const cat = CATEGORIES[catId];
  const description = `Ofertas de ${cat.nombre.toLowerCase()} en Chile, verificadas por Zerch No More: ${cat.copy}. Precios reales y links directos.`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Ofertas de ${cat.nombre} en Chile`,
    itemListElement: items.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: prodUrl(p) }))
  };
  const body = `
<main class="max-w-5xl mx-auto px-6 py-10">
  <h1 class="text-3xl font-black text-zerch-white mb-2">${cat.label.replace(/^\S+\s/, '')} — Ofertas de ${esc(cat.nombre)} en Chile</h1>
  <p class="text-zerch-gray text-sm mb-8">Nuestra selección de ${esc(cat.copy)}. Cada producto está verificado: precio real, tienda real, link directo. #publicidad</p>
  <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">${items.map(card).join('\n')}</div>
  <p class="mt-10 text-center"><a href="/" class="text-zerch-lime text-sm font-bold hover:underline">← Ver todas las categorías</a></p>
</main>`;
  return shell({ title: `Ofertas de ${cat.nombre} en Chile | Zerch No More`, description, canonical: catUrl(catId), jsonld, body });
}

// ─── Página evergreen: Top hallazgos Zerch Chile ─────────────────────────────

function evergreenPage(productos) {
  const top = [...productos]
    .sort((a, b) => (deal(b) || 0) - (deal(a) || 0) || (b.rating || 0) - (a.rating || 0))
    .slice(0, 10);
  const description = 'Los mejores hallazgos de ofertas en Chile según Zerch No More: tecnología, hogar, herramientas y outdoor con descuentos reales verificados. Actualizado ' + TODAY + '.';
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Top hallazgos Zerch Chile',
    itemListElement: top.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: prodUrl(p) }))
  };
  const body = `
<main class="max-w-5xl mx-auto px-6 py-10">
  <h1 class="text-3xl md:text-4xl font-black text-zerch-white mb-3">⚡ Top hallazgos Zerch Chile</h1>
  <p class="text-zerch-gray text-sm leading-relaxed mb-2 max-w-3xl">
    Los mejores hallazgos que encontramos para Chile: tecnología útil, cosas para la casa,
    herramientas para la pega y equipo outdoor. Acá no hay descuentos inventados — cada precio sale
    de la ficha real del producto en su tienda (Mercado Libre, con despacho local, o AliExpress, con
    envío internacional), y los descuentos se calculan sobre el precio normal real.
  </p>
  <p class="text-zerch-dim text-xs mb-8">Actualizado: ${TODAY} · #publicidad · links de afiliado</p>
  <h2 class="text-zerch-lime text-xs font-bold tracking-widest mb-4">EL TOP 10 DE HOY (POR DESCUENTO REAL)</h2>
  <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">${top.map(card).join('\n')}</div>
  <h2 class="text-zerch-lime text-xs font-bold tracking-widest mt-12 mb-4">EXPLORA POR CATEGORÍA</h2>
  <div class="flex flex-wrap gap-3">
    ${Object.entries(CATEGORIES).filter(([id]) => productos.some(p => p.categoria_id === id)).map(([id, c]) =>
      `<a href="/categoria/${id}/" class="bg-zerch-char border border-zinc-800 px-4 py-2 rounded-full text-sm font-bold hover:border-zerch-lime hover:text-zerch-lime">${c.label}</a>`).join('\n')}
  </div>
  <section class="mt-12 max-w-3xl">
    <h2 class="text-zerch-white text-lg font-black mb-2">¿Cómo elegimos un hallazgo?</h2>
    <p class="text-zerch-gray text-sm leading-relaxed">
      Tres filtros: que el producto sirva de verdad (lo compraríamos nosotros), que el precio sea
      competitivo hoy en Chile, y que la tienda sea confiable. Publicamos primero en
      <a href="https://instagram.com/zerch_nomore" target="_blank" rel="noopener" class="text-zerch-lime hover:underline">@zerch_nomore</a>
      y cada producto queda acá con su ficha y precio verificado. Somos afiliados: si compras por
      nuestros links, ganamos una comisión sin costo extra para ti. Por eso mismo solo recomendamos
      lo que rinde — vivir de la confianza obliga a no venderte humo.
    </p>
  </section>
</main>`;
  return shell({ title: 'Top hallazgos Zerch Chile: las mejores ofertas verificadas | Zerch No More', description, canonical: `${SITE}/top-hallazgos-zerch-chile/`, jsonld, body });
}

// ─── 404 ──────────────────────────────────────────────────────────────────────

function notFoundPage() {
  const body = `
<main class="max-w-3xl mx-auto px-6 py-24 text-center">
  <h1 class="text-5xl font-black text-zerch-white mb-4">404</h1>
  <p class="text-zerch-gray mb-8">Esa página no existe — pero las ofertas sí.</p>
  <a href="/" class="btn-cta inline-block px-8 py-4 rounded-full">VER LOS HALLAZGOS →</a>
  <p class="mt-6"><a href="/top-hallazgos-zerch-chile/" class="text-zerch-lime text-sm hover:underline">⚡ Top hallazgos Zerch Chile</a></p>
</main>`;
  return shell({ title: 'Página no encontrada | Zerch No More', description: 'Página no encontrada. Mira las ofertas verificadas de Zerch No More en Chile.', canonical: SITE + '/404', body });
}

// ─── Sitemap y robots ─────────────────────────────────────────────────────────

function sitemap(productos, catsConProductos) {
  const url = (loc, lastmod, changefreq, priority) =>
    `  <url>\n    <loc>${loc}</loc>\n${lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : ''}    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  const entries = [
    url(`${SITE}/`, TODAY, 'daily', '1.0'),
    url(`${SITE}/top-hallazgos-zerch-chile/`, TODAY, 'weekly', '0.9'),
    ...catsConProductos.map(c => url(catUrl(c), TODAY, 'weekly', '0.8')),
    ...productos.map(p => url(prodUrl(p), (p.fecha_publicacion || '').slice(0, 10) || TODAY, 'weekly', '0.6')),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
}

const ROBOTS = `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`;

// ─── _redirects: slugs cortos por producto (rewrite 200 → la URL corta se queda) ──
const REDIRECTS_HEADER = `# Cloudflare Pages _redirects — generado por build-seo.mjs (NO editar a mano la sección de productos)
# Health check
/health  /index.html  200

# Click tracking endpoint (Cloudflare Worker)
# /click  https://click-tracker.zerchnomore.workers.dev/track  200
`;
function buildRedirects() {
  // Los slugs cortos ahora son páginas REALES en /<short>/index.html (la URL corta se queda
  // en la barra). _redirects solo mantiene las reglas fijas del sitio.
  return REDIRECTS_HEADER;
}

// ─── Inyección en la home ─────────────────────────────────────────────────────

async function injectHome(productos) {
  const file = path.join(ROOT, 'index.html');
  let html = await fs.readFile(file, 'utf-8');
  const featured = productos[0];
  const d = featured ? deal(featured) : null;

  const featuredHtml = featured ? `
      <div class="bg-zerch-char rounded-xl overflow-hidden border border-zinc-800">
        <div class="aspect-square bg-black flex items-center justify-center overflow-hidden">
          <img src="${esc(featured.imagen)}" alt="${esc(featured.titulo)} — oferta en Chile" class="w-full h-full object-contain" loading="eager">
        </div>
        <div class="p-6 md:p-8">
          <h3 class="text-xl md:text-2xl font-black text-zerch-white mb-3 leading-tight">${esc(featured.titulo)}</h3>
          <div class="flex items-baseline gap-3 mb-6">
            ${d ? `<span class="bg-zerch-lime text-black text-xs font-black px-2 py-1 tracking-widest">${d}% OFF</span>` : ''}
            <span class="text-3xl md:text-4xl font-black text-zerch-lime">${clp(featured.precio, featured.moneda)}</span>
            ${d ? `<span class="text-zerch-dim line-through text-lg">${clp(featured.precio_original, featured.moneda)}</span>` : ''}
          </div>
          <a href="/producto/${featured.slug}/" class="btn-cta block w-full py-5 rounded-full text-center text-lg">VER PRECIO Y LINK →</a>
        </div>
      </div>` : '';

  const gridHtml = productos.slice(0, 9).map(card).join('\n');
  const catsHtml = Object.entries(CATEGORIES)
    .filter(([id]) => productos.some(p => p.categoria_id === id))
    .map(([id, c]) => `<a href="/categoria/${id}/" class="cat-btn bg-zerch-char border border-zinc-800 px-4 py-2 rounded-full text-sm font-bold hover:border-zerch-lime hover:text-zerch-lime">${c.label} (${productos.filter(p => p.categoria_id === id).length})</a>`)
    .join('\n      ') + `\n      <a href="/top-hallazgos-zerch-chile/" class="cat-btn bg-zerch-lime text-black px-4 py-2 rounded-full text-sm font-black">⚡ TOP HALLAZGOS</a>`;

  // OJO: replacer como función — el contenido trae "$2x.xxx" (precios CLP) que
  // String.replace interpretaría como grupos de captura si fuera string.
  const replaceBetween = (src, start, end, content) => {
    const re = new RegExp(`(${start})[\\s\\S]*?(${end})`);
    if (!re.test(src)) throw new Error(`Marcador no encontrado: ${start}`);
    return src.replace(re, (_m, s, e) => `${s}\n${content}\n${e}`);
  };

  html = replaceBetween(html, '<!-- SEO:FEATURED -->', '<!-- /SEO:FEATURED -->', featuredHtml);
  html = replaceBetween(html, '<!-- SEO:CATS -->', '<!-- /SEO:CATS -->', '      ' + catsHtml);
  html = replaceBetween(html, '<!-- SEO:GRID -->', '<!-- /SEO:GRID -->', gridHtml);
  await fs.writeFile(file, html, 'utf-8');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dataFile = path.join(ROOT, 'products.json');
  const data = JSON.parse(await fs.readFile(dataFile, 'utf-8'));
  const productos = data.productos || [];

  // Slugs estables y únicos (se persisten en products.json)
  const seen = new Set();
  for (const p of productos) {
    let slug = p.slug || slugify(p.titulo) || p.id;
    if (seen.has(slug)) slug = `${slug}-${p.id}`.slice(0, 90);
    seen.add(slug);
    p.slug = slug;
  }
  // Slug CORTO único por producto (zerchnomore.app/<short>) — se persiste en products.json
  const takenShort = new Set();
  for (const p of productos) p.short = shortSlug(p, takenShort);
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2) + '\n', 'utf-8');

  // Aviso de datos sospechosos (no bloquea el build)
  for (const p of productos) {
    if (p.precio && p.precio_original && p.precio_original <= p.precio && p.descuento) {
      console.warn(`⚠️  ${p.id} "${p.titulo}": precio (${p.precio}) >= precio_original (${p.precio_original}) — descuento "${p.descuento}" IGNORADO en las páginas.`);
    }
  }

  // Regenerar desde cero los directorios generados
  for (const dir of ['producto', 'categoria', 'top-hallazgos-zerch-chile']) {
    await fs.rm(path.join(ROOT, dir), { recursive: true, force: true });
  }

  // Limpiar páginas de slug corto huérfanas (manifest del build anterior) para no acumular basura
  const manifestFile = path.join(ROOT, '.shorts.json');
  let oldShorts = [];
  try { oldShorts = JSON.parse(await fs.readFile(manifestFile, 'utf-8')); } catch {}
  for (const s of oldShorts) {
    if (s && !SHORT_RESERVED.has(s)) await fs.rm(path.join(ROOT, s), { recursive: true, force: true });
  }

  // Páginas de producto (canónica en /producto/<slug>/ + alias corto en /<short>/)
  for (const p of productos) {
    const html = productPage(p, productos);
    const dir = path.join(ROOT, 'producto', p.slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), html, 'utf-8');
    if (p.short && !SHORT_RESERVED.has(p.short)) {
      const sdir = path.join(ROOT, p.short);
      await fs.mkdir(sdir, { recursive: true });
      await fs.writeFile(path.join(sdir, 'index.html'), html, 'utf-8');
    }
  }
  await fs.writeFile(manifestFile, JSON.stringify(productos.map(p => p.short).filter(Boolean)) + '\n', 'utf-8');

  // Páginas de categoría (solo con productos)
  const catsConProductos = Object.keys(CATEGORIES).filter(id => productos.some(p => p.categoria_id === id));
  for (const catId of catsConProductos) {
    const items = productos.filter(p => p.categoria_id === catId);
    const dir = path.join(ROOT, 'categoria', catId);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), categoryPage(catId, items), 'utf-8');
  }

  // Evergreen
  const evDir = path.join(ROOT, 'top-hallazgos-zerch-chile');
  await fs.mkdir(evDir, { recursive: true });
  await fs.writeFile(path.join(evDir, 'index.html'), evergreenPage(productos), 'utf-8');

  // Sitemap, robots, 404
  await fs.writeFile(path.join(ROOT, 'sitemap.xml'), sitemap(productos, catsConProductos), 'utf-8');
  await fs.writeFile(path.join(ROOT, 'robots.txt'), ROBOTS, 'utf-8');
  await fs.writeFile(path.join(ROOT, '_redirects'), buildRedirects(productos), 'utf-8');
  await fs.writeFile(path.join(ROOT, '404.html'), notFoundPage(), 'utf-8');

  // Home estática
  await injectHome(productos);

  console.log(`✅ SEO build: ${productos.length} productos, ${catsConProductos.length} categorías, evergreen, sitemap (${productos.length + catsConProductos.length + 2} URLs), robots, 404, home.`);
}

main().catch(err => { console.error('❌ build-seo:', err.message); process.exit(1); });
