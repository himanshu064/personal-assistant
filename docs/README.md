# Personal Assistant: documentation

A voice first personal assistant. You speak (or type) and it:

- saves **reminders** and sends **push notifications** before they are due (with repeats like daily or weekly),
- keeps **project chats** that remember what you tell them,
- has a **Chat** section for quick conversations,
- reads your **Gmail** once a day and turns meetings and dated items into reminders.

Each user brings their own AI key (Claude or Gemini) and their own Google app for Gmail.

## Read in this order

| Step | Page | What it covers |
|---|---|---|
| 1 | [Run it on your computer](01-local-setup.md) | Clone, install, `.env`, first start, first account |
| 2 | [Database](02-database.md) | Neon Postgres through Vercel, migrations, the dev branch |
| 3 | [Environment variables](03-environment-variables.md) | Every variable: what it is, how to make it, where it goes |
| 4 | [Deploy to Vercel](04-deploy-to-vercel.md) | Project, database, variables, region, first deploy |
| 5 | [Cron jobs](05-cron-jobs.md) | cron-job.org setup for reminders and Gmail |
| 6 | [Gmail and Google](06-gmail-and-google.md) | How each user sets up their Google app and connects Gmail |
| 7 | [Using the app](07-using-the-app.md) | AI keys, reminders, alerts, repeats, chats, projects, notifications |
| 8 | [Problems and fixes](08-troubleshooting.md) | Common errors and how to fix them |

## The short version (for someone who has done this before)

```bash
git clone git@github.com:himanshu064/personal-assistant.git
cd personal-assistant
corepack enable          # gives you pnpm 11
pnpm install
cp .env.example .env     # fill it in, see 03-environment-variables.md
pnpm db:migrate          # creates the tables
pnpm dev                 # http://localhost:3000
```

Then on Vercel: add Neon from Storage, add the variables, deploy (migrations run by themselves), and create the two cron jobs on cron-job.org.

## Tech used

| Part | What |
|---|---|
| Web app | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| Database | Neon Postgres (added through Vercel), Drizzle ORM |
| Sign in | Better Auth (email and password, email confirmation required) |
| Emails | Resend (optional when running on your computer) |
| AI | AI SDK with the user's own Claude or Gemini key |
| Notifications | Web Push (VAPID keys) and a service worker |
| Scheduled jobs | cron-job.org calling two app URLs |
