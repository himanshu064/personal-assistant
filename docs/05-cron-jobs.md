# 5. Cron jobs (scheduled jobs)

## Why they are needed

On Vercel, the app only runs when someone calls one of its addresses. Nobody is using the app at 4:30 when "Call Ravi" is due, so something must **knock on the door on a schedule**. That is the cron job.

[cron-job.org](https://cron-job.org) (free) calls two addresses of the app:

| Job | Address | When | What it does |
|---|---|---|---|
| **Reminders** | `POST https://<your-app>/api/cron/reminders` | **Every 15 minutes** | Sends the push notifications that are due, repeats alerts, moves repeating reminders to their next date |
| **Gmail** | `POST https://<your-app>/api/cron/gmail-sync` | **Once a day, 6:00 AM IST** | Reads new Gmail for every connected user and turns meetings and dated items into reminders |

Without the reminders job, **no notification is ever sent**.

## Before you start

On Vercel, these must be set (then redeploy):

- `CRON_SECRET`, for example from `openssl rand -hex 32`
- `REMINDER_CRON_INTERVAL_MINUTES=15`
- `GMAIL_SYNC_INTERVAL_MINUTES=1440`

## Job 1: Reminders (every 15 minutes)

1. cron-job.org > **Create cronjob**.
2. **Common** tab:
   - Title: `Personal Assistant: reminders`
   - URL: `https://<your-app>/api/cron/reminders`
   - Execution schedule: **Every 15 minutes** (crontab `*/15 * * * *`, runs at :00, :15, :30, :45)
3. **Advanced** tab:
   - Request method: **POST**
   - Headers > Add: key `x-cron-secret`, value: your `CRON_SECRET`
   - Do **not** put the secret in the URL.
4. Turn on "notify me when the job fails".
5. **Create**.

## Job 2: Gmail (6:00 AM IST every day)

1. **Create cronjob**.
2. **Common** tab:
   - Title: `Personal Assistant: Gmail sync`
   - URL: `https://<your-app>/api/cron/gmail-sync`
   - Execution schedule: **Every day at 6:00**
   - Time zone of the job: **Asia/Kolkata**. If you keep the job on UTC instead, use **0:30** (00:30 UTC is 6:00 AM IST).
   - Check "Next executions" shows 6:00 AM tomorrow.
3. **Advanced** tab: method **POST**, header `x-cron-secret` with your `CRON_SECRET`.
4. **Create**.

Optional, only with more than about 20 connected Gmail accounts: use **Custom** with crontab `0,10,20 6 * * *` (Asia/Kolkata). The 6:10 and 6:20 runs finish any Gmail the 6:00 run did not reach.

## Check they work

Use **Test run** on each job, then open its **History**:

| Job | Good answer (status 200) |
|---|---|
| Reminders | `{"claimed":0,"pushed":0,"noDevice":0}` (`claimed` = alerts sent this run) |
| Gmail | `{"accounts":1,"synced":1,"suggested":0,"failed":0}` |

| You see | Fix |
|---|---|
| **403** `{"error":"Forbidden"}` | Wrong or missing `x-cron-secret`, or you did not redeploy after adding `CRON_SECRET` |
| **404** | Wrong URL |
| Gmail `"accounts":0` | Normal if every Gmail was checked within the last hour (for example after "Sync now"), or nobody has connected Gmail |
| Gmail shows **timeout** | cron-job.org stops waiting after about 30 seconds; the app keeps working up to 60. Check Vercel > Logs; if it finished there, ignore it |

## How timing works (good to know)

- Each reminders run sends every alert due **before the next run**. Alerts are never late, at most 15 minutes early.
- The "Alert me" choices (15, 30, 45 minutes, 1 hour before) are multiples of 15, so for times on the quarter hour they arrive **exactly**.
- A reminder made less than about 15 minutes before its time can arrive just after it. That is the limit of a 15 minute schedule.
- The interval variables tell the app how often it is called. **If you change a schedule on cron-job.org, change the variable to match** and redeploy.

## On your computer

cron-job.org cannot reach `localhost`. To test locally, call the jobs yourself:

```bash
S=$(grep -E '^CRON_SECRET=' .env | tail -1 | cut -d= -f2- | tr -d '"')
curl -X POST http://localhost:3000/api/cron/reminders -H "x-cron-secret: $S"
curl -X POST http://localhost:3000/api/cron/gmail-sync -H "x-cron-secret: $S"
```

Or in the app: **Inbox > Sync now** reads Gmail immediately.
