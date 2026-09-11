import { randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  campaignImageSizeLabel,
  campaignVideoSizeLabel,
  maxCampaignImageSize,
  maxCampaignVideoSize,
} from "@/lib/campaign-media-limits";

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
export type GalleryMediaType = keyof typeof galleryMediaTypes;

export type CampaignGalleryMediaType = "IMAGE" | "VIDEO";

export class CampaignMediaError extends Error {}

type MediaRange = {
  start: number;
  end: number;
};

type R2Config = {
  bucket: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  keyPrefix: string;
};

let s3Client: S3Client | null = null;

function optionalEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function requiredEnv(name: string) {
  const value = optionalEnv(name);
  if (!value) {
    throw new CampaignMediaError(`Chýba nastavenie ${name} pre Cloudflare R2 storage.`);
  }
  return value;
}

function mediaStorage() {
  return optionalEnv("CAMPAIGN_MEDIA_STORAGE").toLowerCase() || "local";
}

function r2Config(): R2Config {
  const endpoint = optionalEnv("R2_ENDPOINT")
    || `https://${requiredEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`;

  return {
    bucket: requiredEnv("R2_BUCKET_NAME"),
    endpoint,
    accessKeyId: requiredEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("R2_SECRET_ACCESS_KEY"),
    keyPrefix: optionalEnv("R2_KEY_PREFIX") || "campaign-images",
  };
}

function r2Client(config: R2Config) {
  s3Client ??= new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    requestChecksumCalculation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return s3Client;
}

function storageKey(filename: string, config: R2Config) {
  const prefix = config.keyPrefix.replace(/^\/+|\/+$/g, "");
  return prefix ? `${prefix}/${filename}` : filename;
}

function isR2Storage() {
  const storage = mediaStorage();
  if (storage === "local") return false;
  if (storage === "r2") return true;
  throw new CampaignMediaError(`Neznámy campaign media storage: ${storage}. Použite "local" alebo "r2".`);
}

async function bodyBytes(body: unknown) {
  const transformable = body as { transformToByteArray?: () => Promise<Uint8Array> } | null;
  if (transformable?.transformToByteArray) return Buffer.from(await transformable.transformToByteArray());
  if (body instanceof Uint8Array) return Buffer.from(body);
  throw new CampaignMediaError("Nepodarilo sa načítať súbor z Cloudflare R2.");
}

export function isMissingCampaignMedia(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "NoSuchKey"
    || error.name === "NotFound"
    || ("code" in error && error.code === "ENOENT")
  );
}

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

function mediaTypeForContentType(type: GalleryMediaType): CampaignGalleryMediaType {
  return type === "video/mp4" ? "VIDEO" : "IMAGE";
}

function validateCampaignMediaSize(type: GalleryMediaType, size: number) {
  const maxSize = type === "video/mp4" ? maxCampaignVideoSize : maxCampaignImageSize;
  if (!Number.isSafeInteger(size) || size <= 0 || size > maxSize) {
    throw new CampaignMediaError(
      type === "video/mp4"
        ? `MP4 video môže mať najviac ${campaignVideoSizeLabel}.`
        : `Obrázok môže mať najviac ${campaignImageSizeLabel}.`,
    );
  }
}

function campaignMediaFilename(mediaUrl: string) {
  const filename = path.basename(mediaUrl);
  if (
    mediaUrl !== `/uploads/${filename}`
    || !/^[a-f0-9-]+\.(jpg|png|webp|mp4)$/.test(filename)
  ) {
    throw new CampaignMediaError("Nahraný súbor má neplatnú adresu.");
  }
  return filename;
}

