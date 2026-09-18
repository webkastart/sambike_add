"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/format";
import { getConfiguredNotificationEmails } from "@/lib/notification-recipients";
import { setRemoteMetaAdStatus } from "@/lib/meta-ads";
import {
  type CampaignGalleryMediaType,
  CampaignMediaError,
  hasCampaignImageUpload,
  hasCampaignMediaUpload,
  removeCampaignMedia,
  saveCampaignGalleryMedia,
  saveCampaignImage,
  validateUploadedCampaignMedia,
} from "@/lib/campaign-media";
import { maxFallbackUploadBatchSize } from "@/lib/campaign-media-limits";
import { requireAdmin } from "@/lib/admin-auth";
import { processEmailOutbox } from "@/lib/email-outbox";
import { leadDedupeKey, verifyLeadFormToken } from "@/lib/lead-protection";
import { normalizePhone, parseLeadSubmission } from "@/lib/lead-validation";
import { consumeRateLimit, requestIp } from "@/lib/rate-limit";
import { privacyPolicyVersion } from "@/lib/security-config";
import { configuredMetaPixelId, setMetaPixelEnabled } from "@/lib/meta-pixel";
import { verifyTurnstile } from "@/lib/turnstile";
import type { CampaignSectionType, Prisma } from "@/generated/prisma/client";
import {
  legacyCampaignSections,
  parseCampaignSections,
  sectionContentString,
  type EditableCampaignSection,
} from "@/lib/campaign-sections";
import {
  canTransitionCampaign,
  campaignReadiness,
  parseFaq,
  parseBratislavaDateTime,
  parseStructuredItems,
  parseTestimonials,
  publicationSnapshot,
  snapshotFields,
  type CampaignStatusValue,
} from "@/lib/campaign-workflow";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function updateLeadNotificationRecipients(formData: FormData) {
  await requireAdmin();
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

export async function updateMetaPixelSetting(formData: FormData) {
  await requireAdmin();
  const enabled = formData.get("metaPixelEnabled") === "on";

  if (enabled && !configuredMetaPixelId()) {
    redirect("/admin/nastavenia?pixelError=missing");
  }

  await setMetaPixelEnabled(enabled);
  revalidatePath("/admin/nastavenia");
  redirect("/admin/nastavenia?pixelSaved=1");
}

const campaignImageFields = [
  { file: "imageFile", uploaded: "imageUploadedMedia", url: "imageUrl" },
  { file: "offerImageFile", uploaded: "offerImageUploadedMedia", url: "offerImageUrl" },
] as const;

const maxGalleryItems = 20;

type CampaignImageUrlField = (typeof campaignImageFields)[number]["url"];
type UploadedCampaignImages = Partial<Record<CampaignImageUrlField, string>>;
type CampaignMediaPlacement = "HERO" | "OFFER" | "BEFORE" | "AFTER" | "GALLERY";
type CampaignGalleryInput = {
  mediaType: "IMAGE" | "VIDEO";
  mediaUrl: string;
  caption: string;
  placement: CampaignMediaPlacement;
  sortOrder: number;
};

function campaignInput(formData: FormData) {
  return {
    name: text(formData, "name").slice(0, 120),
    slug: slugify(text(formData, "slug") || text(formData, "name")),
    headline: text(formData, "headline").slice(0, 160),
    description: text(formData, "description").slice(0, 800),
    imageUrl: text(formData, "imageUrl"),
    offerImageUrl: text(formData, "offerImageUrl"),
    priceText: text(formData, "priceText").slice(0, 180),
    ctaText: text(formData, "ctaText").slice(0, 80),
    offerType: text(formData, "offerType").slice(0, 100),
    phone: text(formData, "phone").slice(0, 30),
    email: text(formData, "email").slice(0, 254),
    formEnabled: formData.get("formEnabled") === "on",
    benefits: parseStructuredItems(text(formData, "benefits")),
    processSteps: parseStructuredItems(text(formData, "processSteps")),
    faq: parseFaq(text(formData, "faq")),
    testimonials: parseTestimonials(text(formData, "testimonials")),
    openingHours: text(formData, "openingHours").slice(0, 300) || null,
    address: text(formData, "address").slice(0, 300) || null,
    mapUrl: text(formData, "mapUrl").slice(0, 1000) || null,
    trustText: text(formData, "trustText").slice(0, 500) || null,
    responseTimeText: text(formData, "responseTimeText").slice(0, 200) || null,
    finalCtaText: text(formData, "finalCtaText").slice(0, 180) || null,
    sectionOrder: ["benefits", "process", "offer", "gallery", "faq", "testimonials", "form"],
    seoTitle: text(formData, "seoTitle").slice(0, 70) || null,
    seoDescription: text(formData, "seoDescription").slice(0, 180) || null,
    canonicalUrl: text(formData, "canonicalUrl").slice(0, 1000) || null,
    ogTitle: text(formData, "ogTitle").slice(0, 100) || null,
    ogDescription: text(formData, "ogDescription").slice(0, 300) || null,
    ogImageUrl: text(formData, "ogImageUrl").slice(0, 1000) || null,
    noIndex: formData.get("noIndex") === "on",
    legalUrl: text(formData, "legalUrl").slice(0, 1000) || "/ochrana-osobnych-udajov",
  };
}

function hasRequiredCampaignData(data: ReturnType<typeof campaignInput>, hasImage: boolean) {
  const hasTextData = Object.entries(data)
    .filter(([key]) => ["name", "slug", "headline", "description", "priceText", "ctaText", "offerType", "phone", "email"].includes(key))
    .every(([, value]) => Boolean(value));

  return hasTextData && (Boolean(data.imageUrl) || hasImage);
}

function hasSubmittedCampaignImage(formData: FormData) {
  const heroField = campaignImageFields[0];
  return (
    hasCampaignImageUpload(formData.get(heroField.file))
    || typeof formData.get(heroField.uploaded) === "string"
  );
}

function preparedMedia(value: FormDataEntryValue | null) {
  if (typeof value !== "string") throw new CampaignMediaError("Nahraný súbor má neplatné údaje.");

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    throw new CampaignMediaError("Nahraný súbor má neplatné údaje.");
  }
}

function galleryCaption(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 240) : "";
}

function galleryPlacement(value: unknown, mediaType: "IMAGE" | "VIDEO"): CampaignMediaPlacement {
  if (mediaType === "VIDEO") return "GALLERY";
  return value === "HERO" || value === "OFFER" || value === "BEFORE" || value === "AFTER" ? value : "GALLERY";
}

