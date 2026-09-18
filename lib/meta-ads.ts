import "server-only";

import { createHmac } from "node:crypto";
import { getOperationalSettings } from "@/lib/operational-settings";

const defaultApiVersion = "v25.0";
const defaultLatitude = 48.9446;
const defaultLongitude = 20.5615;

type MetaApiErrorPayload = {
  error?: {
    code?: number;
    error_subcode?: number;
    message?: string;
    error_user_title?: string;
    error_user_msg?: string;
  };
};

type MetaIdResponse = { id: string };

export type MetaConnectionSummary = {
  configured: boolean;
  missing: string[];
  adAccountId: string;
  pageId: string;
  instagramConnected: boolean;
  apiVersion: string;
  mode: "sandbox" | "live";
  maxCampaignDailyBudgetCents: number;
  maxGlobalDailyBudgetCents: number;
};

export type MetaAdDraftInput = {
  primaryText: string;
  headline: string;
  description: string;
  dailyBudgetCents: number;
  radiusKm: number;
  minAge: number;
  maxAge: number;
  platforms: Array<"facebook" | "instagram">;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type MetaCampaignSource = {
  name: string;
  slug: string;
  imageUrl: string;
};

type MetaConfig = {
  accessToken: string;
  adAccountId: string;
  pageId: string;
  instagramActorId: string;
  appSecret: string;
  appUrl: string;
  apiVersion: string;
  latitude: number;
  longitude: number;
};

export class MetaAdsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaAdsError";
  }
}

export function assertMetaBudgetLimits(dailyBudgetCents: number, otherActiveBudgetCents: number, limits: Pick<MetaConnectionSummary, "maxCampaignDailyBudgetCents" | "maxGlobalDailyBudgetCents">) {
  if (dailyBudgetCents > limits.maxCampaignDailyBudgetCents) throw new MetaAdsError("Rozpočet prekračuje limit jednej kampane.");
  if (otherActiveBudgetCents + dailyBudgetCents > limits.maxGlobalDailyBudgetCents) throw new MetaAdsError("Rozpočet by prekročil globálny denný limit.");
}

export function hasExplicitLiveConfirmation(value: unknown) {
  return value === "activate-live";
}

