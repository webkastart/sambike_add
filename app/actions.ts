"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function campaignInput(formData: FormData) {
  return {
    name: text(formData, "name"),
    slug: slugify(text(formData, "slug") || text(formData, "name")),
    headline: text(formData, "headline"),
    description: text(formData, "description"),
    imageUrl: text(formData, "imageUrl"),
    priceText: text(formData, "priceText"),
    ctaText: text(formData, "ctaText"),
    offerType: text(formData, "offerType"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    formEnabled: formData.get("formEnabled") === "on",
    isActive: formData.get("isActive") === "on",
  };
}

function hasRequiredCampaignData(data: ReturnType<typeof campaignInput>) {
  return Object.entries(data)
    .filter(([key]) => !["formEnabled", "isActive"].includes(key))
    .every(([, value]) => Boolean(value));
}

export async function createCampaign(formData: FormData) {
  const data = campaignInput(formData);
  if (!hasRequiredCampaignData(data)) {
    redirect("/admin/kampane/nova?error=Vyplňte+všetky+povinné+polia");
  }
  const existing = await prisma.campaign.findUnique({ where: { slug: data.slug } });
  if (existing) {
    redirect("/admin/kampane/nova?error=Táto+URL+sa+už+používa");
  }
  await prisma.campaign.create({ data });
  revalidatePath("/admin");
  redirect("/admin?created=1");
}

export async function updateCampaign(id: string, formData: FormData) {
  const data = campaignInput(formData);
  if (!hasRequiredCampaignData(data)) {
    redirect(`/admin/kampane/${id}?error=Vyplňte+všetky+povinné+polia`);
  }
  const existing = await prisma.campaign.findFirst({
    where: { slug: data.slug, NOT: { id } },
  });
  if (existing) {
    redirect(`/admin/kampane/${id}?error=Táto+URL+sa+už+používa`);
  }
  await prisma.campaign.update({ where: { id }, data });
  revalidatePath("/admin");
  revalidatePath(`/kampan/${data.slug}`);
  redirect(`/admin/kampane/${id}?saved=1`);
}

export async function toggleCampaign(id: string) {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id } });
  await prisma.campaign.update({
    where: { id },
    data: { isActive: !campaign.isActive },
  });
  revalidatePath("/admin");
  revalidatePath(`/kampan/${campaign.slug}`);
}

export async function deleteCampaign(id: string) {
  await prisma.campaign.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/admin/leady");
  redirect("/admin?deleted=1");
}

export type LeadFormState = {
  success: boolean;
  message: string;
};

export async function createLead(
  _previousState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  const campaignId = text(formData, "campaignId");
  const name = text(formData, "name");
  const phone = text(formData, "phone");
  const email = text(formData, "email");
  const interestType = text(formData, "interestType");
  const note = text(formData, "note");
  const consent = formData.get("consent") === "on";

  if (!campaignId || !name || !phone || !interestType || !consent) {
    return { success: false, message: "Skontrolujte povinné polia a súhlas." };
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign?.isActive || !campaign.formEnabled) {
    return { success: false, message: "Formulár už nie je dostupný." };
  }

  await prisma.lead.create({
    data: {
      campaignId,
      name,
      phone,
      email: email || null,
      interestType,
      note: note || null,
      consent,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/leady");
  return { success: true, message: "Ďakujeme. Ozveme sa vám čo najskôr." };
}
