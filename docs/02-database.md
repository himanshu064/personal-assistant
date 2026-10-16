# 2. Database

The app uses **one Postgres database on Neon**, added through Vercel. All data lives there: users, reminders, chats, projects, Gmail items, AI keys (encrypted), usage.

## Create the database (through Vercel)

1. Open your project on [vercel.com](https://vercel.com) > **Storage** > **Create Database** > **Neon** (Postgres).
2. Pick the region **US East (N. Virginia)** (`us-east-1`), close to the app's functions (`iad1`).
3. When Vercel asks how to connect it, use exactly these settings:

| Setting | Choose | Why |
|---|---|---|
| Environments | **Production, Preview** | Both get the database variables |
| Create database branch for deployment > **Production** | **Off** | The live site must use the main database |
| Create database branch for deployment > **Preview** | **On** | Each preview gets its own copy of the data |
| Custom Prefix | **Leave empty** | The code reads exactly `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. A prefix would rename them and the app could not find the database |
| Sensitive | **Off** | So you can still see and copy the values |

4. Click **Connect**.

Vercel now has `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and some extra ones (`PGHOST`, `POSTGRES_URL` and so on). The extra ones are managed by Neon: the app does not use them, but **leave them**, deleting them can upset the integration.

## The two connection strings

| Variable | What | Used by |
|---|---|---|
| `DATABASE_URL` | **Pooled** (host contains `-pooler`) | The app, for every request |
| `DATABASE_URL_UNPOOLED` | **Direct** | Migrations (`drizzle-kit migrate`) |

The pooled one shares a few real connections between many requests. Because of that, `db/index.ts` uses `prepare: false`. Do not change that.

## Get the strings for your computer

Vercel > Storage > your Neon database > **.env.local** tab (or **Quickstart**), copy `DATABASE_URL` and `DATABASE_URL_UNPOOLED` into your `.env`.

## Use a separate database for your computer (recommended)

If your `.env` points at the main database, everything you test locally appears on the live site.

To keep them apart:

1. Open the Neon console (from Vercel > Storage > your database > **Open in Neon**).
2. **Branches** > **Create branch**, name it `dev`, from `main`.
3. Copy the `dev` branch's pooled and direct connection strings into your `.env`.
4. Run `pnpm db:migrate` once against it.

> Important: `ENCRYPTION_KEY` must be the **same** everywhere that shares one database, or saved AI keys and Google secrets cannot be read.

## Migrations (how tables are made and changed)

- Tables are defined in `db/schema/*.ts`.
- Each change becomes a SQL file in `db/migrations` (`0000_...sql` to the latest).
- **On your computer:** `pnpm db:migrate`.
- **On Vercel:** migrations run **by themselves on every deploy**. The `vercel-build` script in `package.json` is `drizzle-kit migrate && next build`. If a migration fails, the deploy fails and the old version stays live.
  - Keep Vercel's **Build Command** on the default, otherwise Vercel skips `vercel-build`.
- **Preview deploys** migrate their own preview branch, so the main data is safe.

### Changing the schema

```bash
# 1. edit db/schema/...
pnpm db:generate     # writes db/migrations/00xx_name.sql
# 2. read the new SQL file
pnpm db:migrate      # applies it locally
# 3. commit both the schema change and the SQL file
```

Rule: a migration runs a moment **before** the new code goes live, while the old code still serves. So a migration must also work with the old code. Example: drop a column only one deploy **after** the code stopped using it.

## Free plan limits (Neon)

- 100 compute hours a month on the free plan. Neon sleeps after 5 quiet minutes and sleeping is free.
- The reminders job wakes it every 15 minutes, which uses about 60 hours a month. Normal use of the app adds to that.
- Check usage in the Neon console after a few days. For a real product, plan for Neon's paid plan (pay as you go).
