# medAI

Clinical referral platform: GP notes, AI triage, specialist referrals.

## Web app (current)

The main product lives in **`web/`**.

```bash
cd web
npm install
cp .env.example .env
# Optional: add GEMINI_API_KEY to .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000` — see `web/README.md` for demo logins and workflow.

## Deploy to Cloudflare

See **`web/README.md`** — deploy the Next.js app with a Cloudflare D1 database.

### Cloudflare Pages / Workers (Git integration)

The app is **not** a static site or Vite app. It is a **Next.js** full-stack app in **`web/`** (API routes, login, D1 database).

If the build fails with `Could not read package.json` at the repo root, Cloudflare is building the wrong folder. Use:

| Setting | Value |
|---------|--------|
| **Root directory** | `web` |
| **Framework preset** | None |
| **Build command** | `npm ci && npx opennextjs-cloudflare build` |
| **Deploy command** (Workers Builds) | `npx opennextjs-cloudflare deploy` |
| **Build output directory** | `.open-next` |

Alternatively, keep the root directory as `/` and use **Build command**: `npm run build` (this repo’s root `package.json` delegates to `web/`).

Do **not** use Framework preset **Vite** or output directory **`dist`** — this project does not use Vite.

Required Cloudflare secrets/bindings: D1 database `medai-db` (see `web/wrangler.jsonc`), plus `JWT_SECRET` and `GEMINI_API_KEY` as Worker secrets.