function gallerySortOrder(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < maxGalleryItems
    ? value
    : fallback;
}

function uniqueGalleryPlacements<T extends { mediaType: string; placement: CampaignMediaPlacement }>(items: T[]) {
  const occupied = new Set<CampaignMediaPlacement>();
  return items.map((item) => {
    if (item.mediaType === "VIDEO" || item.placement === "GALLERY" || occupied.has(item.placement)) {
      return { ...item, placement: "GALLERY" as const };
    }
    occupied.add(item.placement);
    return item;
  });
}

async function removeCampaignMediaFiles(mediaUrls: Array<string | null | undefined>) {
  for (const mediaUrl of mediaUrls) {
    if (mediaUrl) await removeCampaignMedia(mediaUrl);
  }
}

async function removeCampaignMediaIfUnreferenced(mediaUrls: Array<string | null | undefined>) {
  for (const mediaUrl of mediaUrls) {
    if (!mediaUrl) continue;
    const [campaignReferences, galleryReferences] = await Promise.all([
      prisma.campaign.count({ where: { OR: [
        { imageUrl: mediaUrl }, { offerImageUrl: mediaUrl }, { galleryImage1Url: mediaUrl }, { galleryImage2Url: mediaUrl }, { galleryImage3Url: mediaUrl }, { ogImageUrl: mediaUrl },
      ] } }),
      prisma.campaignGalleryItem.count({ where: { mediaUrl } }),
    ]);
    if (campaignReferences === 0 && galleryReferences === 0) await removeCampaignMedia(mediaUrl);
  }
}

async function cleanupUploadedCampaignMedia(mediaUrls: Array<string | null | undefined>, context: string) {
  try {
    await removeCampaignMediaFiles(mediaUrls);
  } catch (error) {
    console.error(`${context}: dočasne nahrané súbory sa nepodarilo odstrániť:`, error);
  }
}

function redirectWithCampaignError(errorPath: string, message: string): never {
  redirect(`${errorPath}?error=${encodeURIComponent(message)}`);
}

function uploadErrorMessage(error: unknown) {
  if (error instanceof CampaignMediaError) return error.message;
  console.error("Campaign media upload failed:", error);
  return "Nahrávanie súboru zlyhalo. Skontrolujte formát a veľkosť súboru alebo to skúste znova.";
}

async function uploadedCampaignMedia(formData: FormData, errorPath: string, galleryPlaces: number) {
  const uploaded: UploadedCampaignImages = {};
  const galleryItems: CampaignGalleryInput[] = [];
  const cleanupUrls = new Set<string>();

  try {
    for (const field of campaignImageFields) {
      const value = formData.get(field.uploaded);
      if (value === null) continue;

      const input = preparedMedia(value);
      if (input.mediaType !== "IMAGE" || typeof input.mediaUrl !== "string") {
        throw new CampaignMediaError("Nahraný obrázok má neplatné údaje.");
      }
      const item = await validateUploadedCampaignMedia(input.mediaUrl, "IMAGE");
      uploaded[field.url] = item.mediaUrl;
      cleanupUrls.add(item.mediaUrl);
    }

    for (const [fieldName, shouldCleanup] of [["galleryLibraryMedia", false], ["galleryUploadedMedia", true]] as const) {
      for (const value of formData.getAll(fieldName)) {
        const input = preparedMedia(value);
        if (
          (input.mediaType !== "IMAGE" && input.mediaType !== "VIDEO")
          || typeof input.mediaUrl !== "string"
          || galleryItems.length >= galleryPlaces
        ) {
          throw new CampaignMediaError(
            galleryItems.length >= galleryPlaces
              ? `Galéria môže obsahovať najviac ${maxGalleryItems} položiek.`
              : "Nahraný súbor má neplatné údaje.",
          );
        }

        const item = await validateUploadedCampaignMedia(
          input.mediaUrl,
          input.mediaType as CampaignGalleryMediaType,
        );
        galleryItems.push({
          mediaType: item.mediaType,
          mediaUrl: item.mediaUrl,
          caption: galleryCaption(input.caption),
          placement: galleryPlacement(input.placement, item.mediaType),
          sortOrder: gallerySortOrder(input.sortOrder, galleryItems.length),
        });
        if (shouldCleanup) cleanupUrls.add(item.mediaUrl);
      }
    }

    const uploadValues = [
      ...campaignImageFields.map((field) => formData.get(field.file)),
      ...formData.getAll("galleryMediaFiles"),
    ].filter(hasCampaignMediaUpload);
    const uploadSize = uploadValues.reduce((total, file) => total + file.size, 0);
    if (uploadSize > maxFallbackUploadBatchSize) {
      throw new CampaignMediaError("Naraz môžete nahrať najviac 20 MB. Ďalšie súbory pridajte po uložení kampane.");
    }

    for (const field of campaignImageFields) {
      if (uploaded[field.url] && hasCampaignMediaUpload(formData.get(field.file))) {
        throw new CampaignMediaError("Obrázok bol odoslaný duplicitne. Obnovte stránku a skúste to znova.");
      }
      const imageUrl = await saveCampaignImage(formData.get(field.file));
      if (imageUrl) {
        uploaded[field.url] = imageUrl;
        cleanupUrls.add(imageUrl);
      }
    }
    const newItemMetadata = formData.getAll("galleryNewItemData").map(preparedMedia);
    let fallbackIndex = 0;
    for (const value of formData.getAll("galleryMediaFiles")) {
      if (!hasCampaignMediaUpload(value)) continue;
      if (galleryItems.length >= galleryPlaces) {
        throw new CampaignMediaError(`Galéria môže obsahovať najviac ${maxGalleryItems} položiek.`);
      }
      const item = await saveCampaignGalleryMedia(value);
      const metadata = newItemMetadata[fallbackIndex] ?? {};
      fallbackIndex += 1;
      if (item) galleryItems.push({
        ...item,
        caption: galleryCaption(metadata.caption),
        placement: galleryPlacement(metadata.placement, item.mediaType),
        sortOrder: gallerySortOrder(metadata.sortOrder, galleryItems.length),
      });
      if (item) cleanupUrls.add(item.mediaUrl);
    }
    return { images: uploaded, galleryItems, cleanupUrls: [...cleanupUrls] };
  } catch (error) {
    await cleanupUploadedCampaignMedia(
      [...cleanupUrls],
      "Campaign media upload failed",
    );
    redirectWithCampaignError(errorPath, uploadErrorMessage(error));
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
  const { actor } = await requireAdmin();
  const data = campaignInput(formData);
  const hasImage = hasSubmittedCampaignImage(formData);
  if (!hasRequiredCampaignData(data, hasImage)) {
    redirect("/admin/kampane/nova?error=Vyplňte+všetky+povinné+polia.");
  }
  const existing = await prisma.campaign.findUnique({ where: { slug: data.slug } });
  if (existing) {
    redirect("/admin/kampane/nova?error=Táto+adresa+stránky+sa+už+používa.");
  }
  const uploadedMedia = await uploadedCampaignMedia(formData, "/admin/kampane/nova", maxGalleryItems);
  const images = campaignImageData(data, uploadedMedia.images);
  const galleryItems = uniqueGalleryPlacements(
    [...uploadedMedia.galleryItems].sort((a, b) => a.sortOrder - b.sortOrder),
  );

  try {
    await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.create({
        data: {
          ...data,
          ...images,
          status: "DRAFT",
          galleryItems: {
            create: galleryItems.map((item, sortOrder) => ({ ...item, sortOrder })),
          },
          auditEntries: { create: { action: "CREATED", actor } },
        },
        include: { galleryItems: true },
      });
      const sections = legacyCampaignSections(campaign);
      await tx.campaignSection.createMany({ data: sections.map((section) => ({
        id: section.id,
        campaignId: campaign.id,
        type: section.type,
        position: section.position,
        isVisible: section.isVisible,
        content: section.content as Prisma.InputJsonValue,
      })) });
      const gallerySection = sections.find((section) => section.type === "GALLERY");
      if (gallerySection) await tx.campaignGalleryItem.updateMany({ where: { campaignId: campaign.id, placement: "GALLERY" }, data: { sectionId: gallerySection.id } });
    });
  } catch (error) {
    await cleanupUploadedCampaignMedia(
      uploadedMedia.cleanupUrls,
      "Campaign create failed",
    );
    console.error("Campaign create failed:", error);
    redirectWithCampaignError("/admin/kampane/nova", "Kampaň sa nepodarilo uložiť. Skúste to znova alebo skontrolujte databázu.");
  }
  revalidatePath("/admin");
  redirect("/admin?created=1");
}

