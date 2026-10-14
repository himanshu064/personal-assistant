import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { SITE_NAME } from "@/lib/constants/site";
import { sendEmail } from "@/lib/email/send";
import { VerifyEmail } from "@/emails/verify-email";
import { ResetPasswordEmail } from "@/emails/reset-password";

const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

export const auth = betterAuth({
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
