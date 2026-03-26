import { ValidationError } from "../../errors/http-errors.js";
import { isRecord, requireEmail, requireString } from "../_shared/validation/validation-helpers.js";

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

const getEmailDomain = (email: string): string => email.split("@")[1]?.toLowerCase() ?? "";

export type ScheduleDemoInput = {
  firstName: string;
  lastName: string;
  companyEmail: string;
  companyName: string;
  heardAboutUs: string;
};

export const parseScheduleDemoBody = (body: unknown): ScheduleDemoInput => {
  if (!isRecord(body)) {
    throw new ValidationError("Validation failed", { issue: "body_must_be_object" });
  }

  const firstName = requireString(body, "firstName");
  const lastName = requireString(body, "lastName");
  const companyName = requireString(body, "companyName");
  const heardAboutUs = requireString(body, "heardAboutUs");
  const companyEmail = requireEmail(body, "companyEmail");

  const domain = getEmailDomain(companyEmail);
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) {
    throw new ValidationError("Validation failed", { field: "companyEmail", issue: "work_email_required" });
  }

  return { firstName, lastName, companyEmail, companyName, heardAboutUs };
};
