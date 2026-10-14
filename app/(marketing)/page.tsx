import type { Metadata } from "next";
import Link from "next/link";
import { BellRingIcon, FolderOpenIcon, InboxIcon, KeyRoundIcon, LockKeyholeIcon, MicIcon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AppPreview } from "@/components/landing/app-preview";
import { LandingNavActions } from "@/components/landing/landing-nav-actions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE } from "@/lib/constants/site";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME}: ${SITE_TAGLINE}` },
  description: SITE_DESCRIPTION,
};

const FEATURES = [
  {
    icon: MicIcon,
    title: "Reminders by voice",
    body: "Say it the way you would tell a friend. You see exactly what will be saved, fix anything, then save. Nothing is added behind your back.",
    soon: false,
  },
  {
    icon: BellRingIcon,
    title: "Notifications that arrive",
    body: "Reminders reach your phone and laptop as notifications, even when the app is closed. Snooze or mark done in a tap.",
    soon: false,
  },
  {
    icon: InboxIcon,
    title: "Meetings from your Gmail",
    body: "Connect Gmail and your assistant finds invites, meetings and deadlines, then suggests reminders you can add in one tap.",
    soon: true,
  },
  {
    icon: FolderOpenIcon,
    title: "Projects that remember",
    body: "Speak notes into a project over days or weeks, then ask questions about everything you said, like a chat that knows your project.",
    soon: true,
  },
];

const STEPS = [
  { title: "Speak", body: "Tap the mic: “Remind me to call Ravi tomorrow at 5pm.” Typing works too." },
  { title: "Check", body: "A preview shows the title, date and time it understood. Edit anything that is off." },
  { title: "Get reminded", body: "Save, and a notification arrives on time on every device you turned on." },
];

const FAQS = [
  {
    q: "Do I need an AI key?",
    a: "No. Reminders work without one: dates and times are understood by a built in parser. Add your own Claude or Gemini key in Settings for smarter understanding of what you say.",
  },
  {
    q: "Which browsers support voice?",
    a: "Chrome, Edge and Safari, including on iPhone. In other browsers you can type, or add a Gemini key so recordings can be transcribed.",
  },
  {
    q: "How do notifications work on iPhone?",
    a: "iPhone only sends notifications to apps on the Home Screen. In Safari, tap Share, then Add to Home Screen, open it from there and turn notifications on.",
  },
  {
    q: "What happens to my API keys?",
    a: "They are encrypted before they are stored and are never shown again; only the last 4 characters appear in Settings. They are used only for your own requests.",
  },
  {
    q: "Who pays for the AI?",
    a: "AI features use your own key, so any AI usage is billed by your provider at their rates. The default models are their lowest cost ones.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-sidebar">
      {/* Navigation */}
      <header className="sticky top-0 z-40 border-b border-transparent bg-sidebar/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
          <Link href="/" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Logo className="text-[15px] font-normal" />
          </Link>
          <ul className="hidden items-center gap-7 text-[15px] text-muted-foreground md:flex">
            <li><a href="#features" className="hover:text-foreground">Features</a></li>
            <li><a href="#how-it-works" className="hover:text-foreground">How it works</a></li>
            <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
          </ul>
          <div className="flex items-center gap-2">
            <LandingNavActions />
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pt-14 text-center md:px-6 md:pt-24">
          <Badge variant="outline" className="h-7 gap-1.5 bg-background px-3 text-[13px]">
            <MicIcon className="size-3.5" strokeWidth={1.5} />
            A voice first personal assistant
          </Badge>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl leading-[1.05] tracking-[-0.035em] md:text-7xl">{SITE_TAGLINE}</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Tell your assistant what to remember. It turns what you say into reminders you check before saving, then makes sure you
            hear about them on time.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="page" className="w-full sm:w-auto" nativeButton={false} render={<Link href="/sign-up" />}>
              <MicIcon strokeWidth={1.5} />
              Get started
            </Button>
            <Button size="page" variant="outline" className="w-full sm:w-auto" nativeButton={false} render={<a href="#how-it-works" />}>
              See how it works
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">No AI key needed to start.</p>

          <div className="mt-14 md:mt-20">
            <AppPreview />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 md:px-6 md:py-28">
          <div className="max-w-2xl">
            <h2 className="text-4xl tracking-tight md:text-5xl">Everything you need to remember, in one place</h2>
            <p className="mt-4 text-lg text-muted-foreground">Start with reminders today. Gmail and projects are on the way.</p>
          </div>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex flex-col gap-4 rounded-2xl bg-card p-6 framed">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl border bg-background">
                    <f.icon className="size-5" strokeWidth={1.5} aria-hidden />
                  </span>
                  {f.soon ? <Badge variant="info">Coming soon</Badge> : <Badge variant="success">Available</Badge>}
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl tracking-tight">{f.title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* How it works: a real sequence, so the steps are numbered. */}
        <section id="how-it-works" className="scroll-mt-20 border-y border-border/70 bg-background">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
            <h2 className="max-w-2xl text-4xl tracking-tight md:text-5xl">From a sentence to a reminder in seconds</h2>
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col gap-4 rounded-2xl bg-card p-6 framed">
                  <span className="flex size-9 items-center justify-center rounded-full border text-sm tabular-nums">{i + 1}</span>
                  <h3 className="text-xl tracking-tight">{s.title}</h3>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Trust */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6 md:py-28">
          <div className="grid gap-5 md:grid-cols-3">
            {[
              { icon: KeyRoundIcon, title: "Your own AI key", body: "Use Claude or Gemini with your own key, or no key at all." },
              { icon: LockKeyholeIcon, title: "Encrypted keys", body: "Keys are encrypted at rest and never shown again after saving." },
              { icon: SmartphoneIcon, title: "Works on your phone", body: "Install it to your Home Screen for full screen and notifications." },
            ].map((t) => (
              <div key={t.title} className="flex gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-background">
                  <t.icon className="size-5" strokeWidth={1.5} aria-hidden />
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-lg tracking-tight">{t.title}</h3>
                  <p className="text-[15px] text-muted-foreground">{t.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-20 gap-10 px-4 pb-20 md:grid-cols-[1fr_1.4fr] md:px-6 md:pb-28">
          <div>
            <h2 className="text-4xl tracking-tight md:text-5xl">Questions</h2>
            <p className="mt-4 text-lg text-muted-foreground">The things people ask before they start.</p>
          </div>
          <div className="rounded-2xl bg-card px-6 py-2 framed">
            <Accordion>
              {FAQS.map((f) => (
                <AccordionItem key={f.q} value={f.q} className="border-dashed">
                  <AccordionTrigger className="py-5 text-base font-normal hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Final call to action */}
        <section className="mx-auto max-w-6xl px-4 pb-20 md:px-6 md:pb-28">
          <div className="flex flex-col items-center gap-6 rounded-[1.75rem] bg-primary px-6 py-16 text-center text-primary-foreground md:py-20">
            <ShieldCheckIcon className="size-8 text-primary-foreground/70" strokeWidth={1.5} aria-hidden />
            <h2 className="max-w-2xl text-4xl tracking-tight md:text-5xl">Stop trying to remember everything</h2>
            <p className="max-w-lg text-lg text-primary-foreground/70">Create an account, tap the mic, and say the first thing on your mind.</p>
            <Button size="page" variant="secondary" nativeButton={false} render={<Link href="/sign-up" />}>
              Get started
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/70">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row md:px-6">
          <Logo className="text-sm font-normal text-foreground" />
          <p>{SITE_DESCRIPTION}</p>
        </div>
      </footer>
    </div>
  );
}
