# 1. Run it on your computer

## What you need first

| Tool | Version | How to check | How to get it |
|---|---|---|---|
| Node.js | **24** | `node -v` | [nodejs.org](https://nodejs.org) or `nvm install 24` |
| pnpm | **11** (the project is pinned to 11.25.0) | `pnpm -v` | `corepack enable` (comes with Node) |
| Git | any recent | `git --version` | [git-scm.com](https://git-scm.com) |
| openssl | any | `openssl version` | Already on macOS and Linux |
| A database | Neon Postgres | | See [02-database.md](02-database.md) |

> Use **pnpm**, not npm or yarn. The lock file is `pnpm-lock.yaml`.

## Step 1. Clone

```bash
git clone git@github.com:himanshu064/personal-assistant.git
cd personal-assistant
```

## Step 2. Install

```bash
corepack enable
pnpm install
```

If pnpm asks to approve build scripts, the allowed ones are already listed in `pnpm-workspace.yaml` (esbuild, sharp, unrs-resolver).

## Step 3. Create your `.env`

```bash
cp .env.example .env
```

Fill it in. The minimum to start the app:

| Variable | Needed to start? | Quick way to make it |
|---|---|---|
| `DATABASE_URL` | **Yes** | From Neon (see [02-database.md](02-database.md)) |
| `DATABASE_URL_UNPOOLED` | **Yes** (for migrations) | From Neon |
| `BETTER_AUTH_SECRET` | **Yes** | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | **Yes** | `http://localhost:3000` |
| `ENCRYPTION_KEY` | **Yes**, exactly 32 characters | `openssl rand -hex 16` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Only for notifications | `pnpm exec web-push generate-vapid-keys` |
| `CRON_SECRET` | Only to call the cron URLs | `openssl rand -hex 32` |
| `RESEND_API_KEY` | No (links are printed in the terminal instead) | From resend.com |

Every variable is explained in [03-environment-variables.md](03-environment-variables.md).

## Step 4. Create the tables

```bash
pnpm db:migrate
```

This runs every file in `db/migrations` against `DATABASE_URL_UNPOOLED`. Run it again whenever new migration files arrive (after `git pull`).

## Step 5. Start

```bash
pnpm dev
```

Open http://localhost:3000.

## Step 6. Make your first account

1. Click **Sign up**, enter name, email and a password (at least 8 characters).
2. You must **confirm your email** before you can sign in.
   - With `RESEND_API_KEY` set: check your inbox.
   - Without it: look in the terminal where `pnpm dev` runs. You will see a line like
     `[EMAIL] RESEND_API_KEY not set. "Confirm your email..." for you@x.com: http://localhost:3000/api/auth/verify-email?...`
     Open that link.
3. Sign in.
4. Go to **Settings > AI keys** and add a Claude or Gemini key. Without a key, the app still works for reminders (a simpler text reader), but chats and smart reading need a key.

## Useful commands

| Command | What it does |
|---|---|
| `pnpm dev` | Starts the app on http://localhost:3000 |
| `pnpm typecheck` | Checks TypeScript |
| `pnpm lint` | Checks code style |
| `pnpm build` | Production build. **Stop `pnpm dev` first**, they share the `.next` folder |
| `pnpm db:generate` | Makes a new migration from changes in `db/schema` |
| `pnpm db:migrate` | Applies migrations |
| `pnpm db:studio` | Opens a database browser |

> Never run `drizzle-kit push` (`db:push`). Always generate a migration and migrate.

## Test on your phone (same Wi-Fi)

1. Find your computer's local IP, for example `192.168.1.20`.
2. Open `http://192.168.1.20:3000` on the phone (already allowed in `next.config.ts`).
3. Notifications need **HTTPS**, so test those on the deployed site, not on your computer's IP.

## Notes

- The small round **N** badge (top right) only appears on your computer. It is the Next.js developer badge.
- Running the project locally uses the database in your `.env`. If that is the same database as the live site, your test data shows up there too. See "Use a separate database for your computer" in [02-database.md](02-database.md).
