/**
 * Central branding constants. Change the name, description, logo or colours
 * here and the metadata, manifest, app shell, auth pages and emails all pick
 * up the new values. Image files live in `public/brand/`.
 */

export const SITE_NAME = "Personal Assistant";

/** Short name for the home screen icon label, where space is tight. */
export const SITE_SHORT_NAME = "Assistant";

export const SITE_DESCRIPTION =
  "Your AI voice assistant for reminders, email follow-ups and project notes.";

export const SITE_TAGLINE = "Speak it. We'll remember it.";

export const LOGO_PATH = "/brand/logo.svg";
export const ICON_192_PATH = "/brand/icon-192.png";
export const ICON_512_PATH = "/brand/icon-512.png";
export const ICON_MASKABLE_PATH = "/brand/icon-maskable-512.png";

/** Browser UI colour on mobile (address bar, PWA title bar). */
export const THEME_COLOR = "#0a0a0a";

/** Splash screen background when the installed app opens. */
export const BACKGROUND_COLOR = "#ffffff";

/**
 * Hex brand colour used in emails. Email clients do not support CSS
 * variables, so this must stay a literal hex value.
 */
export const BRAND_PRIMARY_HEX = "#0a0a0a";

/** Sender display name used when RESEND_FROM_EMAIL has no name part. */
export const EMAIL_SENDER_NAME = SITE_NAME;

/** Builds a page title like "Settings | Personal Assistant". */
export function pageTitle(page: string): string {
  return `${page} | ${SITE_NAME}`;
}
