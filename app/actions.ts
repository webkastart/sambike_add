"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";
import { sendLeadNotification } from "@/lib/email";
import {
  CampaignImageError,
  hasCampaignImageUpload,
  removeCampaignImage,
  saveCampaignImage,
} from "@/lib/campaign-image";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

const campaignImageFields = [
  { file: "imageFile", url: "imageUrl" },
  { file: "offerImageFile", url: "offerImageUrl" },
  { file: "galleryImage1File", url: "galleryImage1Url" },
  { file: "galleryImage2File", url: "galleryImage2Url" },
  { file: "galleryImage3File", url: "galleryImage3Url" },
] as const;

type CampaignImageUrlField = (typeof campaignImageFields)[number]["url"];
type UploadedCampaignImages = Partial<Record<CampaignImageUrlField, string>>;

function campaignInput(formData: FormData) {
  return {
    name: text(formData, "name"),
    slug: slugify(text(formData, "slug") || text(formData, "name")),
    headline: text(formData, "headline"),
    description: text(formData, "description"),
    imageUrl: text(formData, "imageUrl"),
    offerImageUrl: text(formData, "offerImageUrl"),
    galleryImage1Url: text(formData, "galleryImage1Url"),
    galleryImage2Url: text(formData, "galleryImage2Url"),
    galleryImage3Url: text(formData, "galleryImage3Url"),
    priceText: text(formData, "priceText"),
    ctaText: text(formData, "ctaText"),
    offerType: text(formData, "offerType"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    formEnabled: formData.get("formEnabled") === "on",
    isActive: formData.get("isActive") === "on",
  };
}

function hasRequiredCampaignData(data: ReturnType<typeof campaignInput>, hasImage: boolean) {
  const hasTextData = Object.entries(data)
    .filter(([key]) => !["formEnabled", "isActive", ...campaignImageFields.map((field) => field.url)].includes(key))
    .every(([, value]) => Boolean(value));

  return hasTextData && (Boolean(data.imageUrl) || hasImage);
}

async function removeCampaignImages(imageUrls: Array<string | null | undefined>) {
  for (const imageUrl of imageUrls) {
    if (imageUrl) await removeCampaignImage(imageUrl);
  }
}

async function uploadedCampaignImages(formData: FormData, errorPath: string) {
  const uploaded: UploadedCampaignImages = {};

  try {
    for (const field of campaignImageFields) {
      const imageUrl = await saveCampaignImage(formData.get(field.file));
      if (imageUrl) uploaded[field.url] = imageUrl;
    }
    return uploaded;
  } catch (error) {
    await removeCampaignImages(Object.values(uploaded));
    if (error instanceof CampaignImageError) {
      redirect(`${errorPath}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

function campaignImageData(
  data: ReturnType<typeof campaignInput>,
  uploaded: UploadedCampaignImages,
  currentImageUrl = "",
) {
  return {
    imageUrl: uploaded.imageUrl || data.imageUrl || currentImageUrl,
    offerImageUrl: uploaded.offerImageUrl || data.offerImageUrl || null,
    galleryImage1Url: uploaded.galleryImage1Url || data.galleryImage1Url || null,
    galleryImage2Url: uploaded.galleryImage2Url || data.galleryImage2Url || null,
    galleryImage3Url: uploaded.galleryImage3Url || data.galleryImage3Url || null,
  };
}

export async function createCampaign(formData: FormData) {
  const data = campaignInput(formData);
  const hasImage = hasCampaignImageUpload(formData.get("imageFile"));
  if (!hasRequiredCampaignData(data, hasImage)) {
    redirect("/admin/kampane/nova?error=Vyplňte+všetky+povinné+polia.");
  }
  const existing = await prisma.campaign.findUnique({ where: { slug: data.slug } });
  if (existing) {
    redirect("/admin/kampane/nova?error=Táto+adresa+stránky+sa+už+používa.");
  }
  const uploadedImages = await uploadedCampaignImages(formData, "/admin/kampane/nova");
  const images = campaignImageData(data, uploadedImages);

  try {
    await prisma.campaign.create({ data: { ...data, ...images } });
  } catch (error) {
    await removeCampaignImages(Object.values(uploadedImages));
    throw error;
  }
  revalidatePath("/admin");
  redirect("/admin?created=1");
}

export async function updateCampaign(id: string, formData: FormData) {
  const data = campaignInput(formData);
  const currentCampaign = await prisma.campaign.findUniqueOrThrow({ where: { id } });
  const hasImage = hasCampaignImageUpload(formData.get("imageFile"));
  if (!hasRequiredCampaignData(data, hasImage || Boolean(currentCampaign.imageUrl))) {
    redirect(`/admin/kampane/${id}?error=Vyplňte+všetky+povinné+polia.`);
  }
  const existing = await prisma.campaign.findFirst({
    where: { slug: data.slug, NOT: { id } },
  });
  if (existing) {
    redirect(`/admin/kampane/${id}?error=Táto+adresa+stránky+sa+už+používa.`);
  }
  const uploadedImages = await uploadedCampaignImages(formData, `/admin/kampane/${id}`);
  const images = campaignImageData(data, uploadedImages, currentCampaign.imageUrl);

  try {
    await prisma.campaign.update({ where: { id }, data: { ...data, ...images } });
  } catch (error) {
    await removeCampaignImages(Object.values(uploadedImages));
    throw error;
  }

  const previousImages = campaignImageFields.map((field) => currentCampaign[field.url]);
  const nextImages = Object.values(images);
  const replacedImages = [...new Set(previousImages.filter((imageUrl) => imageUrl && !nextImages.includes(imageUrl)))];
  if (replacedImages.length > 0) {
    try {
      await removeCampaignImages(replacedImages);
    } catch (error) {
      console.error(`Pôvodné obrázky kampane ${id} sa nepodarilo odstrániť:`, error);
    }
  }
  revalidatePath("/admin");
  revalidatePath(`/kampan/${currentCampaign.slug}`);
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
  const campaign = await prisma.campaign.delete({ where: { id } });
  try {
    await removeCampaignImages(campaignImageFields.map((field) => campaign[field.url]));
  } catch (error) {
    console.error(`Obrázky kampane ${id} sa nepodarilo odstrániť:`, error);
  }
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
  const note = text(formData, "note");
  const consent = formData.get("consent") === "on";

  if (!campaignId || !name || !phone || !consent) {
    return { success: false, message: "Vyplňte meno a telefón a potvrďte súhlas so spracovaním údajov." };
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign?.isActive || !campaign.formEnabled) {
    return { success: false, message: "Formulár už nie je dostupný. Ozvite sa nám telefonicky alebo e-mailom." };
  }

  const lead = await prisma.lead.create({
    data: {
      campaignId,
      name,
      phone,
      email: email || null,
      interestType: campaign.offerType,
      note: note || null,
      consent,
      campaignSlug: campaign.slug,
      utmSource: text(formData, "utmSource").slice(0, 255) || null,
      utmMedium: text(formData, "utmMedium").slice(0, 255) || null,
      utmCampaign: text(formData, "utmCampaign").slice(0, 255) || null,
      utmContent: text(formData, "utmContent").slice(0, 255) || null,
      utmTerm: text(formData, "utmTerm").slice(0, 255) || null,
      landingPage: text(formData, "landingPage").slice(0, 2000) || null,
      referrer: text(formData, "referrer").slice(0, 2000) || null,
    },
  });

  try {
    await sendLeadNotification({
      leadId: lead.id,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      interestType: lead.interestType,
      note: lead.note,
      campaignName: campaign.name,
      campaignSlug: campaign.slug,
      createdAt: lead.createdAt,
    });
  } catch (error) {
    console.error(`Notifikáciu pre lead ${lead.id} sa nepodarilo odoslať:`, error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/leady");
  return { success: true, message: "Ďakujeme, čoskoro sa vám ozveme." };
}
