"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";
import { sendLeadConfirmation, sendLeadNotification } from "@/lib/email";
import { getConfiguredNotificationEmails } from "@/lib/notification-recipients";
import { deleteRemoteMetaAd, setRemoteMetaAdStatus } from "@/lib/meta-ads";
import {
  CampaignMediaError,
  hasCampaignImageUpload,
  hasCampaignMediaUpload,
  removeCampaignMedia,
  saveCampaignGalleryMedia,
  saveCampaignImage,
} from "@/lib/campaign-media";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function updateLeadNotificationRecipients(formData: FormData) {
  const configuredEmails = getConfiguredNotificationEmails();
  const requestedEmails = new Set(
    formData.getAll("recipient").map((value) => String(value).trim().toLowerCase()),
  );

  await prisma.$transaction(
    configuredEmails.map((email) => prisma.leadNotificationRecipient.upsert({
      where: { email },
      create: { email, enabled: requestedEmails.has(email) },
      update: { enabled: requestedEmails.has(email) },
    })),
  );

  revalidatePath("/admin/nastavenia");
  redirect("/admin/nastavenia?saved=1");
}

const campaignImageFields = [
  { file: "imageFile", url: "imageUrl" },
  { file: "offerImageFile", url: "offerImageUrl" },
] as const;

const legacyCampaignImageUrlFields = ["galleryImage1Url", "galleryImage2Url", "galleryImage3Url"] as const;
const maxGalleryItems = 20;
const maxUploadBatchSize = 20 * 1024 * 1024;

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

async function removeCampaignMediaFiles(mediaUrls: Array<string | null | undefined>) {
  for (const mediaUrl of mediaUrls) {
    if (mediaUrl) await removeCampaignMedia(mediaUrl);
  }
}

