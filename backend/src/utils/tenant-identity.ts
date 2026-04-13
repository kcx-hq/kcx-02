export function deriveTenantSlugFromEmail(email: string): string {
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  const domain = normalizedEmail.split("@")[1]?.trim().toLowerCase() ?? "";
  const baseDomain = domain.replace(/\..*$/, "");
  return baseDomain.length > 0 ? baseDomain : normalizedEmail;
}

