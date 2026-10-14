import { z } from "zod";
import { MEMORY_MAX_CHARS } from "@/lib/projects/chat-types";

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Give the project a name.").max(80, "Keep the name under 80 characters."),
  description: z.string().trim().max(300, "Keep the description under 300 characters."),
});

export type ProjectValues = z.infer<typeof projectSchema>;

export const memorySchema = z.object({
  memory: z.string().trim().max(MEMORY_MAX_CHARS, `Keep the memory under ${MEMORY_MAX_CHARS.toLocaleString("en-US")} characters.`),
});

export type MemoryValues = z.infer<typeof memorySchema>;
