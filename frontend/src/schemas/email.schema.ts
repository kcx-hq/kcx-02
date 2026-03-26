import { z } from "zod"

const trimmed = z.string().transform((value) => value.trim())

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "gmx.com",
  "gmx.net",
  "fastmail.com",
  "hey.com",
  "yahoo.com",
  "yahoo.co.in",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "mail.com",
  "me.com",
  "mac.com",
  "rediffmail.com",
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
  "10minutemail.com",
])

function getEmailDomain(email: string) {
  const atIndex = email.lastIndexOf("@")
  if (atIndex === -1) return ""
  return email.slice(atIndex + 1).toLowerCase()
}

export const workEmailSchema = trimmed
  .pipe(z.string().email("Enter a valid work email."))
  .refine((email) => {
    const domain = getEmailDomain(email)
    if (!domain) return false
    if (domain.split(".").length < 2) return false
    return !PERSONAL_EMAIL_DOMAINS.has(domain)
  }, "Use your work email address (no personal email domains).")

