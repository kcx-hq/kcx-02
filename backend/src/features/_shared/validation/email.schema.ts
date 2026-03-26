import { z } from "zod";

const trimmed = z.string().transform((value) => value.trim());

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
]);

function getEmailDomain(email: string) {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return "";
  return email.slice(atIndex + 1).toLowerCase();
}

export const workEmailSchema = trimmed
  .pipe(z.string().email("Enter a valid work email."))
  .transform((email) => email.toLowerCase())
  .refine((email) => {
    const domain = getEmailDomain(email);
    if (!domain) return false;
    if (domain.split(".").length < 2) return false;
    return !PERSONAL_EMAIL_DOMAINS.has(domain);
  }, "Use your work email address (no personal email domains).");

