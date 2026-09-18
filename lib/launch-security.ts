export const secretConfiguration = [
  ["Databáza", "DATABASE_URL"], ["Admin session secret", "ADMIN_SESSION_SECRET"], ["Lead protection secret", "LEAD_PROTECTION_SECRET"],
  ["Turnstile secret", "TURNSTILE_SECRET_KEY"], ["Resend API key", "RESEND_API_KEY"], ["Meta access token", "META_ACCESS_TOKEN"],
  ["Meta app secret", "META_APP_SECRET"], ["R2 secret", "R2_SECRET_ACCESS_KEY"], ["Cron secret", "CRON_SECRET"], ["Sentry token", "SENTRY_AUTH_TOKEN"],
] as const;

export function secretConfigurationStatuses(environment: Record<string, string | undefined>) {
  return secretConfiguration.map(([label, name]) => ({ label, name, configured: Boolean(environment[name]?.trim()) }));
}
