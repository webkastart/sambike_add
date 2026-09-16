import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL || "postgresql://sambike:sambike@localhost:5432/sambike_ads",
});
const prisma = new PrismaClient({ adapter });

const galleryImages = {
  galleryImage1Url: "/sambike_image.jpeg",
  galleryImage2Url: "/WhatsApp Image 2026-08-26 at 15.59.28.jpeg",
  galleryImage3Url: "/sambike_sotre_5.jpeg",
};

const campaigns = [
  {
    name: "Servis bicyklov",
    slug: "servis",
    headline: "Servis bicyklov s osobným prístupom",
    description: "Kvalitný servis, diely a doplnky v Spišskej Novej Vsi. Pošlite požiadavku a spolu dohodneme termín.",
    imageUrl: "/sambike_store1.jpeg",
    offerImageUrl: "/sambike_image.jpeg",
    ...galleryImages,
    priceText: "Cena podľa rozsahu servisu",
    ctaText: "Objednať servis",
    offerType: "Servis bicyklov",
    phone: "0948 035 117",
    email: "sambike.snv@gmail.com",
    formEnabled: true,
    status: "PUBLISHED" as const,
    publishedAt: new Date(),
    seoTitle: "Servis bicyklov v Spišskej Novej Vsi",
    seoDescription: "Servis bicyklov Sambike v Spišskej Novej Vsi. Pošlite požiadavku a dohodnite si termín.",
  },
  {
    name: "Testovacia kampaň",
    slug: "testovacia-kampan",
    headline: "Kampaň momentálne nie je aktívna",
    description: "Ukážka deaktivovanej kampane.",
    imageUrl: "/sambike_sotre_7.jpeg",
    offerImageUrl: "/sambike_sotre_7.jpeg",
    ...galleryImages,
    priceText: "—",
    ctaText: "Mám záujem",
    offerType: "Test",
    phone: "0948 035 117",
    email: "sambike.snv@gmail.com",
    formEnabled: false,
    status: "DRAFT" as const,
    seoTitle: "Testovacia kampaň",
    seoDescription: "Nepublikovaný testovací koncept kampane Sambike.",
  },
];

if ((await prisma.campaign.count()) === 0) {
  await prisma.campaign.createMany({ data: campaigns });

  const createdCampaigns = await prisma.campaign.findMany({ select: { id: true } });
  await prisma.campaignGalleryItem.createMany({
    data: createdCampaigns.flatMap((campaign) => Object.values(galleryImages).map((mediaUrl, sortOrder) => ({
      campaignId: campaign.id,
      mediaUrl,
      mediaType: "IMAGE",
      sortOrder,
    }))),
  });

  const service = await prisma.campaign.findUniqueOrThrow({ where: { slug: "servis" } });
  const luciaDedupeKey = createHash("sha256").update("seed-lucia").digest("hex");
  const peterDedupeKey = createHash("sha256").update("seed-peter").digest("hex");

  await prisma.lead.createMany({
    data: [
      { campaignId: service.id, name: "Lucia Horváthová", phone: "+421 904 555 210", normalizedPhone: "+421904555210", email: "lucia@example.com", normalizedEmail: "lucia@example.com", interestType: "Kompletný servis", note: "Horský bicykel, preskakuje zadná prehadzovačka.", consent: true, consentAt: new Date("2026-08-19T14:45:00.000Z"), consentVersion: "seed-demo", dedupeKey: luciaDedupeKey, createdAt: new Date("2026-08-19T14:45:00.000Z") },
      { campaignId: service.id, name: "Peter Kováč", phone: "+421 911 123 987", normalizedPhone: "+421911123987", interestType: "Servis bicyklov", note: "Prosím o overenie najbližšieho termínu.", consent: true, consentAt: new Date("2026-08-18T07:10:00.000Z"), consentVersion: "seed-demo", dedupeKey: peterDedupeKey, createdAt: new Date("2026-08-18T07:10:00.000Z") },
    ],
  });
  const seededLeads = await prisma.lead.findMany({
    where: { dedupeKey: { in: [luciaDedupeKey, peterDedupeKey] } },
    select: { id: true, createdAt: true },
  });
  await prisma.leadActivity.createMany({
    data: seededLeads.map((lead) => ({
      leadId: lead.id,
      type: "CREATED",
      actor: "Seed",
      message: "Ukážkový lead bol vytvorený.",
      createdAt: lead.createdAt,
    })),
  });

  console.log("Demo servisná kampaň a záujemcovia boli vytvorení.");
} else {
  console.log("Databáza už obsahuje kampane; seed nič nezmenil.");
}
await prisma.$disconnect();
