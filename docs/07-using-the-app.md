# 7. Using the app (what each part does)

## AI keys (Settings > AI keys)

- Users add their own **Claude (Anthropic)** or **Gemini (Google)** key. Keys are checked with the provider when saved, stored encrypted, and only the last 4 characters are ever shown.
- Several keys per provider are allowed. One is **In use**; tap **Use this key** to switch.
- **Usage, last 30 days** shows the tokens each key and model used, to compare them.
- **Settings > General > Model** lists the models the user's key can use, live from the provider. The cheapest model is the default. The chosen model answers chats; the mic, reminder drafts, project memory and Gmail always use the provider's fastest, lowest cost model (Claude Haiku or Gemini Flash Lite), with thinking off for the mic and reminder drafts.
- Without any key: reminders still work with a simpler text reader; chats need a key.

## The mic button

- Phones: the raised button in the middle of the bottom bar. Computers: the round button bottom right.
- Tap it and speak. The app decides what you meant:

| You say | It does |
|---|---|
| "remind me to call mom at 5", "walk the dog tomorrow at 7am" | Saves a **reminder** straight away (with **Undo**). No time said: opens the preview to ask |
| "start a chat about trip planning", "what is the capital of France" | Opens a new **Chat** with that as the first message |
| "Aman gave me 200 rupees for Billing", "how much have I paid the contractor?" | Sends it to that **project's** chat |
| Fits two places (two projects, or a project and a reminder) | Asks you to pick |

How it decides: you never say whether it is new or about something you already have, so the AI decides. It sees your projects (name, description and the start of what each one remembers), the project you are looking at, and the next 14 dates. If two places fit about equally well, it asks you to pick. "Ravi paid 5000 for the kitchen, remind me to pay the plumber on Friday" does both. Without an AI key, everything you say is read as a reminder (the free rules parser finds the time). See `app/(app)/assistant/actions.ts`.

## Reminders

- **New reminder** (Home or Reminders): speak or type, then check the **preview** and save.
- **Alert me**: 15, 30, 45 minutes or 1 hour before (Settings > General sets the default).
- **Remind me**: once to 5 times, 15 minutes apart, ending at the Alert me time. Example: call at 4:40, 15 minutes, 3 times: alerts at 4:00, 4:15, 4:30.
- **Repeat**: does not repeat, daily, every weekday, weekly, monthly, yearly. After its time passes (or when marked done), a repeating reminder moves to its next date. Monthly on the 31st uses the last day of short months.
- **Done** on a repeating reminder means "done for this time".
- **Snooze**: 15 minutes, 1 hour, or tomorrow 9 AM.

## Notifications

- Turn them on once per device: the banner on Home, or **Settings > Notifications**.
- Needs **HTTPS** (the live site). On **iPhone**, first add the app to the Home Screen (Share > Add to Home Screen), then open it from there.
- Chrome, Edge and Android show **Done** and **Snooze 15 min** buttons on the notification. Safari shows no buttons; tapping opens the app.

## Chat and Projects

- **Chat**: quick conversations, not tied to a project. It knows your upcoming reminders.
- **Projects**: each project has chats and a shared **Memory** of facts (amounts, decisions) across its chats.
- Every chat has a **...** menu: **Move to** a project, another project, or back to Chat, and **Delete**. Moving into a project adds the chat's facts to that project's memory.
- The mic in the chat box sends what you say straight to the AI. Each answer shows the tokens it used.

## Inbox (Gmail)

See [06-gmail-and-google.md](06-gmail-and-google.md).
