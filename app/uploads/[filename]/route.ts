import { readFile } from "node:fs/promises";
import path from "node:path";
import { campaignImagesDirectory } from "@/lib/campaign-image";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const extension = path.extname(filename).toLowerCase();

  if (!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(filename) || !contentTypes[extension]) {
    return new Response("Obrázok sa nenašiel.", { status: 404 });
  }

  try {
    const image = await readFile(path.join(campaignImagesDirectory, filename));
    return new Response(image, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentTypes[extension],
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === "ENOENT") {
      return new Response("Obrázok sa nenašiel.", { status: 404 });
    }
    throw error;
  }
}
