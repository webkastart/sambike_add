import { requireAdmin } from "@/lib/admin-auth";
import { attributionSource, csvCell, leadStatusLabels } from "@/lib/crm";
import { formatDate } from "@/lib/format";
import { leadListQuery, type LeadSearchParams } from "@/lib/lead-query";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  await requireAdmin();
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams) as LeadSearchParams;
  const { where, orderBy } = leadListQuery(params);
  const leads = await prisma.lead.findMany({ where, orderBy, include: { campaign: { select: { name: true } } }, take: 10_000 });
  const header = ["Kampaň", "Stav", "Meno", "Telefón", "E-mail", "Dátum", "Zdroj", "UTM source", "UTM medium", "UTM campaign", "UTM content", "UTM term", "Dôvod straty", "Hodnota zákazky (centy)", "Mena"];
  const rows = leads.map((lead) => [
    lead.campaign.name, leadStatusLabels[lead.status], lead.name, lead.phone, lead.email,
    formatDate(lead.createdAt), attributionSource(lead), lead.utmSource, lead.utmMedium,
    lead.utmCampaign, lead.utmContent, lead.utmTerm, lead.lostReason,
    lead.completedValueCents, lead.completedValueCurrency,
  ]);
  const csv = `sep=;\r\n${[header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  return new Response(`\uFEFF${csv}`, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="sambike-leady-${new Date().toISOString().slice(0, 10)}.csv"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  } });
}
