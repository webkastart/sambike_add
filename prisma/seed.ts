import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" });
const prisma = new PrismaClient({ adapter });

const campaigns = [
  {
    name: "Požičovňa e-bikov",
    slug: "pozicovna",
    headline: "Objav Slovenský raj na dvoch kolesách",
    description: "Prémiové e-biky pripravené na výlet. Poradíme s trasou, nastavíme bicykel a vyrazíte bez starostí.",
    imageUrl: "/448793415_8416634951699640_3471726067659934816_n.jpg",
    priceText: "od 29 € / deň",
    ctaText: "Overiť dostupnosť",
    offerType: "Požičovňa e-bikov",
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
    imageUrl: "/501092085_18330718675164899_5154079394919144617_n.jpg",
    priceText: "servis od 24 €",
    ctaText: "Overiť termín",
    offerType: "Servis",
    phone: "+421 905 123 456",
    email: "servis@sambike.sk",
    formEnabled: true,
    isActive: true,
  },
  {
    name: "Letná rodinná akcia",
    slug: "letna-akcia",
    headline: "Detský bicykel zdarma.",
    description: "Pri rezervácii 3 bicyklov získate detský bicykel na celý deň bezplatne. Platí počas letných prázdnin.",
    imageUrl: "/490386666_24035555779380972_5019809913561738254_n.jpg",
    priceText: "detský bicykel zdarma",
    ctaText: "Chcem využiť akciu",
    offerType: "Letná rodinná akcia",
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
    imageUrl: "/491416117_18327442552164899_6592296387915655104_n.jpg",
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
