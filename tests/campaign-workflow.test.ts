import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  assignVariant,
  campaignReadiness,
  canTransitionCampaign,
  changedSnapshotFields,
  createCampaignPreviewToken,
  parseBratislavaDateTime,
  publicationSnapshot,
  variantConversion,
  verifyCampaignPreviewToken,
} from "@/lib/campaign-workflow";
import { assertMetaBudgetLimits, getMetaConnectionSummary, getMetaMode, hasExplicitLiveConfirmation, metaBillingUrl, setRemoteMetaAdStatus } from "@/lib/meta-ads";

const env = { ...process.env };
afterEach(() => { process.env = { ...env }; });

function validCampaign() {
  return {
    name: "Servis", slug: "servis", headline: "Servis bicyklov", description: "Dlhší a pravdivý popis servisnej ponuky.", ctaText: "Objednať", priceText: "Cena podľa rozsahu",
    phone: "+421 900 000 000", email: "servis@example.com", imageUrl: "/uploads/hero.webp", formEnabled: true,
    legalUrl: "/ochrana-osobnych-udajov", seoTitle: "Servis bicyklov", seoDescription: "Servis bicyklov v Spišskej Novej Vsi.", address: "Letná 51", openingHours: "Po–Pi", galleryItems: [{ mediaUrl: "/uploads/detail.webp" }], metaAd: null,
  };
}

describe("campaign lifecycle and publication safety", () => {
  it("migrates the legacy boolean to one source of truth", () => {
    const sql = readFileSync("prisma/migrations/20260916150000_campaign_optimization_phase_three/migration.sql", "utf8");
    expect(sql).toContain("WHEN \"isActive\" THEN 'PUBLISHED'");
    expect(sql).toContain("ELSE 'DRAFT'");
    expect(sql).toContain("DROP COLUMN \"isActive\"");
  });

  it("allows only explicit lifecycle transitions", () => {
    expect(canTransitionCampaign("DRAFT", "READY")).toBe(true);
    expect(canTransitionCampaign("READY", "PUBLISHED")).toBe(true);
    expect(canTransitionCampaign("PUBLISHED", "DRAFT")).toBe(false);
    expect(canTransitionCampaign("ARCHIVED", "PUBLISHED")).toBe(false);
    expect(canTransitionCampaign("ARCHIVED", "DRAFT")).toBe(true);
  });

  it("blocks publication when a required server check fails", () => {
    const good = campaignReadiness(validCampaign(), { appUrl: "https://kampane.sambike.sk", requireProductionUrl: true });
    expect(good.ready).toBe(true);
    const bad = campaignReadiness({ ...validCampaign(), email: "zle", seoTitle: null }, { appUrl: "http://localhost:3000", requireProductionUrl: true });
    expect(bad.ready).toBe(false);
    expect(bad.items.filter((item) => item.level === "required" && !item.ready).map((item) => item.key)).toEqual(expect.arrayContaining(["contact", "seo", "productionUrl"]));
  });

  it("creates scoped expiring preview tokens", () => {
    process.env.CAMPAIGN_PREVIEW_SECRET = "preview-test-secret-with-at-least-32-characters";
    const now = Date.UTC(2026, 8, 16, 10);
    const token = createCampaignPreviewToken("campaign-a", now);
    expect(verifyCampaignPreviewToken(token, "campaign-a", now + 60_000)).toBe(true);
    expect(verifyCampaignPreviewToken(token, "campaign-b", now + 60_000)).toBe(false);
    expect(verifyCampaignPreviewToken(token, "campaign-a", now + 16 * 60_000)).toBe(false);
  });

  it("snapshots publishable fields and reports only changed fields", () => {
    const first = publicationSnapshot({ ...validCampaign(), galleryItems: [{ mediaUrl: "/a.webp", mediaType: "IMAGE", caption: "A", placement: "GALLERY", sortOrder: 0 }] });
    const second = { ...first, headline: "Nový nadpis" };
    expect(changedSnapshotFields(first, second)).toEqual(["headline"]);
    expect(first).not.toHaveProperty("metaAd");
    expect(first).not.toHaveProperty("leads");
  });

  it("interprets schedules in Europe/Bratislava including DST", () => {
    expect(parseBratislavaDateTime("2026-01-15T12:00")?.toISOString()).toBe("2026-01-15T11:00:00.000Z");
    expect(parseBratislavaDateTime("2026-07-15T12:00")?.toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });
});

describe("A/B privacy and Meta guardrails", () => {
  it("assigns variants deterministically without creating an identifier", () => {
    expect(assignVariant("visit-seed")).toBe(assignVariant("visit-seed"));
    expect(["A", "B"]).toContain(assignVariant("another-seed"));
    expect(variantConversion(50, 2)).toEqual({ views: 50, leads: 2, conversion: 0.04, indicative: true });
    expect(variantConversion(0, 0).conversion).toBeNull();
  });

  it("defaults Meta to sandbox and enforces configured budget caps", () => {
    delete process.env.META_MODE;
    process.env.META_MAX_CAMPAIGN_DAILY_BUDGET_CENTS = "2500";
    process.env.META_MAX_GLOBAL_DAILY_BUDGET_CENTS = "7000";
    expect(getMetaMode()).toBe("sandbox");
    expect(getMetaConnectionSummary()).toMatchObject({ mode: "sandbox", maxCampaignDailyBudgetCents: 2500, maxGlobalDailyBudgetCents: 7000 });
  });

  it("opens Meta billing for the configured ad account without handling card data", () => {
    process.env.META_AD_ACCOUNT_ID = "act_123456";
    expect(metaBillingUrl()).toBe("https://business.facebook.com/billing_hub/accounts/details/?act=123456");
  });

  it("never activates a remote ad in sandbox", async () => {
    process.env.META_MODE = "sandbox";
    await expect(setRemoteMetaAdStatus({ campaignId: "1", adSetId: "2", adId: "3" }, "ACTIVE")).rejects.toThrow("Sandbox");
  });

  it("blocks live activation without confirmation and enforces both budget caps", () => {
    expect(hasExplicitLiveConfirmation(undefined)).toBe(false);
    expect(hasExplicitLiveConfirmation("activate-live")).toBe(true);
    const limits = { maxCampaignDailyBudgetCents: 2_000, maxGlobalDailyBudgetCents: 5_000 };
    expect(() => assertMetaBudgetLimits(2_001, 0, limits)).toThrow("limit jednej kampane");
    expect(() => assertMetaBudgetLimits(2_000, 3_001, limits)).toThrow("globálny denný limit");
    expect(() => assertMetaBudgetLimits(2_000, 3_000, limits)).not.toThrow();
  });
});