export function getMetaMode(): "sandbox" | "live" {
  return process.env.META_MODE?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

function positiveCents(name: string, fallback: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function identifier(value: string | undefined, prefix = "") {
  const cleaned = value?.trim().replace(prefix, "") ?? "";
  return /^\d+$/.test(cleaned) ? cleaned : "";
}

function apiVersion() {
  const value = process.env.META_API_VERSION?.trim() ?? defaultApiVersion;
  return /^v\d+\.\d+$/.test(value) ? value : defaultApiVersion;
}

function coordinate(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export function getMetaConnectionSummary(): MetaConnectionSummary {
  const accessToken = process.env.META_ACCESS_TOKEN?.trim() ?? "";
  const adAccountId = identifier(process.env.META_AD_ACCOUNT_ID, "act_");
  const pageId = identifier(process.env.META_PAGE_ID);
  const appUrl = process.env.APP_URL?.trim() ?? "";
  const missing: string[] = [];
  if (!accessToken) missing.push("META_ACCESS_TOKEN");
  if (!adAccountId) missing.push("META_AD_ACCOUNT_ID");
  if (!pageId) missing.push("META_PAGE_ID");
  if (!appUrl) missing.push("APP_URL");

  return {
    configured: missing.length === 0,
    missing,
    adAccountId,
    pageId,
    instagramConnected: Boolean(identifier(process.env.META_INSTAGRAM_ACTOR_ID)),
    apiVersion: apiVersion(),
    mode: getMetaMode(),
    maxCampaignDailyBudgetCents: positiveCents("META_MAX_CAMPAIGN_DAILY_BUDGET_CENTS", 5_000),
    maxGlobalDailyBudgetCents: positiveCents("META_MAX_GLOBAL_DAILY_BUDGET_CENTS", 10_000),
  };
}

export async function getMetaConnectionSettings(): Promise<MetaConnectionSummary> {
  const [summary, settings] = await Promise.all([
    Promise.resolve(getMetaConnectionSummary()),
    getOperationalSettings(),
  ]);
  return {
    ...summary,
    maxCampaignDailyBudgetCents: settings.maxCampaignDailyBudgetCents,
    maxGlobalDailyBudgetCents: settings.maxGlobalDailyBudgetCents,
  };
}

function getMetaConfig(): MetaConfig {
  const summary = getMetaConnectionSummary();
  if (!summary.configured) {
    throw new MetaAdsError(`Meta prepojenie nie je dokončené. Chýba: ${summary.missing.join(", ")}.`);
  }

  return {
    accessToken: process.env.META_ACCESS_TOKEN!.trim(),
    adAccountId: summary.adAccountId,
    pageId: summary.pageId,
    instagramActorId: identifier(process.env.META_INSTAGRAM_ACTOR_ID),
    appSecret: process.env.META_APP_SECRET?.trim() ?? "",
    appUrl: process.env.APP_URL!.trim(),
    apiVersion: summary.apiVersion,
    latitude: coordinate(process.env.META_DEFAULT_LATITUDE, defaultLatitude, -90, 90),
    longitude: coordinate(process.env.META_DEFAULT_LONGITUDE, defaultLongitude, -180, 180),
  };
}

function appSecretProof(config: MetaConfig) {
  if (!config.appSecret) return "";
  return createHmac("sha256", config.appSecret).update(config.accessToken).digest("hex");
}

function paramValue(value: unknown) {
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

async function metaRequest<T>(
  path: string,
  options: { method?: "GET" | "POST" | "DELETE"; params?: Record<string, unknown> } = {},
): Promise<T> {
  const config = getMetaConfig();
  const method = options.method ?? "GET";
  const params = new URLSearchParams();
  params.set("access_token", config.accessToken);
  const proof = appSecretProof(config);
  if (proof) params.set("appsecret_proof", proof);
  for (const [key, value] of Object.entries(options.params ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, paramValue(value));
  }

  const url = new URL(`https://graph.facebook.com/${config.apiVersion}/${path.replace(/^\//, "")}`);
  if (method === "GET") url.search = params.toString();
  const response = await fetch(url, {
    method,
    body: method === "GET" ? undefined : params,
    cache: "no-store",
    headers: method === "GET" ? undefined : { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const payload = (await response.json().catch(() => ({}))) as T & MetaApiErrorPayload;
  if (!response.ok || payload.error) {
    const error = payload.error;
    const userMessage = error?.error_user_msg || error?.error_user_title || error?.message;
    const code = error?.code ? ` (Meta ${error.code}${error.error_subcode ? `/${error.error_subcode}` : ""})` : "";
    throw new MetaAdsError(`${userMessage || "Meta API požiadavku odmietlo."}${code}`.slice(0, 500));
  }
  return payload;
}

function publicCampaignUrl(config: MetaConfig, slug: string) {
  const url = new URL(`/kampan/${slug}`, config.appUrl);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new MetaAdsError("APP_URL musí byť verejná HTTPS adresa, aby Meta vedela otvoriť stránku a obrázok kampane.");
  }
  url.searchParams.set("utm_source", "meta");
  url.searchParams.set("utm_medium", "paid_social");
  url.searchParams.set("utm_campaign", slug);
  return url.toString();
}

function publicImageUrl(config: MetaConfig, imageUrl: string) {
  const url = new URL(imageUrl, config.appUrl);
  if (url.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(url.hostname)) {
    throw new MetaAdsError("Obrázok reklamy musí byť dostupný na verejnej HTTPS adrese.");
  }
  return url.toString();
}

export async function verifyMetaConnection() {
  const config = getMetaConfig();
  const settings = await getOperationalSettings();
  const [account, page, permissions, instagram, datasets] = await Promise.all([
    metaRequest<{ id: string; name: string; account_status?: number; currency?: string; timezone_name?: string; spend_cap?: string; amount_spent?: string }>(
      `act_${config.adAccountId}`,
      { params: { fields: "id,name,account_status,currency,timezone_name,spend_cap,amount_spent" } },
    ),
    metaRequest<{ id: string; name: string }>(config.pageId, { params: { fields: "id,name" } }),
    metaRequest<{ data?: Array<{ permission?: string; status?: string }> }>("me/permissions"),
    config.instagramActorId
      ? metaRequest<{ id: string; username?: string }>(config.instagramActorId, { params: { fields: "id,username" } })
      : Promise.resolve(null),
    settings.metaPixelId
      ? metaRequest<{ data?: Array<{ id?: string }> }>(`act_${config.adAccountId}/adspixels`, { params: { fields: "id", limit: 100 } }).catch(() => null)
      : Promise.resolve(null),
  ]);
  const granted = new Set((permissions.data ?? []).filter((item) => item.status === "granted").map((item) => item.permission));
  return {
    accountName: account.name,
    pageName: page.name,
    accountStatus: account.account_status ?? null,
    currency: account.currency ?? "",
    timezoneName: account.timezone_name ?? "",
    spendCapCents: account.spend_cap ? Number.parseInt(account.spend_cap, 10) || null : null,
    amountSpentCents: account.amount_spent ? Number.parseInt(account.amount_spent, 10) || null : null,
    pageAvailable: Boolean(page.id),
    instagramAvailable: config.instagramActorId ? Boolean(instagram?.id) : false,
    permissionsOk: granted.has("ads_management"),
    datasetAssigned: settings.metaPixelId && datasets ? Boolean(datasets.data?.some((item) => item.id === settings.metaPixelId)) : null,
  };
}

export async function createRemoteMetaAd(source: MetaCampaignSource, input: MetaAdDraftInput) {
  if (getMetaMode() !== "live") throw new MetaAdsError("Sandbox režim nevytvára žiadne objekty v reálnom reklamnom účte.");
  const config = getMetaConfig();
  if (input.platforms.includes("instagram") && !config.instagramActorId) {
    throw new MetaAdsError("Pre Instagram doplňte META_INSTAGRAM_ACTOR_ID alebo vyberte iba Facebook.");
  }

  const destinationUrl = publicCampaignUrl(config, source.slug);
  const imageUrl = publicImageUrl(config, source.imageUrl);
  let createdCampaignId = "";

  try {
    const campaign = await metaRequest<MetaIdResponse>(`act_${config.adAccountId}/campaigns`, {
      method: "POST",
      params: {
        name: `SAMBIKE | ${source.name}`,
        objective: "OUTCOME_TRAFFIC",
        buying_type: "AUCTION",
        special_ad_categories: [],
        status: "PAUSED",
      },
    });
    createdCampaignId = campaign.id;

    const targeting = {
      age_min: input.minAge,
      age_max: input.maxAge,
      geo_locations: {
        custom_locations: [{
          latitude: config.latitude,
          longitude: config.longitude,
          radius: input.radiusKm,
          distance_unit: "kilometer",
        }],
      },
      publisher_platforms: input.platforms,
    };
    const adSet = await metaRequest<MetaIdResponse>(`act_${config.adAccountId}/adsets`, {
      method: "POST",
      params: {
        name: `${source.name} | ${input.radiusKm} km | ${input.minAge}–${input.maxAge}`,
        campaign_id: campaign.id,
        daily_budget: input.dailyBudgetCents,
        billing_event: "IMPRESSIONS",
        optimization_goal: "LANDING_PAGE_VIEWS",
        bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        destination_type: "WEBSITE",
        targeting,
        start_time: input.startsAt?.toISOString(),
        end_time: input.endsAt?.toISOString(),
        status: "PAUSED",
      },
    });

    const objectStorySpec: Record<string, unknown> = {
      page_id: config.pageId,
      link_data: {
        link: destinationUrl,
        picture: imageUrl,
        message: input.primaryText,
        name: input.headline,
        description: input.description,
        call_to_action: { type: "LEARN_MORE", value: { link: destinationUrl } },
      },
    };
    if (input.platforms.includes("instagram")) {
      objectStorySpec.instagram_actor_id = config.instagramActorId;
    }
    const creative = await metaRequest<MetaIdResponse>(`act_${config.adAccountId}/adcreatives`, {
      method: "POST",
      params: {
        name: `${source.name} | kreatíva`,
        object_story_spec: objectStorySpec,
      },
    });

    const ad = await metaRequest<MetaIdResponse>(`act_${config.adAccountId}/ads`, {
      method: "POST",
      params: {
        name: `${source.name} | reklama`,
        adset_id: adSet.id,
        creative: { creative_id: creative.id },
        status: "PAUSED",
      },
    });

    return {
      destinationUrl,
      metaCampaignId: campaign.id,
      metaAdSetId: adSet.id,
      metaCreativeId: creative.id,
      metaAdId: ad.id,
    };
  } catch (error) {
    if (createdCampaignId) {
      await metaRequest(createdCampaignId, { method: "DELETE" }).catch(() => undefined);
    }
    throw error;
  }
}

export async function setRemoteMetaAdStatus(
  ids: { campaignId: string; adSetId: string; adId: string },
  status: "ACTIVE" | "PAUSED",
) {
  if (status === "ACTIVE" && getMetaMode() !== "live") {
    throw new MetaAdsError("Sandbox režim nikdy nemôže aktivovať reklamu.");
  }
  if (status === "PAUSED") {
    await metaRequest(ids.campaignId, { method: "POST", params: { status } });
    return;
  }

  try {
    await metaRequest(ids.adId, { method: "POST", params: { status } });
    await metaRequest(ids.adSetId, { method: "POST", params: { status } });
    await metaRequest(ids.campaignId, { method: "POST", params: { status } });
  } catch (error) {
    await metaRequest(ids.campaignId, { method: "POST", params: { status: "PAUSED" } }).catch(() => undefined);
    throw error;
  }
}

export async function setRemoteMetaAdBudget(adSetId: string, dailyBudgetCents: number) {
  if (getMetaMode() !== "live") throw new MetaAdsError("Sandbox režim nemení rozpočet v reálnom reklamnom účte.");
  await metaRequest(adSetId, { method: "POST", params: { daily_budget: dailyBudgetCents } });
}

type MetaInsightsResponse = {
  data?: Array<{
    date_start?: string;
    spend?: string;
    impressions?: string;
    clicks?: string;
    actions?: Array<{ action_type: string; value: string }>;
  }>;
};

export async function syncRemoteMetaAd(metaCampaignId: string) {
  const [campaign, insights, dailyInsights] = await Promise.all([
    metaRequest<{ status?: string; effective_status?: string }>(metaCampaignId, {
      params: { fields: "status,effective_status" },
    }),
    metaRequest<MetaInsightsResponse>(`${metaCampaignId}/insights`, {
      params: { fields: "spend,impressions,clicks,actions", date_preset: "maximum" },
    }),
    metaRequest<MetaInsightsResponse>(`${metaCampaignId}/insights`, {
      params: { fields: "spend,impressions,clicks,actions,date_start", date_preset: "maximum", time_increment: 1, limit: 5000 },
    }),
  ]);
  const row = insights.data?.[0];
  const leadActions = row?.actions?.filter(({ action_type }) => (
    action_type === "lead" || action_type === "onsite_conversion.lead_grouped"
  )) ?? [];

  return {
    status: campaign.status ?? "UNKNOWN",
    effectiveStatus: campaign.effective_status ?? campaign.status ?? "UNKNOWN",
    spendCents: Math.max(0, Math.round((Number.parseFloat(row?.spend ?? "0") || 0) * 100)),
    impressions: Math.max(0, Number.parseInt(row?.impressions ?? "0", 10) || 0),
    clicks: Math.max(0, Number.parseInt(row?.clicks ?? "0", 10) || 0),
    metaLeads: leadActions.reduce((sum, action) => sum + (Number.parseInt(action.value, 10) || 0), 0),
    dailyMetrics: (dailyInsights.data ?? []).flatMap((daily) => {
      if (!daily.date_start || !/^\d{4}-\d{2}-\d{2}$/.test(daily.date_start)) return [];
      const actions = daily.actions?.filter(({ action_type }) => action_type === "lead" || action_type === "onsite_conversion.lead_grouped") ?? [];
      return [{
        date: new Date(`${daily.date_start}T00:00:00.000Z`),
        spendCents: Math.max(0, Math.round((Number.parseFloat(daily.spend ?? "0") || 0) * 100)),
        impressions: Math.max(0, Number.parseInt(daily.impressions ?? "0", 10) || 0),
        clicks: Math.max(0, Number.parseInt(daily.clicks ?? "0", 10) || 0),
        metaLeads: actions.reduce((sum, action) => sum + (Number.parseInt(action.value, 10) || 0), 0),
      }];
    }),
  };
}

export async function deleteRemoteMetaAd(metaCampaignId: string) {
  await metaRequest(metaCampaignId, { method: "DELETE" });
}

async function fetchPreviewFormat(metaAdId: string, adFormat: "DESKTOP_FEED_STANDARD" | "INSTAGRAM_STANDARD") {
  const payload = await metaRequest<{ data?: Array<{ body?: string }> }>(`${metaAdId}/previews`, { params: { ad_format: adFormat } });
  const body = payload.data?.[0]?.body ?? "";
  const match = body.match(/src=["'](https:\/\/[^"']+)["']/i);
  if (!match) throw new MetaAdsError("Meta API nevrátilo podporovaný náhľad reklamy.");
  const url = new URL(match[1].replaceAll("&amp;", "&"));
  if (!/(^|\.)facebook\.com$/.test(url.hostname) && !/(^|\.)instagram\.com$/.test(url.hostname)) {
    throw new MetaAdsError("Meta API vrátilo neplatnú adresu náhľadu.");
  }
  return url.toString();
}

export async function fetchMetaAdPreviews(metaAdId: string, platforms: string) {
  const facebook = platforms.includes("facebook") ? await fetchPreviewFormat(metaAdId, "DESKTOP_FEED_STANDARD").catch(() => null) : null;
  const instagram = platforms.includes("instagram") ? await fetchPreviewFormat(metaAdId, "INSTAGRAM_STANDARD").catch(() => null) : null;
  if (!facebook && !instagram) throw new MetaAdsError("Meta API nevrátilo žiadny podporovaný náhľad reklamy.");
  return { previewFacebookUrl: facebook, previewInstagramUrl: instagram };
}

export function metaAdsManagerUrl(metaCampaignId?: string | null) {
  const account = getMetaConnectionSummary().adAccountId;
  if (!account) return "https://business.facebook.com/adsmanager";
  const url = new URL("https://business.facebook.com/adsmanager/manage/campaigns");
  url.searchParams.set("act", account);
  if (metaCampaignId) url.searchParams.set("selected_campaign_ids", metaCampaignId);
  return url.toString();
}

export function metaBillingUrl() {
  const account = getMetaConnectionSummary().adAccountId;
  const url = new URL("https://business.facebook.com/billing_hub/accounts/details/");
  if (account) url.searchParams.set("act", account);
  return url.toString();
}
