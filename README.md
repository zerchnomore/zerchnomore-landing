# zerchnomore.app — Landing oficial ZERCH NO MORE

Landing estática auto-actualizada por el pipeline de ZERCH. Cada vez que ZERCH publica un producto en Instagram, el pipeline también lo agrega acá automáticamente.

## Stack

- **HTML + Tailwind CSS** (CDN, sin build)
- **JavaScript vanilla** que lee `products.json` y renderiza
- **Hosting:** Cloudflare Pages (free tier)
- **DNS:** Porkbun → Cloudflare nameservers
- **Dominio:** `zerchnomore.app` (Porkbun)

## Estructura

```
zerchnomore-landing/
├── index.html          ← Landing principal
├── app.js              ← Renderiza productos desde products.json
├── products.json       ← Base de datos (productos publicados)
├── _redirects          ← Cloudflare Pages routes
├── _headers            ← Cloudflare Pages cache headers
└── .gitignore
```

## Deploy inicial (una vez)

### 1. Crear repo en GitHub
```bash
cd ~/Documents/zerchnomore-landing
git init
git add .
git commit -m "Initial landing for zerchnomore.app"
gh repo create zerchnomore-landing --public --source=. --push
# o manualmente: crear repo en github.com, después git push
```

### 2. Conectar Cloudflare Pages
1. Andá a [dash.cloudflare.com](https://dash.cloudflare.com) → Pages → Create project
2. Conectá tu cuenta GitHub
3. Seleccioná repo `zerchnomore-landing`
4. Build settings:
   - **Framework preset:** None
   - **Build command:** (vacío)
   - **Build output directory:** `/`
5. Deploy

Cloudflare te da un URL temporal: `zerchnomore-landing.pages.dev`

### 3. Configurar dominio propio
1. En Cloudflare Pages → tu proyecto → Custom domains → Add custom domain
2. Ingresar `zerchnomore.app`
3. Cloudflare te dará 2 nameservers (ej `xxx.ns.cloudflare.com`)
4. En Porkbun:
   - Andá a tu dominio `zerchnomore.app`
   - Cambiar nameservers (NS) por los que te dio Cloudflare
   - Guardar
5. Propagación: 5-15 minutos

Después `https://zerchnomore.app` apunta a tu landing con SSL automático.

## Actualización automática (cuando ZERCH publica un producto)

El pipeline `~/Documents/zerch-content-pipeline/src/pipeline.js` puede encadenarse con `update-landing.js`:

```bash
node src/pipeline.js "URL_ML" | node src/update-landing.js
```

Eso:
1. Scrape ML
2. Genera carrusel + reel
3. Sube a Cloudinary
4. **Agrega producto a products.json**
5. **Git commit + push**
6. Cloudflare detecta el push y redeploya en ~30s

Total: ~40 segundos desde URL ML hasta producto live en `zerchnomore.app`.

## Estructura de products.json

```json
{
  "metadata": {
    "site": "ZERCH NO MORE",
    "url": "https://zerchnomore.app",
    "instagram": "@zerch_nomore",
    "last_updated": "ISO timestamp"
  },
  "productos": [
    {
      "id": "MLC123...",
      "titulo": "...",
      "precio": 14938,
      "precio_original": 18675,
      "descuento": "20%",
      "moneda": "CLP",
      "rating": 4.5,
      "reviews_count": 1702,
      "vendidos": "+5mil",
      "imagen": "https://res.cloudinary.com/...",
      "link": "https://www.mercadolibre.cl/...",
      "categoria_id": "hogar",
      "categoria_label": "🏠 HOGAR",
      "fecha_publicacion": "ISO timestamp",
      "instagram_post_id": "..."
    }
  ]
}
```

## Categorías

| ID | Label | Keywords detectados automáticamente |
|---|---|---|
| `tech` | 📱 TECH | audifono, parlante, tablet, notebook, celular, cargador |
| `herramientas` | 🔧 HERRAMIENTAS | linterna, generador, taladro, sierra, faena, minera |
| `hogar` | 🏠 HOGAR | (default — manguera, plastificadora, cocina, etc) |
| `outdoor` | 🌲 OUTDOOR | camping, caza, carpa, chaqueta, starlink |
| `cursos` | 📚 CURSOS | curso, coursera, edx, udemy, aprender |

## Edición manual de productos

Si necesitás corregir un producto manualmente:
1. Editar `products.json`
2. `git add . && git commit -m "..." && git push`
3. Cloudflare redeploya en ~30s

## Analytics

Cloudflare Pages incluye Web Analytics gratis (sin cookies, sin GDPR):
- Page views
- Top pages
- Referrers
- Geographic data

Activar en: dashboard Cloudflare → tu proyecto → Analytics & Logs

## Tracking de clicks de afiliado

`app.js` incluye `trackClick()` que dispara un beacon a `/click` antes de cada redirect. Para activar:
1. Crear Cloudflare Worker que reciba POSTs en `/click`
2. Registra en KV o D1 (también gratis)
3. Dashboard de clicks por producto

Pendiente de implementar (fase 2). Por ahora la landing funciona sin tracking.
