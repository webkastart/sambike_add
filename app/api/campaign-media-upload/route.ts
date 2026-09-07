import {
  CampaignMediaError,
  createCampaignMediaUploadUrl,
  type GalleryMediaType,
  removeCampaignMedia,
  validateUploadedCampaignGalleryMedia,
} from "@/lib/campaign-media";

export const runtime = "nodejs";

const filenamePattern = /^[a-f0-9-]+\.(jpg|png|webp|mp4)$/;
const allowedTypes = new Set<GalleryMediaType>(["image/jpeg", "image/png", "image/webp", "video/mp4"]);

function errorResponse(error: unknown, status = 400) {
  const message = error instanceof CampaignMediaError
    ? error.message
    : "Nahrávanie súboru zlyhalo. Skúste to znova.";
  if (!(error instanceof CampaignMediaError)) console.error("Campaign media upload API failed:", error);
  return Response.json({ error: message }, { status });
}

function requestHasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";

  try {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host");
    return Boolean(host && new URL(origin).host === host);
  } catch {
    return false;
  }
}

function validUploadTarget(filename: unknown): filename is string {
  return typeof filename === "string" && filenamePattern.test(filename);
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return errorResponse(new CampaignMediaError("Neplatný pôvod požiadavky."), 403);

  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.operation === "start") {
      if (typeof body.type !== "string" || !allowedTypes.has(body.type as GalleryMediaType)) {
        throw new CampaignMediaError("Nahrajte obrázok JPG, PNG, WebP alebo MP4 video.");
      }
      const upload = await createCampaignMediaUploadUrl(body.type as GalleryMediaType, Number(body.size));
      if (!upload) {
        if (process.env.NODE_ENV === "production") {
          return errorResponse(
            new CampaignMediaError(
              "Nahrávanie médií nie je na serveri nastavené. V hostingu nastavte Cloudflare R2 úložisko a skúste to znova.",
            ),
            503,
          );
        }
        return Response.json({ directUpload: false }, { status: 409 });
      }
      return Response.json(upload);
    }

    if (body.operation === "complete") {
      if (!validUploadTarget(body.filename)) {
        throw new CampaignMediaError("Nahrávanie súboru má neplatné údaje.");
      }
      const mediaUrl = `/uploads/${body.filename}`;
      const mediaType = String(body.filename).endsWith(".mp4") ? "VIDEO" : "IMAGE";
      try {
        await validateUploadedCampaignGalleryMedia(mediaUrl, mediaType);
      } catch (error) {
        await removeCampaignMedia(mediaUrl);
        throw error;
      }
      return Response.json({ mediaUrl, mediaType });
    }

    throw new CampaignMediaError("Neznáma operácia nahrávania.");
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  if (!requestHasSameOrigin(request)) return errorResponse(new CampaignMediaError("Neplatný pôvod požiadavky."), 403);

  try {
    const body = await request.json() as Record<string, unknown>;
    if (!validUploadTarget(body.filename)) {
      throw new CampaignMediaError("Nahrávanie súboru má neplatné údaje.");
    }
    await removeCampaignMedia(`/uploads/${body.filename}`);
    return new Response(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
