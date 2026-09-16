import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseCampaignEventPayload } from "@/lib/campaign-events";
import { canTransitionLead, csvCell, normalizeEmail, normalizePhone, parseMoneyToCents } from "@/lib/crm";
import { bratislavaDateKey, fromBratislavaLocal, nextBratislavaDayStart, resolvePeriod } from "@/lib/date-range";
import { leadDedupeKey } from "@/lib/lead-protection";
import { leadListQuery } from "@/lib/lead-query";
import { metaDailyMetricUpsert } from "@/lib/meta-sync";
import { campaignPerformance, safeRate } from "@/lib/performance";
import { createSessionToken, safeAdminReturnTo, verifySessionToken } from "@/lib/session-core";

describe("životný cyklus leadu", () => {
  it("povoľuje obchodnú cestu a blokuje preskočenie z nového na dokončený", () => {
    expect(canTransitionLead("NEW", "CONTACTED")).toBe(true);
    expect(canTransitionLead("CONTACTED", "BOOKED")).toBe(true);
    expect(canTransitionLead("BOOKED", "COMPLETED")).toBe(true);
    expect(canTransitionLead("NEW", "COMPLETED")).toBe(false);
  });

  it("ukladá hodnotu ako celé centy a odmieta záporné či nepresné sumy", () => {
    expect(parseMoneyToCents("125,90")).toBe(12590);
    expect(parseMoneyToCents("0")).toBe(0);
    expect(parseMoneyToCents("-1")).toBeNull();
    expect(parseMoneyToCents("1.999")).toBeNull();
  });
});

describe("normalizácia a deduplikácia", () => {
  it("normalizuje slovenské telefóny a e-maily", () => {
    expect(normalizePhone("0905 123 456")).toBe("+421905123456");
    expect(normalizePhone("00421 905 123 456")).toBe("+421905123456");
    expect(normalizeEmail(" TEST@Example.SK ")).toBe("test@example.sk");
  });

  it("retry s rovnakým tokenom má identický kľúč, nový token nie", () => {
    process.env.LEAD_PROTECTION_SECRET = "test-secret-with-at-least-thirty-two-characters";
    const first = leadDedupeKey("campaign", "nonce-1", "payload");
    expect(leadDedupeKey("campaign", "nonce-1", "payload")).toBe(first);
    expect(leadDedupeKey("campaign", "nonce-2", "payload")).not.toBe(first);
  });
});

describe("zoznam a CSV", () => {
  it("vytvorí serverový filter, triedenie a stránku", () => {
    const query = leadListQuery({ q: "Ján", kampan: "c1", stav: "BOOKED", zdroj: "meta", sort: "oldest", strana: "3" });
    expect(query.page).toBe(3);
    expect(query.orderBy).toEqual([{ createdAt: "asc" }]);
    expect(query.where).toHaveProperty("AND");
  });

  it("neutralizuje vzorce v CSV", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+421900")).toBe("\"'+421900\"");
    expect(csvCell("Ján")).toBe("\"Ján\"");
  });
});

describe("interné udalosti", () => {
  it("prijíma iba povolený tvar", () => {
    expect(parseCampaignEventPayload({ campaignSlug: "servis", type: "PAGE_VIEW", eventId: "event_123456" })).toEqual({ campaignSlug: "servis", type: "PAGE_VIEW", eventId: "event_123456", variant: null });
    expect(parseCampaignEventPayload({ campaignSlug: "servis", type: "DELETE_ALL", eventId: "event_123456" })).toBeNull();
    expect(parseCampaignEventPayload({ campaignSlug: "servis", type: "PAGE_VIEW", eventId: "x" })).toBeNull();
  });
});

describe("funnel a výkon", () => {
  it("ošetrí delenie nulou a počíta CPL, cenu zákazky a ROAS", () => {
    expect(safeRate(1, 0)).toBeNull();
    expect(safeRate(2, 10)).toBe(0.2);
    expect(campaignPerformance({ spendCents: 10000, leads: 4, completed: 2, revenueCents: 50000 })).toEqual({ cplCents: 2500, costPerCompletedCents: 5000, roas: 5 });
    expect(campaignPerformance({ spendCents: null, leads: 0, completed: 0, revenueCents: 0 })).toEqual({ cplCents: null, costPerCompletedCents: null, roas: null });
  });
});

describe("denné Meta metriky", () => {
  it("používajú pri opakovanom importe rovnaký zložený upsert kľúč", () => {
    const metric = { date: new Date("2026-09-16T00:00:00.000Z"), spendCents: 1234, impressions: 500, clicks: 30, metaLeads: 4 };
    const first = metaDailyMetricUpsert("meta-ad-1", metric);
    const retry = metaDailyMetricUpsert("meta-ad-1", { ...metric, clicks: 31 });
    expect(retry.where).toEqual(first.where);
    expect(retry.update.clicks).toBe(31);
  });
});

describe("časové pásmo", () => {
  it("konvertuje bratislavský lokálny čas aj cez letný čas", () => {
    expect(fromBratislavaLocal("2026-01-15T10:00")?.toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(fromBratislavaLocal("2026-07-15T10:00")?.toISOString()).toBe("2026-07-15T08:00:00.000Z");
    expect(bratislavaDateKey(new Date("2026-09-15T22:30:00.000Z"))).toBe("2026-09-16");
  });

  it("vytvorí presný sedemdňový rozsah", () => {
    const period = resolvePeriod("7d", undefined, undefined, new Date("2026-09-16T10:00:00Z"));
    expect(period.from).toBe("2026-09-10");
    expect(period.to).toBe("2026-09-16");
  });

  it("ukončí dátumový filter na ďalšej bratislavskej polnoci aj pri zmene času", () => {
    expect(nextBratislavaDayStart("2026-03-29")?.toISOString()).toBe("2026-03-29T22:00:00.000Z");
    expect(nextBratislavaDayStart("2026-10-25")?.toISOString()).toBe("2026-10-25T23:00:00.000Z");
  });
});

describe("autentifikácia a migrácia", () => {
  it("overuje podpísanú reláciu a blokuje open redirect", () => {
    const token = createSessionToken("secret", 1_000_000);
    expect(verifySessionToken(token, "secret", 1_001_000)).toBe(true);
    expect(verifySessionToken(token, "wrong", 1_001_000)).toBe(false);
    expect(safeAdminReturnTo("//evil.example")).toBe("/admin");
    expect(safeAdminReturnTo("/admin/leady?q=1")).toBe("/admin/leady?q=1");
  });

  it("migruje existujúce leady na NEW a používa idempotentný denný Meta kľúč", () => {
    const migration = readFileSync("prisma/migrations/20260916130000_crm_phase_two/migration.sql", "utf8");
    expect(migration).toContain('"status" "LeadStatus" NOT NULL DEFAULT \'NEW\'');
    expect(migration).toContain('CREATE UNIQUE INDEX "MetaDailyMetric_metaAdCampaignId_date_key"');
  });
});
