import type { ReactElement } from "react";
import { Resend } from "resend";
import { EMAIL_SENDER_NAME } from "@/lib/constants/site";

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

const FROM =
  process.env.RESEND_FROM_EMAIL || `${EMAIL_SENDER_NAME} <onboarding@resend.dev>`;

/**
 * If RESEND_TO_EMAIL is set, every email goes to that inbox instead.
 * Use it while testing so real users never get test mail.
 */
function resolveRecipient(email: string): string {
  return process.env.RESEND_TO_EMAIL || email;
}

/**
 * Sends an email and never throws. Sign up and password reset must keep
 * working even if Resend rejects a send (for example, an unverified domain).
 * Without RESEND_API_KEY the email is printed to the server log instead, so
 * the link can be opened from the terminal during local development.
 */
export async function sendEmail(opts: {
  to: string;
  subject: string;
  react: ReactElement;
  /** Printed when no API key is set, so the flow can be finished locally. */
  logLink: string;
}): Promise<{ sent: boolean }> {
  if (!resend) {
    console.info(`[EMAIL] RESEND_API_KEY not set. "${opts.subject}" for ${opts.to}: ${opts.logLink}`);
    return { sent: false };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: resolveRecipient(opts.to),
      subject: opts.subject,
      react: opts.react,
    });
    if (error) {
      console.warn("email.send.failed", { to: opts.to, subject: opts.subject, name: error.name, message: error.message });
      return { sent: false };
    }
    console.info("email.sent", { to: opts.to, subject: opts.subject, id: data?.id });
    return { sent: true };
  } catch (e) {
    console.warn("email.send.threw", {
      to: opts.to,
      subject: opts.subject,
      message: e instanceof Error ? e.message : String(e),
    });
    return { sent: false };
  }
}