export async function updateCampaign(id: string, formData: FormData) {
  const { actor } = await requireAdmin();
  const data = campaignInput(formData);
  const currentCampaign = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: {
      metaAd: true,
      galleryItems: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (currentCampaign.status === "ARCHIVED") {
    redirect(`/admin/kampane/${id}?error=Archivovanú+kampaň+najprv+obnovte+do+konceptu.`);
  }
  if (currentCampaign.metaAd?.metaCampaignId && data.slug !== currentCampaign.slug) {
    redirect(`/admin/kampane/${id}?error=Adresu+stránky+nie+je+možné+zmeniť,+kým+je+na+ňu+napojená+Meta+reklama.`);
  }
  const hasImage = hasSubmittedCampaignImage(formData);
  if (!hasRequiredCampaignData(data, hasImage || Boolean(currentCampaign.imageUrl))) {
    redirect(`/admin/kampane/${id}?error=Vyplňte+všetky+povinné+polia.`);
  }
  const existing = await prisma.campaign.findFirst({
    where: { slug: data.slug, NOT: { id } },
  });
  if (existing) {
    redirect(`/admin/kampane/${id}?error=Táto+adresa+stránky+sa+už+používa.`);
  }
  const submittedGalleryItems = new Map(
    formData.getAll("galleryItemData").map(preparedMedia).flatMap((input) => {
      if (typeof input.id !== "string") return [];
      return [[input.id, input] as const];
    }),
  );
  const requestedGalleryIds = new Set(submittedGalleryItems.keys());
  const retainedGalleryItems = currentCampaign.galleryItems.filter((item) => requestedGalleryIds.has(item.id));
  const removedGalleryItems = currentCampaign.galleryItems.filter((item) => !requestedGalleryIds.has(item.id));
  const uploadedMedia = await uploadedCampaignMedia(
    formData,
    `/admin/kampane/${id}`,
    maxGalleryItems - retainedGalleryItems.length,
  );
  const images = campaignImageData(data, uploadedMedia.images, currentCampaign.imageUrl);

  try {
    const orderedGalleryItems = uniqueGalleryPlacements([
      ...retainedGalleryItems.map((item, fallbackOrder) => {
        const input = submittedGalleryItems.get(item.id) ?? {};
        return {
          source: "current" as const,
          id: item.id,
          mediaType: item.mediaType === "VIDEO" ? "VIDEO" as const : "IMAGE" as const,
          mediaUrl: item.mediaUrl,
          caption: galleryCaption(input.caption),
          placement: galleryPlacement(input.placement, item.mediaType === "VIDEO" ? "VIDEO" : "IMAGE"),
          sortOrder: gallerySortOrder(input.sortOrder, fallbackOrder),
        };
      }),
      ...uploadedMedia.galleryItems.map((item) => ({ source: "new" as const, ...item })),
    ].sort((a, b) => a.sortOrder - b.sortOrder));
    const galleryUpdates = orderedGalleryItems.flatMap((item, sortOrder) => item.source === "current" ? [prisma.campaignGalleryItem.update({
      where: { id: item.id },
      data: { caption: item.caption || null, placement: item.placement, sortOrder },
    })] : []);
    const newGalleryItems = orderedGalleryItems.filter((item) => item.source === "new");
    const galleryCreates = newGalleryItems.length > 0
      ? [prisma.campaignGalleryItem.createMany({
        data: newGalleryItems.map((item) => ({
          campaignId: id,
          mediaType: item.mediaType,
          mediaUrl: item.mediaUrl,
          caption: item.caption || null,
          placement: item.placement,
          sortOrder: orderedGalleryItems.indexOf(item),
        })),
      })]
      : [];

    await prisma.$transaction([
      prisma.campaign.update({ where: { id }, data: { ...data, ...images } }),
      prisma.campaignAudit.create({ data: { campaignId: id, action: "UPDATED", actor } }),
      ...galleryUpdates,
      prisma.campaignGalleryItem.deleteMany({
        where: { id: { in: removedGalleryItems.map((item) => item.id) } },
      }),
      ...galleryCreates,
    ]);
  } catch (error) {
    await cleanupUploadedCampaignMedia(
      uploadedMedia.cleanupUrls,
      "Campaign update failed",
    );
    console.error(`Campaign update ${id} failed:`, error);
    redirectWithCampaignError(`/admin/kampane/${id}`, "Zmeny sa nepodarilo uložiť. Skúste to znova alebo skontrolujte databázu.");
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
      await removeCampaignMediaIfUnreferenced(replacedImages);
    } catch (error) {
      console.error(`Pôvodné súbory kampane ${id} sa nepodarilo odstrániť:`, error);
    }
  }
  revalidatePath("/admin");
  revalidatePath(`/kampan/${currentCampaign.slug}`);
  revalidatePath(`/kampan/${data.slug}`);
  redirect(`/admin/kampane/${id}?saved=1`);
}