async function uploadedCampaignMedia(formData: FormData, errorPath: string, galleryPlaces: number) {
  const uploaded: UploadedCampaignImages = {};
  const galleryItems: Array<{ mediaType: "IMAGE" | "VIDEO"; mediaUrl: string }> = [];

  try {
    const uploadValues = [
      ...campaignImageFields.map((field) => formData.get(field.file)),
      ...formData.getAll("galleryMediaFiles"),
    ].filter(hasCampaignMediaUpload);
    const uploadSize = uploadValues.reduce((total, file) => total + file.size, 0);
    if (uploadSize > maxUploadBatchSize) {
      throw new CampaignMediaError("Naraz môžete nahrať najviac 20 MB. Ďalšie súbory pridajte po uložení kampane.");
    }

    for (const field of campaignImageFields) {
      const imageUrl = await saveCampaignImage(formData.get(field.file));
      if (imageUrl) uploaded[field.url] = imageUrl;
    }
    for (const value of formData.getAll("galleryMediaFiles")) {
      if (!hasCampaignMediaUpload(value)) continue;
      if (galleryItems.length >= galleryPlaces) {
        throw new CampaignMediaError(`Galéria môže obsahovať najviac ${maxGalleryItems} položiek.`);
      }
      const item = await saveCampaignGalleryMedia(value);
      if (item) galleryItems.push(item);
    }
    return { images: uploaded, galleryItems };
  } catch (error) {
    await removeCampaignMediaFiles([...Object.values(uploaded), ...galleryItems.map((item) => item.mediaUrl)]);
    if (error instanceof CampaignMediaError) {
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
  const uploadedMedia = await uploadedCampaignMedia(formData, "/admin/kampane/nova", maxGalleryItems);
  const images = campaignImageData(data, uploadedMedia.images);

  try {
    await prisma.campaign.create({
      data: {
        ...data,
        ...images,
        galleryItems: {
          create: uploadedMedia.galleryItems.map((item, sortOrder) => ({ ...item, sortOrder })),
        },
      },
    });
  } catch (error) {
    await removeCampaignMediaFiles([...Object.values(uploadedMedia.images), ...uploadedMedia.galleryItems.map((item) => item.mediaUrl)]);
    throw error;
  }
  revalidatePath("/admin");
  redirect("/admin?created=1");
}

export async function updateCampaign(id: string, formData: FormData) {
  const data = campaignInput(formData);
  const currentCampaign = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: {
      metaAd: true,
      galleryItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (currentCampaign.metaAd?.metaCampaignId && data.slug !== currentCampaign.slug) {
    redirect(`/admin/kampane/${id}?error=Adresu+stránky+nie+je+možné+zmeniť,+kým+je+na+ňu+napojená+Meta+reklama.`);
  }
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
  const requestedGalleryIds = new Set(formData.getAll("galleryItemId").map(String));
  const retainedGalleryItems = currentCampaign.galleryItems.filter((item) => requestedGalleryIds.has(item.id));
  const removedGalleryItems = currentCampaign.galleryItems.filter((item) => !requestedGalleryIds.has(item.id));
  const uploadedMedia = await uploadedCampaignMedia(
    formData,
    `/admin/kampane/${id}`,
    maxGalleryItems - retainedGalleryItems.length,
  );
  const images = campaignImageData(data, uploadedMedia.images, currentCampaign.imageUrl);

  try {
    const galleryUpdates = retainedGalleryItems.map((item, sortOrder) => prisma.campaignGalleryItem.update({
      where: { id: item.id },
      data: { sortOrder },
    }));
    const galleryCreates = uploadedMedia.galleryItems.length > 0
      ? [prisma.campaignGalleryItem.createMany({
        data: uploadedMedia.galleryItems.map((item, index) => ({
          campaignId: id,
          ...item,
          sortOrder: retainedGalleryItems.length + index,
        })),
      })]
      : [];

    await prisma.$transaction([
      prisma.campaign.update({ where: { id }, data: { ...data, ...images } }),
      ...galleryUpdates,
      prisma.campaignGalleryItem.deleteMany({
        where: { id: { in: removedGalleryItems.map((item) => item.id) } },
      }),
      ...galleryCreates,
    ]);
  } catch (error) {
    await removeCampaignMediaFiles([...Object.values(uploadedMedia.images), ...uploadedMedia.galleryItems.map((item) => item.mediaUrl)]);
    throw error;
  }

  const previousImages = campaignImageFields.map((field) => currentCampaign[field.url]);
  const nextImages = new Set([
    ...Object.values(images),
    ...retainedGalleryItems.map((item) => item.mediaUrl),
    ...uploadedMedia.galleryItems.map((item) => item.mediaUrl),
  ]);
  const replacedImages = [...new Set([
    ...previousImages,
    ...removedGalleryItems.map((item) => item.mediaUrl),
  ].filter((imageUrl) => imageUrl && !nextImages.has(imageUrl)))];
  if (replacedImages.length > 0) {
    try {
      await removeCampaignMediaFiles(replacedImages);
    } catch (error) {
      console.error(`Pôvodné súbory kampane ${id} sa nepodarilo odstrániť:`, error);
    }
  }
  revalidatePath("/admin");
  revalidatePath(`/kampan/${currentCampaign.slug}`);
  revalidatePath(`/kampan/${data.slug}`);
  redirect(`/admin/kampane/${id}?saved=1`);
}

export async function toggleCampaign(id: string) {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: { metaAd: true },
  });
  if (
    campaign.isActive
    && campaign.metaAd?.metaCampaignId
    && campaign.metaAd.metaAdSetId
    && campaign.metaAd.metaAdId
    && campaign.metaAd.status === "ACTIVE"
  ) {
    await setRemoteMetaAdStatus({
      campaignId: campaign.metaAd.metaCampaignId,
      adSetId: campaign.metaAd.metaAdSetId,
      adId: campaign.metaAd.metaAdId,
    }, "PAUSED");
    await prisma.metaAdCampaign.update({
      where: { id: campaign.metaAd.id },
      data: { status: "PAUSED", effectiveStatus: "PAUSED" },
    });
  }
  await prisma.campaign.update({
    where: { id },
    data: { isActive: !campaign.isActive },
  });
  revalidatePath("/admin");
  revalidatePath(`/kampan/${campaign.slug}`);
}

export async function deleteCampaign(id: string) {
  const metaAd = await prisma.metaAdCampaign.findUnique({ where: { campaignId: id } });
  if (metaAd?.metaCampaignId) await deleteRemoteMetaAd(metaAd.metaCampaignId);
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: { galleryItems: true },
  });
  await prisma.campaign.delete({ where: { id } });
  try {
    await removeCampaignMediaFiles([
      ...campaignImageFields.map((field) => campaign[field.url]),
      ...legacyCampaignImageUrlFields.map((field) => campaign[field]),
      ...campaign.galleryItems.map((item) => item.mediaUrl),
    ]);
  } catch (error) {
    console.error(`Súbory kampane ${id} sa nepodarilo odstrániť:`, error);
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

  const emailData = {
    leadId: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    interestType: lead.interestType,
    note: lead.note,
    campaignName: campaign.name,
    campaignSlug: campaign.slug,
    createdAt: lead.createdAt,
  };
  const [adminNotification, customerConfirmation] = await Promise.allSettled([
    sendLeadNotification(emailData),
    sendLeadConfirmation({
      ...emailData,
      campaignEmail: campaign.email,
      campaignPhone: campaign.phone,
    }),
  ]);

  if (adminNotification.status === "rejected") {
    console.error(`Admin notifikáciu pre lead ${lead.id} sa nepodarilo odoslať:`, adminNotification.reason);
  }
  if (customerConfirmation.status === "rejected") {
    console.error(`Potvrdenie pre lead ${lead.id} sa nepodarilo odoslať:`, customerConfirmation.reason);
  }

  const confirmationSent = customerConfirmation.status === "fulfilled" && customerConfirmation.value.sent;

  revalidatePath("/admin");
  revalidatePath("/admin/leady");
  return {
    success: true,
    message: confirmationSent
      ? "Potvrdenie sme poslali na zadaný e-mail. Čoskoro sa vám ozveme."
      : "Ďakujeme, čoskoro sa vám ozveme.",
  };
}
