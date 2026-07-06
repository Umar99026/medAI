# medAI Web App

GP notes + AI referral triage platform.

## Features

- **Sign up**: choose GP or Specialist; specialists pick from 30+ specialties
- **GP**: write notes or upload a letter (.txt / .pdf), save, refer
- **Refer flow**: AI picks specialist type → shows matching specialists (demo + real accounts) → full extraction + urgency sent on refer
- **Specialist**: inbound referrals (structured fields, urgency color-coded), filter by date/urgency, **Book patient** placeholder

## Quick start

```bash
cd web
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`

Add your Gemini key in `web/.env`:

```env
GEMINI_API_KEY="your_key"
```

### Demo logins

| Role | Email | Password |
|------|-------|----------|
| GP | gp@medai.local | password123 |
| Cardiology (real account) | cardio@medai.local | password123 |
| Dermatology (real account) | derm@medai.local | password123 |

Create new accounts via **Create account** on the login page.

## Workflow

1. GP writes note or uploads letter → **Save**
2. **Refer** → AI suggests specialty type → pick specialist → AI extracts structured data + urgency → specialist notified
3. Specialist opens **Referrals** → reviews structured referral → **Book patient** (placeholder)