function sectionItems(section: EditableCampaignSection | undefined) {
  return section && Array.isArray(section.content.items) ? section.content.items : [];
}

function legacyDataFromSections(sections: EditableCampaignSection[], campaign: {
  headline: string;
  description: string;
  imageUrl: string;
  offerImageUrl: string | null;
  priceText: string;
  ctaText: string;
  benefits: Prisma.JsonValue | null;
  processSteps: Prisma.JsonValue | null;
  faq: Prisma.JsonValue | null;
  testimonials: Prisma.JsonValue | null;
  finalCtaText: string | null;
}) {
  const first = (type: EditableCampaignSection["type"]) => sections.find((section) => section.type === type);
  const hero = first("HERO");
  const offer = first("OFFER");
  const benefits = first("BENEFITS");
  const faq = first("FAQ");
  const testimonials = first("TESTIMONIALS");
  const cta = first("CTA");
  const form = first("FORM");
  return {
    headline: hero ? sectionContentString(hero.content, "heading", campaign.headline) : campaign.headline,
    description: hero ? sectionContentString(hero.content, "description", campaign.description) : campaign.description,
    imageUrl: hero ? sectionContentString(hero.content, "imageUrl", campaign.imageUrl) : campaign.imageUrl,
    offerImageUrl: offer ? sectionContentString(offer.content, "imageUrl", campaign.offerImageUrl || campaign.imageUrl) : campaign.offerImageUrl,
    priceText: offer ? sectionContentString(offer.content, "priceText", campaign.priceText) : campaign.priceText,
    ctaText: hero ? sectionContentString(hero.content, "ctaLabel", campaign.ctaText) : campaign.ctaText,
    benefits: benefits ? sectionItems(benefits) as Prisma.InputJsonValue : campaign.benefits ?? undefined,
    processSteps: hero && Array.isArray(hero.content.steps) ? hero.content.steps as Prisma.InputJsonValue : campaign.processSteps ?? undefined,
    faq: faq ? sectionItems(faq) as Prisma.InputJsonValue : campaign.faq ?? undefined,
    testimonials: testimonials ? sectionItems(testimonials) as Prisma.InputJsonValue : campaign.testimonials ?? undefined,
    finalCtaText: cta ? sectionContentString(cta.content, "heading", campaign.finalCtaText || "") || null : campaign.finalCtaText,
    formEnabled: Boolean(form?.isVisible),
    sectionOrder: sections.map((section) => section.id),
  };
}

export async function saveCampaignSections(id: string, formData: FormData) {
  const { actor } = await requireAdmin();
  const sections = parseCampaignSections(formData.get("campaignSections"));
  if (!sections || sections.filter((section) => section.type === "HERO").length !== 1) {
    redirectWithCampaignError(`/admin/kampane/${id}`, "Obsah stránky má neplatnú štruktúru. Obnovte stránku a skúste to znova.");
  }
  for (const type of ["GALLERY", "FORM"] as const) {
    if (sections.filter((section) => section.type === type).length > 1) {
      redirectWithCampaignError(`/admin/kampane/${id}`, `Sekciu ${type === "GALLERY" ? "Galéria" : "Formulár"} možno pridať iba raz.`);
    }
  }

  const currentCampaign = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: { sections: true, galleryItems: { orderBy: { sortOrder: "asc" } } },
  });
  if (currentCampaign.status === "ARCHIVED") redirectWithCampaignError(`/admin/kampane/${id}`, "Archivovanú kampaň najprv obnovte do konceptu.");
  const existingSectionIds = new Set(currentCampaign.sections.map((section) => section.id));
  if (sections.some((section) => !existingSectionIds.has(section.id) && !section.id.startsWith("section_") && !section.id.startsWith(`${id}-`))) {
    redirectWithCampaignError(`/admin/kampane/${id}`, "Jedna zo sekcií nepatrí k tejto kampani.");
  }
  const newSectionIds = sections.filter((section) => !existingSectionIds.has(section.id)).map((section) => section.id);
  if (newSectionIds.length && await prisma.campaignSection.findFirst({ where: { id: { in: newSectionIds } }, select: { id: true } })) {
    redirectWithCampaignError(`/admin/kampane/${id}`, "Identifikátor novej sekcie sa už používa. Obnovte stránku a skúste to znova.");
  }

  const galleryEditorPresent = formData.get("galleryEditorPresent") === "1";
  const currentGalleryItems = currentCampaign.galleryItems.filter((item) => item.placement === "GALLERY");
  const submittedGalleryItems = new Map(
    formData.getAll("galleryItemData").map(preparedMedia).flatMap((input) => typeof input.id === "string" ? [[input.id, input] as const] : []),
  );
  const requestedGalleryIds = new Set(submittedGalleryItems.keys());
  const retainedGalleryItems = galleryEditorPresent ? currentGalleryItems.filter((item) => requestedGalleryIds.has(item.id)) : currentGalleryItems;
  const removedGalleryItems = galleryEditorPresent ? currentGalleryItems.filter((item) => !requestedGalleryIds.has(item.id)) : [];
  const uploadedMedia = await uploadedCampaignMedia(formData, `/admin/kampane/${id}`, maxGalleryItems - retainedGalleryItems.length);

  const hero = sections.find((section) => section.type === "HERO")!;
  const offer = sections.find((section) => section.type === "OFFER");
  if (uploadedMedia.images.imageUrl) hero.content.imageUrl = uploadedMedia.images.imageUrl;
  if (offer && uploadedMedia.images.offerImageUrl) offer.content.imageUrl = uploadedMedia.images.offerImageUrl;
  const legacyData = legacyDataFromSections(sections, currentCampaign);
  const gallerySection = sections.find((section) => section.type === "GALLERY");

  const orderedGalleryItems = galleryEditorPresent ? uniqueGalleryPlacements([
    ...retainedGalleryItems.map((item, fallbackOrder) => {
      const input = submittedGalleryItems.get(item.id) ?? {};
      return {
        source: "current" as const,
        id: item.id,
        mediaType: item.mediaType === "VIDEO" ? "VIDEO" as const : "IMAGE" as const,
        mediaUrl: item.mediaUrl,
        caption: galleryCaption(input.caption),
        placement: "GALLERY" as const,
        sortOrder: gallerySortOrder(input.sortOrder, fallbackOrder),
      };
    }),
    ...uploadedMedia.galleryItems.map((item) => ({ source: "new" as const, ...item, placement: "GALLERY" as const })),
  ].sort((a, b) => a.sortOrder - b.sortOrder)) : [];

  try {
    await prisma.$transaction([
      prisma.campaign.update({ where: { id }, data: legacyData }),
      ...sections.map((section, position) => prisma.campaignSection.upsert({
        where: { id: section.id },
        create: { id: section.id, campaignId: id, type: section.type, position, isVisible: section.isVisible, content: section.content as Prisma.InputJsonValue },
        update: { type: section.type, position, isVisible: section.isVisible, content: section.content as Prisma.InputJsonValue },
      })),
      ...(galleryEditorPresent ? orderedGalleryItems.flatMap((item, sortOrder) => item.source === "current" ? [prisma.campaignGalleryItem.update({
        where: { id: item.id }, data: { caption: item.caption || null, placement: "GALLERY", sectionId: gallerySection?.id ?? null, sortOrder },
      })] : []) : []),
      ...(galleryEditorPresent ? [prisma.campaignGalleryItem.deleteMany({ where: { id: { in: removedGalleryItems.map((item) => item.id) }, campaignId: id } })] : []),
      ...(galleryEditorPresent && orderedGalleryItems.some((item) => item.source === "new") ? [prisma.campaignGalleryItem.createMany({
        data: orderedGalleryItems.flatMap((item, sortOrder) => item.source === "new" ? [{ campaignId: id, sectionId: gallerySection?.id ?? null, mediaType: item.mediaType, mediaUrl: item.mediaUrl, caption: item.caption || null, placement: "GALLERY", sortOrder }] : []),
      })] : []),
      prisma.campaignSection.deleteMany({ where: { campaignId: id, id: { notIn: sections.map((section) => section.id) } } }),
      prisma.campaignAudit.create({ data: { campaignId: id, action: "UPDATED", actor, metadata: { area: "content-sections" } } }),
    ]);
  } catch (error) {
    await cleanupUploadedCampaignMedia(uploadedMedia.cleanupUrls, "Campaign sections update failed");
    console.error(`Campaign sections update ${id} failed:`, error);
    redirectWithCampaignError(`/admin/kampane/${id}`, "Obsah stránky sa nepodarilo uložiť. Skúste to znova.");
  }

  if (removedGalleryItems.length > 0) {
    try { await removeCampaignMediaIfUnreferenced(removedGalleryItems.map((item) => item.mediaUrl)); }
    catch (error) { console.error(`Odstránené médiá kampane ${id} sa nepodarilo vyčistiť:`, error); }
  }
  revalidatePath(`/admin/kampane/${id}`);
  revalidatePath(`/kampan/${currentCampaign.slug}`);
  redirect(`/admin/kampane/${id}?saved=content`);
}

