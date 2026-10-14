import { z } from "zod";

const email = z.email("Enter a valid email address.");
const password = z.string().min(8, "Use at least 8 characters.").max(128, "Use at most 128 characters.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80, "Use at most 80 characters."),
  email,
  password,
});

export const forgotPasswordSchema = z.object({ email });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match.", path: ["confirm"] });

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

/** Only allow redirects to paths inside this app, never to other sites. */
export function safeRedirect(path: string | null | undefined, fallback = "/home"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}
