import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { SITE_NAME } from "@/lib/constants/site";
import { sendEmail } from "@/lib/email/send";
import { VerifyEmail } from "@/emails/verify-email";
import { ResetPasswordEmail } from "@/emails/reset-password";

/** Vercel sets these (without https://) on every deployment, including previews. */
const vercelUrls = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
  .filter((v): v is string => Boolean(v))
  .map((host) => `https://${host}`);

/**
 * Set BETTER_AUTH_URL for Production only in Vercel. Previews then fall back
 * to their own deployment URL, so sign in and email links work there too.
 */
const appUrl = process.env.BETTER_AUTH_URL ?? vercelUrls[0] ?? "http://localhost:3000";

export const auth = betterAuth({
  baseURL: appUrl,
  // Preview deployments (and their branch URLs) may call the auth API.
  trustedOrigins: vercelUrls,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: `Reset your ${SITE_NAME} password`,
        react: ResetPasswordEmail({ name: user.name, url, appUrl }),
        logLink: url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      // After the link is opened, land on a page that confirms it worked.
      const verifyUrl = new URL(url);
      verifyUrl.searchParams.set("callbackURL", "/verify-email?verified=1");
      await sendEmail({
        to: user.email,
        subject: `Confirm your email for ${SITE_NAME}`,
        react: VerifyEmail({ name: user.name, url: verifyUrl.toString(), appUrl }),
        logLink: verifyUrl.toString(),
      });
    },
  },
  /**
   * Google is only used to LINK Gmail to an account that signed up with email
   * and password (decided: no "Sign in with Google"). Sign up through Google
   * is off, and signing in with it is blocked in hooks.before below.
   */
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      // Always return a refresh token, so syncing works while the user is away.
      accessType: "offline",
      prompt: "consent",
      disableSignUp: true,
    },
  },
  account: {
    // Gmail tokens are stored encrypted.
    encryptOAuthTokens: true,
    accountLinking: {
      // The Gmail address may differ from the sign in email. Safe here because
      // Google can never be used to sign in (see hooks.before).
      allowDifferentEmails: true,
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/social" || ctx.path === "/sign-in/oauth2") {
        throw new APIError("FORBIDDEN", { message: "Sign in with your email and password." });
      }
    }),
  },
  databaseHooks: {
    account: {
      // Linking (or relinking) Gmail: start tracking it and run the first sync.
      // Only on the OAuth callback; token refreshes also update the account row.
      create: { after: async (row, ctx) => onGoogleLinked(row, ctx?.path) },
      update: { after: async (row, ctx) => onGoogleLinked(row, ctx?.path) },
    },
  },
  session: {
    // Read the session from a signed cookie for 5 minutes instead of hitting
    // the database on every request.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    // Serverless instances do not share memory, so counters live in Postgres.
    storage: "database",
  },
  advanced: {
    database: { generateId: "uuid" },
    // Send emails after the response so timing does not reveal whether an
    // account exists.
    backgroundTasks: { handler: (promise) => after(promise) },
  },
  // nextCookies must be the last plugin so server actions can set cookies.
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/** Called after Better Auth saves a linked account; see databaseHooks above. */
async function onGoogleLinked(row: { id?: string; userId?: string; providerId?: string; scope?: string | null }, path: string | undefined) {
  if (row.providerId !== "google" || !row.id || !row.userId || !path?.startsWith("/callback/")) return;
  // Imported here: the Gmail code itself uses `auth` to get access tokens.
  const { onGmailLinked } = await import("@/lib/gmail/connection");
  await onGmailLinked({ userId: row.userId, accountId: row.id, scope: row.scope ?? "" });
}
