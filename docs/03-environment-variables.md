# 3. Environment variables

These are settings the app reads when it runs. On your computer they live in `.env`. On Vercel they live in **Project > Settings > Environment Variables**.

> `.env` is **never** committed (it is in `.gitignore`). `.env.example` is the template.

## The full list

| Variable | Required? | What it is | How to make it | Vercel environments |
|---|---|---|---|---|
| `DATABASE_URL` | **Yes** | Pooled Neon connection | Added by the Neon integration | Production, Preview (automatic) |
| `DATABASE_URL_UNPOOLED` | **Yes** | Direct Neon connection, for migrations | Added by the Neon integration | Production, Preview (automatic) |
| `BETTER_AUTH_SECRET` | **Yes**, the app will not start without it | Signs login sessions | `openssl rand -base64 32` | Production, Preview |
| `BETTER_AUTH_URL` | **Yes** on Production | The site's own address | Local: `http://localhost:3000`. Live: `https://your-app.vercel.app` (or your domain) | **Production only** |
| `ENCRYPTION_KEY` | **Yes**, exactly **32** characters | Encrypts users' AI keys and Google secrets | `openssl rand -hex 16` | Production, Preview |
| `VAPID_PUBLIC_KEY` | For notifications | Lets browsers subscribe to push | `pnpm exec web-push generate-vapid-keys` | Production, Preview |
| `VAPID_PRIVATE_KEY` | For notifications | Signs push messages (secret) | Same command as above | Production, Preview |
| `VAPID_SUBJECT` | For notifications | Contact for push services | `mailto:you@yourdomain.com` | Production, Preview |
| `CRON_SECRET` | For cron jobs | Password the cron jobs send | `openssl rand -hex 32` | Production |
| `REMINDER_CRON_INTERVAL_MINUTES` | Yes (default 15) | How often the reminders job runs | `15` | Production |
| `GMAIL_SYNC_INTERVAL_MINUTES` | Yes (default 1440) | How often the Gmail job runs (1440 = once a day) | `1440` | Production |
| `RESEND_API_KEY` | For real emails | Sends confirmation and password reset emails | [resend.com](https://resend.com) > API Keys | Production |
| `RESEND_FROM_EMAIL` | With Resend | Sender, on a domain verified in Resend | `Personal Assistant <no-reply@yourdomain.com>` | Production |
| `RESEND_TO_EMAIL` | No | Sends **every** email to this inbox (testing only) | Your email | Only while testing |

### Not needed any more (do not add)

`AI_DEFAULT_PROVIDER`, `AI_DEFAULT_MODEL_*`, `AI_ALLOWED_MODELS_*` (models now come live from each user's key) and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (each user adds their own Google app in Settings > Google).

### Set by Vercel by itself (do not add)

`VERCEL_URL`, `VERCEL_BRANCH_URL` (used so preview links work for sign in), plus the Neon ones like `PGHOST`, `POSTGRES_URL`, `NEON_PROJECT_ID`.

## Rules that will break things if missed

1. **`ENCRYPTION_KEY` must be exactly 32 characters**, or the app throws `ENCRYPTION_KEY must be exactly 32 characters`. `openssl rand -hex 16` gives exactly 32.
2. **Never change `ENCRYPTION_KEY` after users saved keys.** Their saved AI keys and Google secrets become unreadable. Use the same value everywhere that shares a database.
3. **`BETTER_AUTH_SECRET` is required.** Without it the app stops with `BETTER_AUTH_SECRET is missing`.
4. **`BETTER_AUTH_URL` must match the real address** (with `https://`, no slash at the end). Set it for **Production only**: previews then use their own address automatically.
5. **Keep the same VAPID keys forever.** New keys cancel every existing notification subscription; users would have to turn notifications on again.
6. **The interval values must match the cron-job.org schedule** (15 for reminders, 1440 for Gmail). See [05-cron-jobs.md](05-cron-jobs.md).
7. **After adding or changing a variable on Vercel, redeploy.** Running deployments keep the old values.

## Making the values (copy and paste)

```bash
openssl rand -base64 32                  # BETTER_AUTH_SECRET
openssl rand -hex 16                     # ENCRYPTION_KEY (32 characters)
openssl rand -hex 32                     # CRON_SECRET
pnpm exec web-push generate-vapid-keys   # VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY
```

## A complete local `.env` example (fake values)

```bash
DATABASE_URL=postgresql://user:pass@ep-xxxx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:pass@ep-xxxx.us-east-1.aws.neon.tech/neondb?sslmode=require

BETTER_AUTH_SECRET=change-me-to-the-openssl-output
BETTER_AUTH_URL=http://localhost:3000
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef

RESEND_API_KEY=
RESEND_FROM_EMAIL="Personal Assistant <no-reply@yourdomain.com>"
RESEND_TO_EMAIL=

VAPID_PUBLIC_KEY=B...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@yourdomain.com

CRON_SECRET=change-me
REMINDER_CRON_INTERVAL_MINUTES=15
GMAIL_SYNC_INTERVAL_MINUTES=1440
```

## Email notes (Resend)

- Without `RESEND_API_KEY`, nothing is emailed; the confirmation and reset links are printed in the server log. Fine on your computer, **not** fine on the live site (users could not confirm their email).
- Resend only sends from a **domain you verified** in Resend. Until then, it can only send to your own Resend account email.
