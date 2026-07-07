# medAI Web App

GP notes + AI referral triage platform.

## Features

- **Sign up**: choose GP or Specialist; specialists pick from 30+ specialties
- **GP**: write notes or upload a letter (.txt / .pdf), save, refer
- **Refer flow**: AI picks specialist type → shows matching specialists (demo + real accounts) → full extraction + urgency sent on refer
- **Specialist**: inbound referrals (structured fields, urgency color-coded), filter by date/urgency, **Book patient** placeholder

## Local development

```bash
cd web
npm install
cp .env.example .env
# Optional: add GEMINI_API_KEY to .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`

Local dev uses a SQLite file (`dev.db`) on disk. Cloudflare production uses **D1** (SQLite-compatible, managed by Cloudflare).

### Demo logins

| Role | Email | Password |
|------|-------|----------|
| GP | gp@medai.local | password123 |
| Cardiology (real account) | cardio@medai.local | password123 |
| Dermatology (real account) | derm@medai.local | password123 |

Create new accounts via **Create account** on the login page.

## Deploy to Cloudflare

The app deploys as a **Cloudflare Worker** (via [OpenNext](https://opennext.js.org/cloudflare)) with a **D1 database**.

### 1. Prerequisites

- [Cloudflare account](https://dash.cloudflare.com/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (included as a dev dependency)
- Gemini API key

### 2. Log in to Cloudflare

```bash
cd web
npx wrangler login
```

### 3. Create the D1 database

```bash
npx wrangler d1 create medai-db
```

Copy the `database_id` from the output and paste it into `wrangler.jsonc`, replacing `REPLACE_AFTER_WRANGLER_D1_CREATE`.

### 4. Run database migrations

Apply the schema to your remote D1 database:

```bash
npm run db:migrate:d1
```

To test migrations locally first (Workers runtime preview):

```bash
npm run db:migrate:d1:local
```

### 5. Set secrets

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put GEMINI_API_KEY
```

Use a long random string for `JWT_SECRET` in production.

### 6. Seed demo data (optional)

After migrations, seed demo users on the **remote** D1 database:

```bash
# Uses local SQLite seed script — for remote D1, create accounts via the app's sign-up page,
# or run seed against local preview DB first:
npm run db:seed
npm run preview
```

For production, the easiest path is to **sign up** through the deployed app, or run `npm run db:seed` while pointed at a local D1 preview (`npm run preview` uses local D1 bindings).

### 7. Deploy

```bash
npm run deploy
```

Wrangler prints your live URL (e.g. `https://medai.<your-subdomain>.workers.dev`).

### Cloudflare Pages / Workers Builds (GitHub)

If you connect this repo in the Cloudflare dashboard, set **Root directory** to `web` (not the repo root).

| Setting | Value |
|---------|--------|
| Root directory | `web` |
| Framework preset | None |
| Build command | `npm ci && npx opennextjs-cloudflare build` |
| Deploy command | `npx opennextjs-cloudflare deploy` |
| Build output directory | `.open-next` |

Set `CLOUDFLARE_API_TOKEN` in the build environment. Configure D1 bindings and secrets (`JWT_SECRET`, `GEMINI_API_KEY`) as in `wrangler.jsonc`.

> **Windows note:** OpenNext needs symlink support. If `npm run deploy` fails with `EPERM: symlink`, either enable [Developer Mode](https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development) in Windows Settings, or run deploy from [WSL](https://learn.microsoft.com/en-us/windows/wsl/install). Cloudflare’s GitHub integration also works without local symlinks.

### 8. Preview before deploying

Test the app in the Cloudflare Workers runtime locally:

```bash
npm run preview
```

## Environment variables

| Variable | Local (`.env`) | Cloudflare |
|----------|----------------|------------|
| `DATABASE_URL` | `file:./dev.db` | Not needed — uses D1 binding |
| `JWT_SECRET` | Required | Wrangler secret |
| `GEMINI_API_KEY` | Optional (AI features) | Wrangler secret |

## Workflow

1. GP writes note or uploads letter → **Save**
2. **Refer** → AI suggests specialty type → pick specialist → AI extracts structured data + urgency → specialist notified
3. Specialist opens **Referrals** → reviews structured referral → **Book patient** (placeholder)

## Architecture on Cloudflare

```
Browser → Cloudflare Worker (Next.js via OpenNext)
              ↓
         D1 database (SQLite)
              ↓
         Gemini API (triage / extraction)
```

Local `npm run dev` still uses a file-based SQLite database. Production uses D1 automatically via the `DB` binding in `wrangler.jsonc`.
