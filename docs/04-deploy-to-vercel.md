# 4. Deploy to Vercel

## Step 1. Create the project

1. [vercel.com](https://vercel.com) > **Add New** > **Project** > import the GitHub repo `himanshu064/personal-assistant`.
2. Framework: **Next.js** (found by itself).
3. **Build Command: leave the default.** The project has a `vercel-build` script (`drizzle-kit migrate && next build`) that Vercel runs instead of `build`. If you type your own build command, migrations will not run.
4. Node.js version: **24.x** (Settings > General).

## Step 2. Add the database

Follow [02-database.md](02-database.md) > "Create the database". After this, `DATABASE_URL` and `DATABASE_URL_UNPOOLED` exist on Vercel.

## Step 3. Add the environment variables

Settings > **Environment Variables**. Add everything from [03-environment-variables.md](03-environment-variables.md):

| Add to Production **and** Preview | Add to **Production only** |
|---|---|
| `BETTER_AUTH_SECRET` | `BETTER_AUTH_URL` (your live address) |
| `ENCRYPTION_KEY` | `CRON_SECRET` |
| `VAPID_PUBLIC_KEY` | `REMINDER_CRON_INTERVAL_MINUTES` = `15` |
| `VAPID_PRIVATE_KEY` | `GMAIL_SYNC_INTERVAL_MINUTES` = `1440` |
| `VAPID_SUBJECT` | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |

> If the secrets are only on Production, **preview deployments will fail** (no encryption key, no sign in secret). Tick Preview too if you want working previews.

## Step 4. Function region

Settings > **Functions** > **Function Region**: `iad1` (Washington, D.C.), next to the Neon database in `us-east-1`. Far apart regions make every page slower.

## Step 5. Deploy

Click **Deploy** (or push to `main`). In the build log you should see the migrations run, then the Next.js build.

## Step 6. Check it works

1. Open the live address and **sign up**. The confirmation email should arrive (needs Resend).
2. Sign in, go to **Settings > AI keys**, add a key.
3. **Settings > Notifications** (or the banner on Home) > **Turn on**. Allow notifications.
4. Make a reminder a little ahead and check the push arrives (after the cron jobs are set up, next step).

## Step 7. Cron jobs

Follow [05-cron-jobs.md](05-cron-jobs.md). Without them, **no notifications are sent** and Gmail is never read.

## Plans and cost (as of October 2026, check current pricing)

| Service | Free plan | Note |
|---|---|---|
| Vercel Hobby | 1M function calls, 4 hours CPU a month | **Personal, non commercial use only**. A client product needs **Pro** (about $20 a month). Hobby's own cron runs only once a day, which is why cron-job.org is used |
| Neon Free | 100 compute hours a month | The 15 minute reminders job uses about 60. A real product likely needs the paid plan |
| cron-job.org | Free | Calls the two job URLs |
| Resend | Free tier | Needs a verified sending domain |

## Updating the live site

Push to `main`. Vercel builds, **runs any new migrations**, and deploys. If a migration fails, the old version stays live; fix the migration and push again.
