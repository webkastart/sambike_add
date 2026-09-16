import type { Prisma } from "@/generated/prisma/client";
import { isLeadStatus } from "@/lib/crm";
import { fromBratislavaLocal, nextBratislavaDayStart } from "@/lib/date-range";

export type LeadSearchParams = {
  q?: string;
  kampan?: string;
  stav?: string;
  zdroj?: string;
  od?: string;
  do?: string;
  kontakt?: string;
  sort?: string;
  strana?: string;
};

export const leadsPerPage = 25;

export function leadListQuery(params: LeadSearchParams, now = new Date()) {
  const and: Prisma.LeadWhereInput[] = [];
  const q = params.q?.trim().slice(0, 100);
  if (q) {
    and.push({ OR: [
      { name: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
    ] });
  }
  if (params.kampan) and.push({ campaignId: params.kampan });
  if (params.stav && isLeadStatus(params.stav)) and.push({ status: params.stav });
  const source = params.zdroj?.trim().slice(0, 100);
  if (source) {
    and.push({ OR: [
      { utmSource: { contains: source, mode: "insensitive" } },
      { utmMedium: { contains: source, mode: "insensitive" } },
      { utmCampaign: { contains: source, mode: "insensitive" } },
      { referrer: { contains: source, mode: "insensitive" } },
    ] });
  }
  const start = params.od ? fromBratislavaLocal(params.od) : null;
  const end = params.do ? nextBratislavaDayStart(params.do) : null;
  if (start || end) {
    and.push({ createdAt: { gte: start ?? undefined, lt: end ?? undefined } });
  }
  if (params.kontakt === "potrebuje") {
    and.push({ status: { notIn: ["COMPLETED", "LOST", "SPAM"] }, OR: [{ status: "NEW" }, { nextFollowUpAt: { lte: now } }] });
  }
  if (params.kontakt === "po-termine") and.push({ status: { notIn: ["COMPLETED", "LOST", "SPAM"] }, nextFollowUpAt: { lt: now } });

  const sort = params.sort === "oldest" || params.sort === "followup" ? params.sort : "newest";
  const orderBy: Prisma.LeadOrderByWithRelationInput[] = sort === "oldest"
    ? [{ createdAt: "asc" }]
    : sort === "followup"
      ? [{ nextFollowUpAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }];
  const requestedPage = Number.parseInt(params.strana ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  return { where: and.length ? { AND: and } : {}, orderBy, page, sort };
}

export function leadQueryString(params: LeadSearchParams, overrides: Record<string, string | number | undefined> = {}) {
  const values = { ...params, ...overrides };
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "" && value !== "1") query.set(key, String(value));
  }
  return query.toString();
}