export async function updateCampaignSettings(id: string, formData: FormData) {
  const { actor } = await requireAdmin();
  const current = await prisma.campaign.findUniqueOrThrow({ where: { id }, include: { metaAd: true } });
  if (current.status === "ARCHIVED") redirectWithCampaignError(`/admin/kampane/${id}`, "Archivovanú kampaň najprv obnovte do konceptu.");
  const name = text(formData, "name").slice(0, 120);
  const slug = slugify(text(formData, "slug") || name);
  const phone = text(formData, "phone").slice(0, 30);
  const email = text(formData, "email").slice(0, 254);
  if (!name || !slug || !/[0-9]{7,}/.test(phone.replace(/\s/g, "")) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirectWithCampaignError(`/admin/kampane/${id}`, "Skontrolujte názov, adresu stránky, telefón a e-mail.");
  }
  if (current.metaAd?.metaCampaignId && slug !== current.slug) redirectWithCampaignError(`/admin/kampane/${id}`, "Adresu stránky nie je možné zmeniť, kým je na ňu napojená Meta reklama.");
  if (await prisma.campaign.findFirst({ where: { slug, NOT: { id } }, select: { id: true } })) redirectWithCampaignError(`/admin/kampane/${id}`, "Táto adresa stránky sa už používa.");
  await prisma.$transaction([
    prisma.campaign.update({ where: { id }, data: {
      name, slug, phone, email,
      responseTimeText: text(formData, "responseTimeText").slice(0, 200) || null,
      trustText: text(formData, "trustText").slice(0, 500) || null,
      openingHours: text(formData, "openingHours").slice(0, 300) || null,
      address: text(formData, "address").slice(0, 300) || null,
      mapUrl: text(formData, "mapUrl").slice(0, 1000) || null,
      seoTitle: text(formData, "seoTitle").slice(0, 70) || null,
      seoDescription: text(formData, "seoDescription").slice(0, 180) || null,
      canonicalUrl: text(formData, "canonicalUrl").slice(0, 1000) || null,
      ogTitle: text(formData, "ogTitle").slice(0, 100) || null,
      ogDescription: text(formData, "ogDescription").slice(0, 300) || null,
      ogImageUrl: text(formData, "ogImageUrl").slice(0, 1000) || null,
      noIndex: formData.get("noIndex") === "on",
      legalUrl: text(formData, "legalUrl").slice(0, 1000) || "/ochrana-osobnych-udajov",
    } }),
    prisma.campaignAudit.create({ data: { campaignId: id, action: "UPDATED", actor, metadata: { area: "settings" } } }),
  ]);
  revalidatePath("/admin");
  revalidatePath(`/kampan/${current.slug}`);
  revalidatePath(`/kampan/${slug}`);
  redirect(`/admin/kampane/${id}?saved=settings`);
}

async function pauseConnectedMetaAd(campaign: {
  metaAd: null | { id: string; metaCampaignId: string | null; metaAdSetId: string | null; metaAdId: string | null; status: string };
}) {
  const ad = campaign.metaAd;
  if (!ad?.metaCampaignId || !ad.metaAdSetId || !ad.metaAdId || ad.status !== "ACTIVE") return;
  await setRemoteMetaAdStatus({ campaignId: ad.metaCampaignId, adSetId: ad.metaAdSetId, adId: ad.metaAdId }, "PAUSED");
  await prisma.metaAdCampaign.update({ where: { id: ad.id }, data: { status: "PAUSED", effectiveStatus: "PAUSED", lastError: null } });
}

