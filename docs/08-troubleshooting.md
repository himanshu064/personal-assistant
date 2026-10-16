# 8. Problems and fixes

## The app does not start

| Error | Cause | Fix |
|---|---|---|
| `DATABASE_URL environment variable is not set` | No database string | Add `DATABASE_URL` to `.env` (or Vercel) |
| `ENCRYPTION_KEY must be exactly 32 characters` | Wrong length | `openssl rand -hex 16` gives exactly 32 |
| `BETTER_AUTH_SECRET is missing` | Not set | `openssl rand -base64 32` |
| `relation "..." does not exist` or `column ... does not exist` | Migrations not run | `pnpm db:migrate`, then restart `pnpm dev` |
| `pnpm: command not found` or a wrong pnpm version | pnpm not enabled | `corepack enable` |
| Build fails while `pnpm dev` runs | They share `.next` | Stop `pnpm dev`, then `pnpm build` |

## Sign up and sign in

| Problem | Fix |
|---|---|
| No confirmation email on your computer | Without `RESEND_API_KEY` the link is printed in the `pnpm dev` terminal. Open it |
| No confirmation email on the live site | Set `RESEND_API_KEY` and a `RESEND_FROM_EMAIL` on a domain verified in Resend, then redeploy |
| "Please confirm your email first" | Open the confirmation link, or use "Send the link again" |
| Sign in works locally but not live | `BETTER_AUTH_URL` must be the exact live address with `https://`, set for Production, then redeploy |

## Notifications

| Problem | Fix |
|---|---|
| "Push notifications are not configured on the server" | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` missing on Vercel. Add them and redeploy |
| No notifications at all | The **reminders cron job** is missing or failing. Check its History on cron-job.org |
| "Notifications are blocked" | Allow notifications for the site in the browser settings |
| Nothing on iPhone | Add the app to the Home Screen first and open it from there |
| Notifications stopped after new VAPID keys | Expected. Users must turn notifications on again |

## Cron jobs

| Problem | Fix |
|---|---|
| 403 Forbidden | `x-cron-secret` header wrong, or not redeployed after setting `CRON_SECRET` |
| Alerts arrive late | `REMINDER_CRON_INTERVAL_MINUTES` does not match the schedule (must be 15 for every 15 minutes) |

## Gmail

| Problem | Fix |
|---|---|
| `Error 400: redirect_uri_mismatch` on Google's screen | Add `https://<your-app>/api/gmail/callback` (and `http://localhost:3000/api/gmail/callback` locally) to the Google client's Authorized redirect URIs |
| "Access blocked" on Google's screen | The Gmail address is not a **Test user** of the Google app |
| Inbox says Reconnect | Normal every 7 days while the Google app is in Testing, or after the Client ID changed. Tap Reconnect |
| "Set up your Google app in Settings > Google first" | Settings > Google, add the Client ID and secret |

## AI

| Problem | Fix |
|---|---|
| "This key was rejected" | Copy the whole key again |
| "This key isn't tied to a workspace" (Claude) | Create the key inside a workspace in the Anthropic Console |
| Chats say "Add your Claude or Gemini key" | Settings > AI keys |
| Model list shows only one model | The key's provider could not be reached, or no key for that provider. It refreshes every hour |

## Data

| Problem | Fix |
|---|---|
| Saved AI keys stopped working after a change | `ENCRYPTION_KEY` changed. Put the old value back; there is no other way to read them |
| Local test data shows on the live site | Your `.env` uses the live database. Use a Neon `dev` branch (see [02-database.md](02-database.md)) |
