# Workout Planner

Offline-first PWA for workout plans, logging, and progress tracking.

## Setup

1. Install dependencies

```bash
npm install
```

2. Configure Supabase

Create `.env` with:

```bash
VITE_SUPABASE_URL="your-url"
VITE_SUPABASE_ANON_KEY="your-anon-key"
```

3. Create the Supabase tables

Run `supabase_schema.sql` in the Supabase SQL editor.

4. Start the app

```bash
npm run dev
```

## Notes

- The initial monthly plans are imported from `src/data/plan_import.json` on first run.
- Use the Account page to create/sign-in and then click `Sync Now`.