export function hasCampaignMediaUpload(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

export function hasCampaignImageUpload(value: FormDataEntryValue | null): value is File {
  return hasCampaignMediaUpload(value);
}

async function saveCampaignMedia(value: File, type: GalleryMediaType) {
  validateCampaignMediaSize(type, value.size);

  const bytes = new Uint8Array(await value.arrayBuffer());
  if (!hasExpectedSignature(bytes, type)) {
    throw new CampaignMediaError(
      type === "video/mp4" ? "Súbor nie je platné MP4 video." : "Súbor nie je platný obrázok JPG, PNG alebo WebP.",
    );
  }

  const filename = `${randomUUID()}${galleryMediaTypes[type]}`;
  try {
    if (isR2Storage()) {
      const config = r2Config();
      await r2Client(config).send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey(filename, config),
        Body: bytes,
        ContentType: type,
        CacheControl: "public, max-age=31536000, immutable",
      }));
    } else {
      await mkdir(campaignMediaDirectory, { recursive: true });
      await writeFile(path.join(campaignMediaDirectory, filename), bytes);
    }
  } catch (error) {
    if (error instanceof CampaignMediaError) throw error;
    console.error("Campaign media upload failed:", error);
    throw new CampaignMediaError(
      isR2Storage()
        ? "Súbor sa nepodarilo nahrať do Cloudflare R2. Skontrolujte R2 bucket, access key a secret v produkčných nastaveniach."
        : "Súbor sa nepodarilo uložiť. Skontrolujte úložisko servera alebo to skúste znova.",
    );
  }
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
  const mediaType = mediaTypeForContentType(type);
  return {
    mediaUrl: await saveCampaignMedia(value, type),
    mediaType,
  };
}

export async function createCampaignMediaUploadUrl(type: GalleryMediaType, size: number) {
  if (!(type in galleryMediaTypes)) {
    throw new CampaignMediaError("Nahrajte obrázok JPG, PNG, WebP alebo MP4 video.");
  }
  validateCampaignMediaSize(type, size);
  if (!isR2Storage()) return null;

  const config = r2Config();
  const filename = `${randomUUID()}${galleryMediaTypes[type]}`;
  const uploadUrl = await getSignedUrl(
    r2Client(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: storageKey(filename, config),
      ContentType: type,
    }),
    { expiresIn: 60 * 60 },
  );
  return { filename, uploadUrl };
}

export async function validateUploadedCampaignMedia(mediaUrl: string, mediaType: CampaignGalleryMediaType) {
  const filename = campaignMediaFilename(mediaUrl);
  const extension = path.extname(filename).toLowerCase();
  const type = Object.entries(galleryMediaTypes).find(([, expectedExtension]) => expectedExtension === extension)?.[0] as GalleryMediaType | undefined;
  if (!type || mediaTypeForContentType(type) !== mediaType) {
    throw new CampaignMediaError("Nahraný súbor má neplatný formát.");
  }

  const size = await campaignMediaSize(filename);
  validateCampaignMediaSize(type, size);
  const signature = await readCampaignMedia(filename, { start: 0, end: Math.min(11, size - 1) });
  if (!hasExpectedSignature(signature, type)) {
    throw new CampaignMediaError(
      type === "video/mp4" ? "Súbor nie je platné MP4 video." : "Súbor nie je platný obrázok JPG, PNG alebo WebP.",
    );
  }
  return { mediaType, mediaUrl, size };
}

export async function removeCampaignMedia(mediaUrl: string) {
  if (!mediaUrl.startsWith("/uploads/")) return;

  const filename = path.basename(mediaUrl);
  if (!filename || mediaUrl !== `/uploads/${filename}`) return;

  if (isR2Storage()) {
    const config = r2Config();
    await r2Client(config).send(new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: storageKey(filename, config),
    }));
    return;
  }

  try {
    await unlink(path.join(campaignMediaDirectory, filename));
  } catch (error) {
    if (!isMissingCampaignMedia(error)) throw error;
  }
}

export async function campaignMediaSize(filename: string) {
  if (isR2Storage()) {
    const config = r2Config();
    const response = await r2Client(config).send(new HeadObjectCommand({
      Bucket: config.bucket,
      Key: storageKey(filename, config),
    }));
    if (typeof response.ContentLength !== "number") {
      throw new CampaignMediaError("Nepodarilo sa zistiť veľkosť súboru z Cloudflare R2.");
    }
    return response.ContentLength;
  }

  return (await stat(path.join(campaignMediaDirectory, filename))).size;
}

export async function readCampaignMedia(filename: string, range?: MediaRange): Promise<Buffer> {
  if (isR2Storage()) {
    const config = r2Config();
    const response = await r2Client(config).send(new GetObjectCommand({
      Bucket: config.bucket,
      Key: storageKey(filename, config),
      Range: range ? `bytes=${range.start}-${range.end}` : undefined,
    }));
    return bodyBytes(response.Body);
  }

  const media = await readFile(path.join(campaignMediaDirectory, filename));
  return range ? media.subarray(range.start, range.end + 1) : media;
}
