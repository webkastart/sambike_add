import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const maxImageSize = 5 * 1024 * 1024;
const maxVideoSize = 20 * 1024 * 1024;
export const campaignMediaDirectory = path.join(process.cwd(), "storage", "campaign-images");

const imageTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
} as const;

const galleryMediaTypes = {
  ...imageTypes,
  "video/mp4": ".mp4",
} as const;

type ImageType = keyof typeof imageTypes;
type GalleryMediaType = keyof typeof galleryMediaTypes;

export type CampaignGalleryMediaType = "IMAGE" | "VIDEO";

export class CampaignMediaError extends Error {}

function hasExpectedImageSignature(bytes: Uint8Array, type: ImageType) {
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

function hasExpectedSignature(bytes: Uint8Array, type: GalleryMediaType) {
  if (type === "video/mp4") {
    return bytes.length >= 12 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp";
  }
  return hasExpectedImageSignature(bytes, type);
}

export function hasCampaignMediaUpload(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

export function hasCampaignImageUpload(value: FormDataEntryValue | null): value is File {
  return hasCampaignMediaUpload(value);
}

async function saveCampaignMedia(value: File, type: GalleryMediaType) {
  const maxSize = type === "video/mp4" ? maxVideoSize : maxImageSize;
  if (value.size > maxSize) {
    throw new CampaignMediaError(
      type === "video/mp4" ? "MP4 video môže mať najviac 20 MB." : "Obrázok môže mať najviac 5 MB.",
    );
  }

  const bytes = new Uint8Array(await value.arrayBuffer());
  if (!hasExpectedSignature(bytes, type)) {
    throw new CampaignMediaError(
      type === "video/mp4" ? "Súbor nie je platné MP4 video." : "Súbor nie je platný obrázok JPG, PNG alebo WebP.",
    );
  }

  const filename = `${randomUUID()}${galleryMediaTypes[type]}`;
  await mkdir(campaignMediaDirectory, { recursive: true });
  await writeFile(path.join(campaignMediaDirectory, filename), bytes);
  return `/uploads/${filename}`;
}

export async function saveCampaignImage(value: FormDataEntryValue | null) {
  if (!hasCampaignMediaUpload(value)) return null;
  if (!(value.type in imageTypes)) {
    throw new CampaignMediaError("Nahrajte obrázok vo formáte JPG, PNG alebo WebP.");
  }
  return saveCampaignMedia(value, value.type as ImageType);
}

export async function saveCampaignGalleryMedia(value: FormDataEntryValue | null) {
  if (!hasCampaignMediaUpload(value)) return null;
  if (!(value.type in galleryMediaTypes)) {
    throw new CampaignMediaError("Nahrajte obrázok JPG, PNG, WebP alebo MP4 video.");
  }

  const type = value.type as GalleryMediaType;
  const mediaType: CampaignGalleryMediaType = type === "video/mp4" ? "VIDEO" : "IMAGE";
  return {
    mediaUrl: await saveCampaignMedia(value, type),
    mediaType,
  };
}

export async function removeCampaignMedia(mediaUrl: string) {
  if (!mediaUrl.startsWith("/uploads/")) return;

  const filename = path.basename(mediaUrl);
  if (!filename || mediaUrl !== `/uploads/${filename}`) return;

  try {
    await unlink(path.join(campaignMediaDirectory, filename));
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code !== "ENOENT") throw error;
  }
}
