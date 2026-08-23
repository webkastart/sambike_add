import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const maxImageSize = 5 * 1024 * 1024;
export const campaignImagesDirectory = path.join(process.cwd(), "storage", "campaign-images");

const imageTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

export class CampaignImageError extends Error {}

function hasExpectedSignature(bytes: Uint8Array, type: keyof typeof imageTypes) {
  if (type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (type === "image/png") {
    return bytes.slice(0, 8).every((byte, index) => byte === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index]);
  }

  return (
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

export function hasCampaignImageUpload(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

export async function saveCampaignImage(value: FormDataEntryValue | null) {
  if (!hasCampaignImageUpload(value)) return null;

  if (value.size > maxImageSize) {
    throw new CampaignImageError("Obrázok môže mať najviac 5 MB.");
  }

  if (!(value.type in imageTypes)) {
    throw new CampaignImageError("Nahrajte obrázok vo formáte JPG, PNG alebo WebP.");
  }

  const bytes = new Uint8Array(await value.arrayBuffer());
  const type = value.type as keyof typeof imageTypes;
  if (!hasExpectedSignature(bytes, type)) {
    throw new CampaignImageError("Súbor nie je platný obrázok JPG, PNG alebo WebP.");
  }

  const filename = `${randomUUID()}${imageTypes[type]}`;
  await mkdir(campaignImagesDirectory, { recursive: true });
  await writeFile(path.join(campaignImagesDirectory, filename), bytes);
  return `/uploads/${filename}`;
}

export async function removeCampaignImage(imageUrl: string) {
  if (!imageUrl.startsWith("/uploads/")) return;

  const filename = path.basename(imageUrl);
  if (!filename || imageUrl !== `/uploads/${filename}`) return;

  try {
    await unlink(path.join(campaignImagesDirectory, filename));
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code !== "ENOENT") throw error;
  }
}
