import { z } from "zod";

const trimmed = z.string().transform((value) => value.trim());

export const adminLoginSchema = z.object({
  email: trimmed.pipe(z.string().email("Email is required.")),
  password: trimmed.pipe(z.string().min(1, "Password is required.")),
});

export type AdminLoginInput = z.output<typeof adminLoginSchema>;