async function readinessForCampaign(id: string) {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id },
    include: { galleryItems: { orderBy: { sortOrder: "asc" } }, sections: { orderBy: { position: "asc" } }, metaAd: true },
  });
  const duplicateSlug = await prisma.campaign.count({ where: { slug: campaign.slug, NOT: { id } } });
  return {
    campaign,
    result: campaignReadiness(campaign, {
      slugUnique: duplicateSlug === 0,
      appUrl: process.env.APP_URL,
      requireProductionUrl: process.env.NODE_ENV === "production",
    }),
  };
}

export async function publishCampaign(id: string) {
  const { actor } = await requireAdmin();
  const { campaign, result } = await readinessForCampaign(id);
  if (!canTransitionCampaign(campaign.status, "PUBLISHED")) {
    redirectWithCampaignError(`/admin/kampane/${id}`, "Túto kampaň nie je možné publikovať z aktuálneho stavu.");
  }
  if (!result.ready) {
    const missing = result.items.filter((item) => item.level === "required" && !item.ready).map((item) => item.label).join(", ");
    redirectWithCampaignError(`/admin/kampane/${id}`, `Publikovanie je zablokované. Doplňte: ${missing}.`);
  }
  const latest = await prisma.campaignPublication.aggregate({ where: { campaignId: id }, _max: { version: true } });
  const now = new Date();
  await prisma.$transaction([
    prisma.campaignPublication.create({ data: { campaignId: id, version: (latest._max.version ?? 0) + 1, snapshot: publicationSnapshot(campaign) as Prisma.InputJsonValue, actor, publishedAt: now } }),
    prisma.campaign.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: now, publishAt: null, scheduleError: null } }),
    prisma.campaignAudit.create({ data: { campaignId: id, action: "PUBLISHED", actor, metadata: { version: (latest._max.version ?? 0) + 1 } } }),
  ]);
  revalidatePath("/admin");
  revalidatePath(`/kampan/${campaign.slug}`);
  redirect(`/admin/kampane/${id}?published=1`);
}

export async function changeCampaignStatus(id: string, nextStatus: CampaignStatusValue) {
  const { actor } = await requireAdmin();
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id }, include: { metaAd: true } });
  if (!canTransitionCampaign(campaign.status, nextStatus)) {
    redirectWithCampaignError(`/admin/kampane/${id}`, "Nepovolená zmena stavu kampane.");
  }
  if (nextStatus === "PUBLISHED") return publishCampaign(id);
  if ((nextStatus === "PAUSED" || nextStatus === "ARCHIVED") && campaign.status === "PUBLISHED") {
    try {
      await pauseConnectedMetaAd(campaign);
    } catch (error) {
      console.error(`Meta pause before campaign ${nextStatus.toLowerCase()} failed:`, error);
      redirectWithCampaignError(`/admin/kampane/${id}`, "Meta reklamu sa nepodarilo bezpečne pozastaviť. Kampaň zostala publikovaná; skúste to znova alebo ju pozastavte v Ads Manageri.");
    }
  }
  const action = nextStatus === "READY" ? "READY" : nextStatus === "PAUSED" ? "PAUSED" : nextStatus === "ARCHIVED" ? "ARCHIVED" : "UPDATED";
  await prisma.$transaction([
    prisma.campaign.update({ where: { id }, data: { status: nextStatus, ...(nextStatus === "ARCHIVED" ? { publishAt: null, unpublishAt: null } : {}) } }),
    prisma.campaignAudit.create({ data: { campaignId: id, action, actor } }),
  ]);
  revalidatePath("/admin");
  revalidatePath(`/kampan/${campaign.slug}`);
  redirect(`/admin/kampane/${id}?status=${nextStatus.toLowerCase()}`);
}

function scheduledDate(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;
  const date = parseBratislavaDateTime(value);
  if (!date) throw new Error("Neplatný dátum.");
  return date;
}

export async function scheduleCampaign(id: string, formData: FormData) {
  const { actor } = await requireAdmin();
  const publishAt = scheduledDate(formData, "publishAt");
  const unpublishAt = scheduledDate(formData, "unpublishAt");
  if (publishAt && publishAt <= new Date()) redirectWithCampaignError(`/admin/kampane/${id}`, "Čas publikovania musí byť v budúcnosti.");
  if (unpublishAt && unpublishAt <= new Date()) redirectWithCampaignError(`/admin/kampane/${id}`, "Čas ukončenia musí byť v budúcnosti.");
  if (publishAt && unpublishAt && unpublishAt <= publishAt) redirectWithCampaignError(`/admin/kampane/${id}`, "Ukončenie musí byť neskôr než publikovanie.");
  await prisma.$transaction([
    prisma.campaign.update({ where: { id }, data: { publishAt, unpublishAt, scheduleError: null } }),
    prisma.campaignAudit.create({ data: { campaignId: id, action: "SCHEDULED", actor, metadata: { publishAt: publishAt?.toISOString() ?? null, unpublishAt: unpublishAt?.toISOString() ?? null, timezone: "Europe/Bratislava" } } }),
  ]);
  revalidatePath(`/admin/kampane/${id}`);
  redirect(`/admin/kampane/${id}?scheduled=1`);
}

async function uniqueDuplicateSlug(slug: string) {
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const candidate = `${slug}-kopia${suffix === 1 ? "" : `-${suffix}`}`;
    if (!(await prisma.campaign.findUnique({ where: { slug: candidate }, select: { id: true } }))) return candidate;
  }
  throw new Error("Nepodarilo sa vytvoriť jedinečnú adresu kópie.");
}

