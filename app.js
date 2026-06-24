/**
 * app.js — Renderiza productos desde products.json en la landing de ZERCH NO MORE.
 *
 * Lee /products.json (sin caché para que siempre traiga lo último de Cloudflare)
 * y renderiza:
 *   - Featured product (último hallazgo)
 *   - Navegación de categorías con conteo
 *   - Grid de todos los productos
 *
 * Tracking de clicks:
 *   Cada click en "COMPRA AQUÍ" registra al endpoint /click (Cloudflare Worker)
 *   antes de redireccionar al link de afiliado.
 */

const CATEGORIES = [
  { id: 'tech',         label: '📱 TECH' },
  { id: 'herramientas', label: '🔧 HERRAMIENTAS' },
  { id: 'hogar',        label: '🏠 HOGAR' },
  { id: 'outdoor',      label: '🌲 OUTDOOR' },
  { id: 'jardin',       label: '🌿 JARDÍN' },
  { id: 'cursos',       label: '📚 CURSOS' }
];

const PRODUCTS_URL = `/products.json?t=${Date.now()}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPrice(precio, moneda) {
  if (!precio) return '';
  if (moneda === 'CLP') return '$' + precio.toLocaleString('es-CL');
  return precio.toLocaleString();
}

/**
 * Descuento VALIDADO: solo se muestra si precio_original existe y es mayor
 * que el precio actual (hay datos con descuentos inconsistentes en la fuente).
 * Se calcula desde los precios, no desde el string `descuento`.
 */
function validDeal(p) {
  if (!p.precio || !p.precio_original || p.precio_original <= p.precio) return null;
  return Math.round((1 - p.precio / p.precio_original) * 100);
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

function productUrl(p) {
  return `/producto/${p.slug || slugify(p.titulo) || p.id}/`;
}

function trackClick(productId, link) {
  // Fire-and-forget — no esperamos respuesta para no demorar el redirect
  try {
    navigator.sendBeacon?.('/click', JSON.stringify({
      product_id: productId,
      link,
      timestamp: Date.now()
    }));
  } catch (_) { /* silently ignore */ }
}

function handleProductClick(event, productId, link) {
  trackClick(productId, link);
  // Dejamos que el browser navegue normalmente
}

// ─── Renderizado ──────────────────────────────────────────────────────────────

function renderFeatured(producto) {
  const container = document.getElementById('featured-product');
  if (!producto) {
    container.innerHTML = `
      <div class="text-center py-12 text-zerch-gray">
        <p>Primer hallazgo cargando pronto...</p>
        <p class="text-xs mt-2 text-zerch-dim">Visita @zerch_nomore mientras tanto.</p>
      </div>`;
    return;
  }

  const precioFmt = formatPrice(producto.precio, producto.moneda);
  const dealPct = validDeal(producto);
  const precioOrigFmt = dealPct ? formatPrice(producto.precio_original, producto.moneda) : null;

  container.innerHTML = `
    <div class="bg-zerch-char rounded-xl overflow-hidden border border-zinc-800">
      <div class="aspect-square bg-black flex items-center justify-center overflow-hidden">
        <img src="${escapeHtml(producto.imagen)}" alt="${escapeHtml(producto.titulo)}"
             class="w-full h-full object-contain" loading="eager">
      </div>
      <div class="p-6 md:p-8">
        <h3 class="text-xl md:text-2xl font-black text-zerch-white mb-3 leading-tight">
          ${escapeHtml(producto.titulo)}
        </h3>
        <div class="flex items-baseline gap-3 mb-3">
          ${dealPct ? `<span class="bg-zerch-lime text-black text-xs font-black px-2 py-1 tracking-widest">${dealPct}% OFF</span>` : ''}
          <span class="text-3xl md:text-4xl font-black text-zerch-lime">${precioFmt}</span>
          ${precioOrigFmt ? `<span class="text-zerch-dim line-through text-lg">${precioOrigFmt}</span>` : ''}
        </div>
        ${(producto.rating && producto.reviews_count > 0) ? `
          <p class="text-zerch-gray text-sm mb-6">
            ★ ${producto.rating.toFixed(1)} · ${producto.reviews_count.toLocaleString('es-CL')} reviews · ${escapeHtml(producto.vendidos || 'bestseller')}
          </p>` : (producto.vendidos ? `<p class="text-zerch-gray text-sm mb-6">${escapeHtml(producto.vendidos)}</p>` : '<div class="mb-6"></div>')}
        <a href="${escapeHtml(producto.link)}" target="_blank" rel="noopener nofollow sponsored"
           onclick="handleProductClick(event, '${escapeHtml(producto.id)}', '${escapeHtml(producto.link)}')"
           class="btn-cta block w-full py-5 rounded-full text-center text-lg">
          COMPRA AQUÍ →
        </a>
        <p class="text-zerch-dim text-xs text-center mt-3">
          Te lleva directo a ${escapeHtml(producto.source_label || 'la tienda')} · #publicidad ·
          <a href="${productUrl(producto)}" class="text-zerch-lime hover:underline">ver ficha completa</a>
        </p>
      </div>
    </div>
  `;
}

function renderCategoriesNav(productos) {
  const nav = document.getElementById('categories-nav');
  const counts = {};
  CATEGORIES.forEach(c => counts[c.id] = 0);
  productos.forEach(p => {
    if (counts[p.categoria_id] !== undefined) counts[p.categoria_id]++;
  });

  nav.innerHTML = CATEGORIES.filter(c => counts[c.id] > 0).map(c => `
    <button onclick="filterByCategory('${c.id}')"
            data-cat="${c.id}"
            class="cat-btn bg-zerch-char border border-zinc-800 px-4 py-2 rounded-full text-sm font-bold hover:border-zerch-lime hover:text-zerch-lime transition-all">
      ${c.label} <span class="text-zerch-dim">(${counts[c.id]})</span>
    </button>
  `).join('') + `
    <button onclick="filterByCategory('all')"
            data-cat="all"
            class="cat-btn bg-zerch-lime text-black px-4 py-2 rounded-full text-sm font-black">
      VER TODO (${productos.length})
    </button>
  `;
}

function renderProductsList(productos, filter = 'all') {
  const list = document.getElementById('products-list');
  const filtered = filter === 'all'
    ? productos
    : productos.filter(p => p.categoria_id === filter);

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="col-span-full text-center py-12 text-zerch-gray">
        <p>Sin productos en esta categoría todavía.</p>
        <p class="text-xs mt-2 text-zerch-dim">Vienen más pronto. Síguenos en @zerch_nomore.</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(p => {
    const dealPct = validDeal(p);
    return `
    <a href="${productUrl(p)}"
       class="product-card block bg-zerch-char rounded-xl overflow-hidden border border-zinc-800 hover:border-zerch-lime">
      <div class="aspect-square bg-black flex items-center justify-center overflow-hidden">
        <img src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.titulo)}"
             class="w-full h-full object-contain" loading="lazy">
      </div>
      <div class="p-4">
        <h4 class="text-zerch-white font-bold text-sm mb-2 line-clamp-2 leading-tight" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
          ${escapeHtml(p.titulo)}
        </h4>
        <div class="flex items-baseline justify-between">
          <span class="text-zerch-lime font-black text-lg">${formatPrice(p.precio, p.moneda)}</span>
          ${dealPct ? `<span class="bg-zerch-lime text-black text-xs font-black px-2 py-0.5">${dealPct}% OFF</span>` : ''}
        </div>
        ${(p.rating && p.reviews_count > 0) ? `<p class="text-zerch-dim text-xs mt-2">★ ${p.rating.toFixed(1)} · ${p.reviews_count.toLocaleString('es-CL')} reviews</p>` : ''}
      </div>
    </a>`;
  }).join('');
}

// Expongo globalmente para los onclick inline
let _allProducts = [];

window.filterByCategory = function(catId) {
  renderProductsList(_allProducts, catId);
  document.querySelectorAll('.cat-btn').forEach(btn => {
    if (btn.dataset.cat === catId) {
      btn.classList.add('bg-zerch-lime', 'text-black');
      btn.classList.remove('bg-zerch-char', 'border', 'border-zinc-800');
    } else {
      btn.classList.remove('bg-zerch-lime', 'text-black');
      btn.classList.add('bg-zerch-char', 'border', 'border-zinc-800');
    }
  });
};

window.handleProductClick = handleProductClick;

// ─── Boot ────────────────────────────────────────────────────────────────────

async function boot() {
  try {
    const res = await fetch(PRODUCTS_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    _allProducts = (data.productos || []).sort((a, b) => {
      // Más nuevos primero
      return new Date(b.fecha_publicacion || 0) - new Date(a.fecha_publicacion || 0);
    });

    // Featured = el más reciente
    renderFeatured(_allProducts[0]);
    renderCategoriesNav(_allProducts);
    renderProductsList(_allProducts);

  } catch (err) {
    console.error('Error cargando products.json:', err);
    document.getElementById('featured-product').innerHTML = `
      <div class="text-center py-12 text-zerch-gray">
        <p>Error cargando productos. Intentá refrescar.</p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', boot);
