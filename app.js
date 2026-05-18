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
        <p class="text-xs mt-2 text-zerch-dim">Visitá @zerch_nomore mientras tanto.</p>
      </div>`;
    return;
  }

  const precioFmt = formatPrice(producto.precio, producto.moneda);
  const precioOrigFmt = producto.precio_original ? formatPrice(producto.precio_original, producto.moneda) : null;

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
          ${producto.descuento ? `<span class="bg-zerch-lime text-black text-xs font-black px-2 py-1 tracking-widest">${escapeHtml(producto.descuento.replace(/\\s*OFF\\s*$/i, '').trim())} OFF</span>` : ''}
          <span class="text-3xl md:text-4xl font-black text-zerch-lime">${precioFmt}</span>
          ${precioOrigFmt && producto.precio_original > producto.precio ? `<span class="text-zerch-dim line-through text-lg">${precioOrigFmt}</span>` : ''}
        </div>
        ${producto.rating ? `
          <p class="text-zerch-gray text-sm mb-6">
            ★ ${producto.rating.toFixed(1)} · ${producto.reviews_count?.toLocaleString('es-CL') || 0} reviews · ${escapeHtml(producto.vendidos || 'bestseller')}
          </p>` : '<div class="mb-6"></div>'}
        <a href="${escapeHtml(producto.link)}" target="_blank" rel="noopener nofollow sponsored"
           onclick="handleProductClick(event, '${escapeHtml(producto.id)}', '${escapeHtml(producto.link)}')"
           class="btn-cta block w-full py-5 rounded-full text-center text-lg">
          COMPRA AQUÍ →
        </a>
        <p class="text-zerch-dim text-xs text-center mt-3">
          Te lleva directo a Mercado Libre · #publicidad
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

  nav.innerHTML = CATEGORIES.map(c => `
    <button onclick="filterByCategory('${c.id}')"
            data-cat="${c.id}"
            class="cat-btn bg-zerch-char border border-zinc-800 px-4 py-2 rounded-full text-sm font-bold hover:border-zerch-lime hover:text-zerch-lime transition-all ${counts[c.id] === 0 ? 'opacity-40' : ''}">
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
        <p class="text-xs mt-2 text-zerch-dim">Vienen más pronto. Seguinos en @zerch_nomore.</p>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(p => `
    <a href="${escapeHtml(p.link)}" target="_blank" rel="noopener nofollow sponsored"
       onclick="handleProductClick(event, '${escapeHtml(p.id)}', '${escapeHtml(p.link)}')"
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
          ${p.descuento ? `<span class="bg-zerch-lime text-black text-xs font-black px-2 py-0.5">${escapeHtml(p.descuento.replace(/\\s*OFF\\s*$/i, '').trim())} OFF</span>` : ''}
        </div>
        ${p.rating ? `<p class="text-zerch-dim text-xs mt-2">★ ${p.rating.toFixed(1)} · ${p.reviews_count?.toLocaleString('es-CL') || 0} reviews</p>` : ''}
      </div>
    </a>
  `).join('');
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