export async function duplicateCampaign(id: string) {
  const { actor } = await requireAdmin();
  const source = await prisma.campaign.findUniqueOrThrow({ where: { id }, include: { galleryItems: { orderBy: { sortOrder: "asc" } }, sections: { orderBy: { position: "asc" } } } });
  const slug = await uniqueDuplicateSlug(source.slug);
  const copy = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({ data: {
      ...Object.fromEntries(snapshotFields.map((field) => [field, source[field]])),
      name: `${source.name} – kópia`.slice(0, 120), slug, status: "DRAFT", publishedAt: null, publishAt: null, unpublishAt: null, scheduleError: null,
      auditEntries: { create: { action: "DUPLICATED", actor, metadata: { sourceCampaignId: source.id } } },
    } as Prisma.CampaignCreateInput });
    const sourceSections = source.sections.length ? source.sections : legacyCampaignSections(source);
    const sectionIdMap = new Map<string, string>();
    for (const section of sourceSections) {
      const createdSection = await tx.campaignSection.create({ data: { campaignId: created.id, type: section.type, position: section.position, isVisible: section.isVisible, content: section.content as Prisma.InputJsonValue } });
      sectionIdMap.set(section.id, createdSection.id);
    }
    if (source.galleryItems.length) await tx.campaignGalleryItem.createMany({ data: source.galleryItems.map(({ mediaUrl, mediaType, caption, placement, sortOrder, sectionId }) => ({ campaignId: created.id, mediaUrl, mediaType, caption, placement, sortOrder, sectionId: sectionId ? sectionIdMap.get(sectionId) ?? null : null })) });
    return created;
  });
  revalidatePath("/admin");
  redirect(`/admin/kampane/${copy.id}?duplicated=1`);
}

export async function restoreCampaignVersion(id: string, publicationId: string) {
  const { actor } = await requireAdmin();
  const publication = await prisma.campaignPublication.findFirst({ where: { id: publicationId, campaignId: id } });
  if (!publication || !publication.snapshot || typeof publication.snapshot !== "object" || Array.isArray(publication.snapshot)) {
    redirectWithCampaignError(`/admin/kampane/${id}`, "Publikovaná verzia neexistuje.");
  }
  const snapshot = publication.snapshot as Record<string, unknown>;
  const gallery = Array.isArray(snapshot.galleryItems) ? snapshot.galleryItems : [];
  const savedSections = Array.isArray(snapshot.sections) ? snapshot.sections : [];
  const data = Object.fromEntries(snapshotFields.filter((field) => field !== "slug").map((field) => [field, snapshot[field]])) as Prisma.CampaignUpdateInput;
  await prisma.$transaction(async (tx) => {
    await tx.campaign.update({ where: { id }, data: { ...data, status: "DRAFT", publishedAt: null, publishAt: null, unpublishAt: null } });
    await tx.campaignGalleryItem.deleteMany({ where: { campaignId: id } });
    let gallerySectionId: string | null = null;
    if (savedSections.length > 0) {
      await tx.campaignSection.deleteMany({ where: { campaignId: id } });
      for (const [position, item] of savedSections.entries()) {
        if (!item || typeof item !== "object") continue;
        const value = item as Record<string, unknown>;
        if (typeof value.type !== "string" || !["HERO", "TEXT_IMAGE", "BENEFITS", "OFFER", "GALLERY", "VIDEO", "FAQ", "TESTIMONIALS", "CTA", "FORM"].includes(value.type)) continue;
        const section = await tx.campaignSection.create({ data: { campaignId: id, type: value.type as CampaignSectionType, position, isVisible: value.isVisible !== false, content: value.content as Prisma.InputJsonValue } });
        if (value.type === "GALLERY" && !gallerySectionId) gallerySectionId = section.id;
      }
    } else {
      gallerySectionId = (await tx.campaignSection.findFirst({ where: { campaignId: id, type: "GALLERY" }, select: { id: true } }))?.id ?? null;
    }
    await tx.campaignGalleryItem.createMany({ data: gallery.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      if (typeof value.mediaUrl !== "string" || (value.mediaType !== "IMAGE" && value.mediaType !== "VIDEO")) return [];
      const mediaType = value.mediaType;
      return [{
        campaignId: id,
        sectionId: galleryPlacement(value.placement, mediaType) === "GALLERY" ? gallerySectionId : null,
        mediaUrl: value.mediaUrl,
        mediaType,
        caption: galleryCaption(value.caption) || null,
        placement: galleryPlacement(value.placement, mediaType),
        sortOrder: index,
      }];
    }) });
    await tx.campaignAudit.create({ data: { campaignId: id, action: "VERSION_RESTORED", actor, metadata: { publicationId, version: publication.version } } });
  });
  revalidatePath("/admin");
  redirect(`/admin/kampane/${id}?restored=1`);
}

export async function saveCampaignExperiment(id: string, formData: FormData) {
  const { actor } = await requireAdmin();
  const requestedStatus = text(formData, "experimentStatus");
  const status = ["DRAFT", "RUNNING", "PAUSED", "COMPLETED"].includes(requestedStatus) ? requestedStatus as "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED" : "DRAFT";
  const current = await prisma.campaignExperiment.findUnique({ where: { campaignId: id } });
  const changed = Boolean(current && current.status === "RUNNING" && ["variantHeadline", "variantDescription", "variantCtaText", "variantImageUrl"].some((key) => (current[key as keyof typeof current] ?? "") !== text(formData, key)));
  await prisma.$transaction([
    prisma.campaignExperiment.upsert({
      where: { campaignId: id },
      create: { campaignId: id, status, variantHeadline: text(formData, "variantHeadline").slice(0, 160) || null, variantDescription: text(formData, "variantDescription").slice(0, 800) || null, variantCtaText: text(formData, "variantCtaText").slice(0, 80) || null, variantImageUrl: text(formData, "variantImageUrl").slice(0, 1000) || null, startedAt: status === "RUNNING" ? new Date() : null, completedAt: status === "COMPLETED" ? new Date() : null, changedWhileRunning: changed },
      update: { status, variantHeadline: text(formData, "variantHeadline").slice(0, 160) || null, variantDescription: text(formData, "variantDescription").slice(0, 800) || null, variantCtaText: text(formData, "variantCtaText").slice(0, 80) || null, variantImageUrl: text(formData, "variantImageUrl").slice(0, 1000) || null, ...(status === "RUNNING" && current?.status !== "RUNNING" ? { startedAt: new Date() } : {}), ...(status === "COMPLETED" ? { completedAt: new Date() } : {}), changedWhileRunning: current?.changedWhileRunning || changed },
    }),
    prisma.campaignAudit.create({ data: { campaignId: id, action: "EXPERIMENT_CHANGED", actor, metadata: { status, changedWhileRunning: changed } } }),
  ]);
  revalidatePath(`/admin/kampane/${id}`);
  redirect(`/admin/kampane/${id}?experimentSaved=1`);
}

