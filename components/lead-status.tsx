import type { LeadStatus } from "@/generated/prisma/client";
import { leadStatusLabels } from "@/lib/crm";

const styles: Record<LeadStatus, string> = {
  NEW: "bg-[#eef6fd] text-[#1769a8]",
  CONTACTED: "bg-[#f5f1e7] text-[#80601f]",
  BOOKED: "bg-[#eeeafb] text-[#65519b]",
  COMPLETED: "bg-[#edf6e8] text-[#4e7336]",
  LOST: "bg-[#f4eeee] text-[#89524f]",
  SPAM: "bg-[#efefef] text-[#696969]",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}>{leadStatusLabels[status]}</span>;
}
