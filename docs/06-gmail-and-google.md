# 6. Gmail and Google

## How it works

- Each **user** connects Gmail through **their own Google app** (a Google OAuth client from their own Google Cloud project). Nothing Google related goes in `.env` or Vercel.
- The user saves the **Client ID** and **Client secret** in the app at **Settings > Google**. The secret is stored encrypted with `ENCRYPTION_KEY`.
- The app only asks for **read only** Gmail access (`gmail.readonly`). It never sends, deletes or changes mail.
- Gmail is read **once a day at 6:00 AM IST** (the Gmail cron job) and whenever the user taps **Sync now** in the Inbox.
- Calendar invites and emails with a date become **reminders by themselves**. Emails with no date wait in the Inbox as suggestions.
- A user can connect **more than one Gmail**.

## Set up a Google app (each user, about 5 minutes)

The same steps are in the app behind the (i) icon on Settings > Google.

1. Open [Google Cloud Console](https://console.cloud.google.com) and create a project (or pick one).
2. **APIs & Services > Library**: search **Gmail API** and click **Enable**.
3. **Google Auth Platform** (OAuth consent screen) > **Get started**: enter an app name and your email, choose **External**.
4. **Audience > Test users**: add **every Gmail address** you will connect.
5. **Data access**: add the scope `https://www.googleapis.com/auth/gmail.readonly`.
6. **Clients > Create client**: type **Web application**. Under **Authorized redirect URIs** add the Redirect URL shown on Settings > Google:
   - Live: `https://<your-app>/api/gmail/callback`
   - Your computer: `http://localhost:3000/api/gmail/callback`
   - Add one line for every address you open the app on (for example a preview link).
7. Copy the **Client ID** (ends with `.apps.googleusercontent.com`) and the **Client secret** (usually starts with `GOCSPX-`).

## Save it in the app

1. **Settings > Google**: paste the Client ID and Client secret > **Save and test**.
2. The test asks Google directly:
   - "Google does not know this Client ID": copy the Client ID again.
   - "The Client secret does not match": copy the secret again, or make a new one.
   - "Connection works": done.
3. The test **cannot** check the Redirect URL. If it is missing, Google shows `Error 400: redirect_uri_mismatch` when you connect. Fix it in step 6 above.

## Connect Gmail

**Inbox > Connect Gmail** (or **... > Add another Gmail**). Choose the Google account, allow reading email, and you return to the Inbox while the last 30 days are read.

## Limits you must know

| Limit | What it means | What to do |
|---|---|---|
| **Testing mode: 7 days** | While the Google app is in "Testing", Google ends access every 7 days | The Inbox shows **Reconnect**. Tap it |
| **Testing mode: test users only** | Only Gmail addresses listed under Test users can connect | Add them in step 4 |
| **Public launch** | `gmail.readonly` is a "restricted" scope. To let anyone connect without being a test user, the Google app must pass **Google's verification and a security assessment** | Plan time for this before a public launch |
| **Changing the Client ID** | Google ties tokens to the app that made them | Connected Gmails show **Reconnect** after a new Client ID |

## Remove

- **Settings > Google > Remove**: Gmail stops syncing until a Google app is added again and Gmail is reconnected.
- **Inbox > ... > Disconnect <address>**: asks Google to revoke access and deletes that Gmail's suggestions. Reminders already made stay.
