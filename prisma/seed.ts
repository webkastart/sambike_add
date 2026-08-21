import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

const campaigns = [
  {
    name: "Požičovňa e-bikov",
    slug: "pozicovna",
    headline: "Objav Liptov na dvoch kolesách",
    description: "Prémiové e-biky pripravené na výlet. Poradíme s trasou, nastavíme bicykel a vyrazíš bez starostí.",
    imageUrl: "https://images.unsplash.com/photo-1571068316344-75bc76f77890?auto=format&fit=crop&w=1800&q=85",
    priceText: "od 29 € / deň",
    ctaText: "Rezervovať bicykel",
    offerType: "Požičovňa",
    phone: "+421 905 123 456",
    email: "ahoj@sambike.sk",
    formEnabled: true,
    isActive: true,
  },
  {
    name: "Jarný servis",
    slug: "servis",
    headline: "Bicykel pripravený na sezónu",
    description: "Kompletná kontrola, nastavenie a základný servis do 48 hodín. Bez nepríjemných prekvapení na prvom výjazde.",
    imageUrl: "https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?auto=format&fit=crop&w=1800&q=85",
    priceText: "servis od 24 €",
    ctaText: "Objednať servis",
    offerType: "Servis",
    phone: "+421 905 123 456",
    email: "servis@sambike.sk",
    formEnabled: true,
    isActive: true,
  },
  {
    name: "Letná rodinná akcia",
    slug: "letna-akcia",
    headline: "Rodinný deň na bicykloch",
    description: "Pri rezervácii troch bicyklov máš detský bicykel na celý deň bezplatne. Platí počas letných prázdnin.",
    imageUrl: "https://images.unsplash.com/photo-1541625602330-2277a4c46182?auto=format&fit=crop&w=1800&q=85",
    priceText: "detský bicykel zdarma",
    ctaText: "Chcem využiť akciu",
    offerType: "Letná akcia",
    phone: "+421 905 123 456",
    email: "ahoj@sambike.sk",
    formEnabled: true,
    isActive: true,
  },
  {
    name: "Testovacia kampaň",
    slug: "testovacia-kampan",
    headline: "Kampaň momentálne nie je aktívna",
    description: "Ukážka deaktivovanej kampane.",
    imageUrl: "https://images.unsplash.com/photo-1529422643029-d4585747aaf2?auto=format&fit=crop&w=1800&q=85",
    priceText: "—",
    ctaText: "Mám záujem",
    offerType: "Test",
    phone: "+421 905 123 456",
    email: "ahoj@sambike.sk",
    formEnabled: false,
    isActive: false,
  },
];

for (const campaign of campaigns) {
  await prisma.campaign.upsert({ where: { slug: campaign.slug }, update: campaign, create: campaign });
}

const rental = await prisma.campaign.findUnique({ where: { slug: "pozicovna" } });
const service = await prisma.campaign.findUnique({ where: { slug: "servis" } });

if (rental && service && (await prisma.lead.count()) === 0) {
  await prisma.lead.createMany({
    data: [
      { campaignId: rental.id, name: "Martin Novák", phone: "+421 907 222 111", email: "martin@example.com", interestType: "Celodenný prenájom", note: "Potrebujeme dva e-biky na sobotu.", consent: true, createdAt: new Date("2026-08-20T09:20:00.000Z") },
      { campaignId: service.id, name: "Lucia Horváthová", phone: "+421 904 555 210", email: "lucia@example.com", interestType: "Kompletný servis", note: "Horský bicykel, preskakuje zadná prehadzovačka.", consent: true, createdAt: new Date("2026-08-19T14:45:00.000Z") },
      { campaignId: rental.id, name: "Peter Kováč", phone: "+421 911 123 987", interestType: "Víkendový prenájom", consent: true, createdAt: new Date("2026-08-18T07:10:00.000Z") },
    ],
  });
}

console.log("Demo kampane a záujemcovia boli vytvorení.");
await prisma.$disconnect();
