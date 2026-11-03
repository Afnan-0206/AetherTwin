# Deploying AetherTwin to Cloudflare Pages

AetherTwin is fully configured to deploy to **Cloudflare Pages** utilizing Cloudflare's ultra-low-latency global edge network and V8 Edge Runtime.

---

## Architecture on Cloudflare

* **Frontend & Interactive 3D Canvas:** Static pre-rendered assets served directly from Cloudflare's global CDN cache.
* **API Endpoints (`/api/segment` & `/api/diagnose`):** Deployed as Cloudflare Workers on the **V8 Edge Runtime** (`runtime = 'edge'`), providing sub-millisecond cold starts and zero Node.js server overhead across 300+ edge data centers.
* **Deterministic Fallback Engine:** If no `MODEL_API_KEY` is provided, AetherTwin automatically operates in client-side **Demo Mode**, executing in-browser optical tracking, RK4 parameter identification, and local rule-based reasoning without any external dependencies.

---

## Method 1: Deploy via Cloudflare Dashboard (Recommended)

1. **Push your repository** to GitHub or GitLab:
   ```bash
   git push origin main
   ```

2. **Log in to Cloudflare Dashboard**:
   - Navigate to **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
   - Select the `AetherTwin` repository.

3. **Configure Build Settings**:
   | Setting | Value |
   | :--- | :--- |
   | **Project Name** | `aethertwin` |
   | **Production Branch** | `main` |
   | **Framework Preset** | `Next.js` |
   | **Build Command** | `npx @cloudflare/next-on-pages` |
   | **Build Output Directory** | `.vercel/output/static` |
   | **Root Directory** | `/` (leave blank) |

4. **Environment Variables**:
   Under **Settings** > **Environment Variables** (Production & Preview):
   | Variable | Value | Notes |
   | :--- | :--- | :--- |
   | `NODE_VERSION` | `20` | Ensures Node 20+ runtime for build step |
   | `MODEL_API_KEY` | `your_meta_api_key_here` | *(Optional)* For live Meta SAM 3.1 & Llama 3.3. If omitted, app safely runs in local deterministic Demo Mode. |

5. **Click "Save and Deploy"**:
   Cloudflare Pages will build the application using `@cloudflare/next-on-pages` and assign your project a `https://aethertwin.pages.dev` URL with automatic SSL and DDoS mitigation.

---

## Method 2: Deploy via Wrangler CLI

You can also deploy directly from your local terminal using Wrangler:

1. **Build the Cloudflare Pages bundle**:
   ```bash
   npx @cloudflare/next-on-pages
   ```

2. **Preview locally using Cloudflare Workerd emulator**:
   ```bash
   npx wrangler pages dev .vercel/output/static
   ```

3. **Deploy directly to Cloudflare Pages**:
   ```bash
   npx wrangler pages deploy .vercel/output/static --project-name=aethertwin
   ```

---

## Configuration Files Overview

* [`wrangler.toml`](../wrangler.toml): Configures `compatibility_date = "2024-09-23"`, `nodejs_compat` flag, and `.vercel/output/static` build output.
* [`next.config.mjs`](../next.config.mjs): Configures modern security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` for webcam video capture).
* [`.npmrc`](../.npmrc): Enables `legacy-peer-deps=true` to prevent dependency conflicts during automated CI/CD builds.

