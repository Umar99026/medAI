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
