import { z } from "zod";
import { AI_PROVIDERS } from "@/lib/ai/providers";
import { LEAD_TIME_OPTIONS } from "@/lib/validation/reminders";

export const preferencesSchema = z.object({
  timezone: z.string().min(1, "Choose your timezone."),
  provider: z.enum(AI_PROVIDERS),
  model: z.string().min(1, "Choose a model."),
  defaultLeadMinutes: z.coerce
    .number()
    .int()
    .refine((v) => (LEAD_TIME_OPTIONS as readonly number[]).includes(v), "Choose a valid option."),
});
export type PreferencesInput = z.input<typeof preferencesSchema>;
export type PreferencesValues = z.output<typeof preferencesSchema>;

export const apiKeySchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  apiKey: z
    .string()
    .trim()
    .min(20, "This looks too short to be an API key.")
    .max(400, "This looks too long to be an API key.")
    .refine((v) => !/\s/.test(v), "API keys do not contain spaces."),
});
export type ApiKeyValues = z.infer<typeof apiKeySchema>;

export const providerSchema = z.object({ provider: z.enum(AI_PROVIDERS) });

/** True when the runtime knows this IANA timezone name. */
export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