export async function applyExperimentVariant(id: string) {
  const { actor } = await requireAdmin();
  const experiment = await prisma.campaignExperiment.findUniqueOrThrow({ where: { campaignId: id } });
  if (experiment.status !== "COMPLETED") redirectWithCampaignError(`/admin/kampane/${id}`, "Variant možno použiť až po ukončení experimentu.");
  const heroSection = await prisma.campaignSection.findFirst({ where: { campaignId: id, type: "HERO" }, orderBy: { position: "asc" } });
  const heroContent = heroSection?.content && typeof heroSection.content === "object" && !Array.isArray(heroSection.content) ? heroSection.content as Record<string, unknown> : {};
  await prisma.$transaction([
    prisma.campaign.update({ where: { id }, data: { status: "DRAFT", publishedAt: null, headline: experiment.variantHeadline ?? undefined, description: experiment.variantDescription ?? undefined, ctaText: experiment.variantCtaText ?? undefined, imageUrl: experiment.variantImageUrl ?? undefined } }),
    ...(heroSection ? [prisma.campaignSection.update({ where: { id: heroSection.id }, data: { content: {
      ...heroContent,
      heading: experiment.variantHeadline ?? heroContent.heading,
      description: experiment.variantDescription ?? heroContent.description,
      ctaLabel: experiment.variantCtaText ?? heroContent.ctaLabel,
      imageUrl: experiment.variantImageUrl ?? heroContent.imageUrl,
    } as Prisma.InputJsonValue } })] : []),
    prisma.campaignAudit.create({ data: { campaignId: id, action: "EXPERIMENT_CHANGED", actor, metadata: { appliedVariant: "B", restoredToDraft: true } } }),
  ]);
  revalidatePath("/admin");
  redirect(`/admin/kampane/${id}?variantApplied=1`);
}

export async function deleteCampaign(id: string) {
  await changeCampaignStatus(id, "ARCHIVED");
}

export type LeadFormState = {
  success: boolean;
  message: string;
};

export async function createLead(
  _previousState: LeadFormState,
  formData: FormData,
): Promise<LeadFormState> {
  if (text(formData, "website")) return { success: true, message: "Ďakujeme, čoskoro sa vám ozveme." };
  const parsed = parseLeadSubmission(formData);
  if (!parsed.success) {
    return { success: false, message: "Skontrolujte meno, telefón, e-mail, dĺžku poznámky a povinný súhlas." };
  }
  const data = parsed.data;
  const formProof = verifyLeadFormToken(data.formToken, data.campaignId);
  if (!formProof.valid) {
    return {
      success: false,
      message: formProof.reason === "too_fast"
        ? "Formulár bol odoslaný príliš rýchlo. Počkajte chvíľu a skúste to znova."
        : "Platnosť formulára vypršala. Obnovte stránku a skúste to znova.",
    };
  }
  const ip = await requestIp();
  const rateLimit = await consumeRateLimit("lead", 8, 15 * 60 * 1000, ip);
  if (!rateLimit) return { success: false, message: "Príliš veľa pokusov. Skúste to neskôr." };
  if (!(await verifyTurnstile(data.turnstileToken, ip))) {
    return { success: false, message: "Bezpečnostné overenie zlyhalo. Obnovte stránku a skúste to znova." };
  }

  const campaignId = data.campaignId;
  const normalizedPhone = normalizePhone(data.phone);
  const normalizedEmail = data.email || null;
  const submissionId = text(formData, "submissionId").replace(/[^a-zA-Z0-9-]/g, "").slice(0, 100);

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (campaign?.status !== "PUBLISHED" || !campaign.formEnabled) {
    return { success: false, message: "Formulár už nie je dostupný. Ozvite sa nám telefonicky alebo e-mailom." };
  }

  const possibleDuplicate = await prisma.lead.findFirst({
    where: {
      campaignId,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      OR: [{ normalizedPhone }, ...(normalizedEmail ? [{ normalizedEmail }] : [])],
    },
    select: { id: true },
  });
  const dedupeKey = leadDedupeKey(
    campaignId,
    formProof.nonce,
    JSON.stringify([data.name.toLowerCase(), normalizedPhone, normalizedEmail, data.note]),
  );
  const attribution = {
    utmSource: data.utmSource,
    utmMedium: data.utmMedium,
    utmCampaign: data.utmCampaign,
    utmContent: data.utmContent,
    utmTerm: data.utmTerm,
    landingPage: safeAttributionUrl(data.landingPage || "", true),
    referrer: safeAttributionUrl(data.referrer || "", false),
  };
  try {
    await prisma.$transaction(async (tx) => tx.lead.create({
      data: {
      campaignId,
      name: data.name,
      phone: data.phone,
      email: normalizedEmail,
      normalizedPhone,
      normalizedEmail: normalizedEmail || null,
      interestType: campaign.offerType,
      note: data.note,
      consent: true,
      consentAt: new Date(),
      consentVersion: privacyPolicyVersion(),
      dedupeKey,
      possibleDuplicate: Boolean(possibleDuplicate),
      variant: data.variant,
      campaignSlug: campaign.slug,
      ...attribution,
      firstUtmSource: attribution.utmSource,
      firstUtmMedium: attribution.utmMedium,
      firstUtmCampaign: attribution.utmCampaign,
      firstUtmContent: attribution.utmContent,
      firstUtmTerm: attribution.utmTerm,
      firstLandingPage: attribution.landingPage,
      firstReferrer: attribution.referrer,
      activities: { create: { type: "CREATED", actor: "Verejný formulár", message: "Lead bol vytvorený z kampane." } },
      campaignEvents: { create: { type: "LEAD_CREATED" as const, variant: data.variant, campaign: { connect: { id: campaignId } }, ...(submissionId ? { eventId: `lead:${submissionId}` } : {}) } },
      emailOutbox: { create: [
        { kind: "ADMIN_NOTIFICATION" },
        ...(normalizedEmail ? [{ kind: "CUSTOMER_CONFIRMATION" as const }] : []),
      ] },
    },
    }));
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { success: true, message: "Požiadavku už evidujeme. Čoskoro sa vám ozveme." };
    }
    throw error;
  }

  await processEmailOutbox(normalizedEmail ? 2 : 1).catch(() => undefined);

  revalidatePath("/admin");
  revalidatePath("/admin/leady");
  return {
    success: true,
    message: normalizedEmail
      ? "Ďakujeme. Potvrdenie odošleme na zadaný e-mail a čoskoro sa vám ozveme."
      : "Ďakujeme, čoskoro sa vám ozveme.",
  };
}

function safeAttributionUrl(value: string, relativeAllowed: boolean) {
  const cleaned = value.trim().slice(0, 2000);
  if (!cleaned) return null;
  if (relativeAllowed && cleaned.startsWith("/") && !cleaned.startsWith("//")) return cleaned;
  try {
    const url = new URL(cleaned);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
