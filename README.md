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
| Send due reminders | `POST https://<your domain>/api/cron/reminders` with header `x-cron-secret: <CRON_SECRET>` | 5 minutes |
| Read new Gmail | `POST https://<your domain>/api/cron/gmail-sync` with the same header | 30 minutes |

## Gmail

Gmail needs a Google Cloud project with the Gmail API turned on, an OAuth client (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`), and the redirect URI `<your domain>/api/auth/callback/google`. While the app is in Google's Testing mode, only listed test users can connect, and they reconnect every 7 days.

## Deploying to Vercel

- Add Postgres from the Vercel Storage tab (Neon). It sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- Set the Function Region to `iad1`, next to the database.
- Set `BETTER_AUTH_URL` for the Production environment only; previews use their own URL.
- Push notifications need HTTPS, so test them on the deployed site. On iPhone, add the app to the Home Screen first.
