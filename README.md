# Personal Assistant

A voice first assistant: reminders with push notifications, project chats that remember what you tell them, and (soon) Gmail suggestions. Built with Next.js 16, Drizzle on Neon Postgres, Better Auth and the AI SDK. Users bring their own Claude or Gemini key.

The full plan and decisions are in `.claude/plan/plan.md`.

## Run it locally

1. Copy `.env.example` to `.env` and fill it in (see the comments in that file).
2. Install and start:

   ```bash
   pnpm install
   pnpm dev
   ```

3. Open http://localhost:3000.

Without `RESEND_API_KEY`, sign up and password reset links are printed in the terminal instead of emailed.

## Database

Tables come from the Drizzle schema in `db/schema`. To change them:

```bash
pnpm db:generate   # writes a migration from the schema
# read the new SQL file in db/migrations
pnpm db:migrate    # applies it
```

Never use `db:push`. After a schema change, restart `pnpm dev` if the dev server reports a missing column.

## Checks

```bash
pnpm typecheck
pnpm lint
```

Do not run `pnpm build` while `pnpm dev` is running; they share the `.next` folder.

## Scheduled jobs (after deploying)

Create these jobs on cron-job.org (or Vercel Cron):

| Job | Request | Every |
|---|---|---|
| Send due reminders | `POST https://<your domain>/api/cron/reminders` with header `x-cron-secret: <CRON_SECRET>` | 15 minutes, at :00, :15, :30, :45 (`REMINDER_CRON_INTERVAL_MINUTES=15`) |
| Read new Gmail | `POST https://<your domain>/api/cron/gmail-sync` with the same header | 15 minutes, at the same times (`GMAIL_SYNC_INTERVAL_MINUTES=15`) |

Both jobs run at the same minutes on purpose: Neon puts the database to sleep after 5 quiet minutes, and one shared wake up every 15 minutes keeps it inside the free plan's 100 compute hours (about 60 a month). Reminders can arrive up to 15 minutes early, never late.

## Gmail

Each user connects Gmail through **their own** Google app (OAuth client); nothing Google related is in `.env`. In the app: **Settings > Google** has the steps (info icons), the exact Redirect URL to register (`<your domain>/api/gmail/callback`), the Client ID and secret fields, and "Test connection". The secret is stored encrypted with `ENCRYPTION_KEY`. While a Google app is in Testing mode, only its listed test users can connect, and they reconnect every 7 days.

## Deploying to Vercel

- Add Postgres from the Vercel Storage tab (Neon). It sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- Set the Function Region to `iad1`, next to the database.
- Set `BETTER_AUTH_URL` for the Production environment only; previews use their own URL.
- Push notifications need HTTPS, so test them on the deployed site. On iPhone, add the app to the Home Screen first.
