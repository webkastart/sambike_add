const insecureValues = new Set([
  "admin",
  "password",
  "change-me",
  "zvolte-dlhe-jedinecne-heslo",
  "nahodny-dlhy-retazec",
]);

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function configuredSecret(name: string, developmentFallback: string, minimumLength: number) {
  const value = process.env[name]?.trim();
  if (process.env.NODE_ENV !== "production") return value || developmentFallback;
  if (!value || value.length < minimumLength || insecureValues.has(value.toLowerCase())) {
    throw new ConfigurationError(
      `${name} musí byť v produkcii nastavené na jedinečnú hodnotu s minimálne ${minimumLength} znakmi.`,
    );
  }
  return value;
}

export function adminPassword() {
  return configuredSecret("ADMIN_PASSWORD", "admin", 16);
}

export function adminSessionSecret() {
  return configuredSecret("ADMIN_SESSION_SECRET", "development-session-secret-only", 32);
}

export function leadProtectionSecret() {
  return configuredSecret("LEAD_PROTECTION_SECRET", "development-lead-protection-secret-only", 32);
}

export function privacyPolicyVersion() {
  return process.env.PRIVACY_POLICY_VERSION?.trim() || "2026-09-16";
}

export function leadRetentionDays() {
  const value = Number(process.env.LEAD_RETENTION_DAYS || "730");
  return Number.isInteger(value) && value >= 30 && value <= 3650 ? value : 730;
}

export function missingProductionConfiguration() {
  if (process.env.NODE_ENV !== "production") return [];
  const missing: string[] = [];
  for (const [name, min] of [
    ["ADMIN_PASSWORD", 16],
    ["ADMIN_SESSION_SECRET", 32],
    ["LEAD_PROTECTION_SECRET", 32],
    ["TURNSTILE_SECRET_KEY", 1],
    ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", 1],
    ["PRIVACY_OPERATOR_NAME", 1],
    ["PRIVACY_OPERATOR_ADDRESS", 1],
    ["PRIVACY_CONTACT_EMAIL", 1],
    ["CRON_SECRET", 32],
  ] as const) {
    const value = process.env[name]?.trim() || "";
    if (value.length < min || insecureValues.has(value.toLowerCase())) missing.push(name);
  }
  return missing;
}
