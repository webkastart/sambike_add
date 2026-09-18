import { describe, expect, it } from "vitest";
import { canLaunchLive, launchCheck, summarizeLaunchChecks } from "@/lib/launch-readiness";
import { secretConfigurationStatuses } from "@/lib/launch-security";

const base = { explanation: "Kontrola", action: "Opraviť", href: "/admin", verification: "automatic" as const };

describe("launch readiness", () => {
  it("distinguishes required blockers from recommended warnings", () => {
    const required = launchCheck({ ...base, key: "required", label: "Povinné", ready: false, required: true });
    const recommended = launchCheck({ ...base, key: "recommended", label: "Odporúčané", ready: false, required: false });
    const done = launchCheck({ ...base, key: "done", label: "Hotovo", ready: true, required: true });
    expect(required.state).toBe("blocking");
    expect(recommended.state).toBe("attention");
    expect(done.state).toBe("done");
    expect(canLaunchLive([done, recommended])).toBe(true);
    expect(canLaunchLive([done, required])).toBe(false);
  });

  it("uses the most severe state in each summary", () => {
    const done = launchCheck({ ...base, key: "done", label: "Hotovo", ready: true, required: true });
    const warning = launchCheck({ ...base, key: "warning", label: "Pozor", ready: false, required: false });
    const blocker = launchCheck({ ...base, key: "blocker", label: "Blokuje", ready: false, required: true });
    const summary = summarizeLaunchChecks({ publish: [done], leads: [warning], email: [blocker], measurement: [done], meta: [done], live: [blocker] });
    expect(summary).toMatchObject({ publish: "done", leads: "attention", email: "blocking", live: "blocking" });
  });
});

describe("secret status projection", () => {
  it("returns only configuration state and never secret values", () => {
    const secret = "super-secret-value-that-must-not-leak";
    const statuses = secretConfigurationStatuses({ META_ACCESS_TOKEN: secret, CRON_SECRET: "" });
    expect(statuses.find((item) => item.name === "META_ACCESS_TOKEN")?.configured).toBe(true);
    expect(statuses.find((item) => item.name === "CRON_SECRET")?.configured).toBe(false);
    expect(JSON.stringify(statuses)).not.toContain(secret);
  });
});
