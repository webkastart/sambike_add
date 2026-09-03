import { readFile } from "node:fs/promises";
import path from "node:path";
import { campaignMediaDirectory } from "@/lib/campaign-media";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

function requestedRange(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match || (!match[1] && !match[2])) return null;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start < 0 || start >= size || requestedEnd < start) {
    return null;
  }
  return { start, end: Math.min(requestedEnd, size - 1) };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  const extension = path.extname(filename).toLowerCase();

  if (!/^[a-f0-9-]+\.(jpg|png|webp|mp4)$/.test(filename) || !contentTypes[extension]) {
    return new Response("Súbor sa nenašiel.", { status: 404 });
  }

  try {
    const media = await readFile(path.join(campaignMediaDirectory, filename));
    const headers = {
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": contentTypes[extension],
      "X-Content-Type-Options": "nosniff",
    };
    const rangeHeader = request.headers.get("range");
    if (!rangeHeader) {
      return new Response(media, { headers: { ...headers, "Content-Length": String(media.length) } });
    }

    const range = requestedRange(rangeHeader, media.length);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${media.length}` },
      });
    }
    const chunk = media.subarray(range.start, range.end + 1);
    return new Response(chunk, {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(chunk.length),
        "Content-Range": `bytes ${range.start}-${range.end}/${media.length}`,
      },
    });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? error.code : null;
    if (code === "ENOENT") {
      return new Response("Súbor sa nenašiel.", { status: 404 });
    }
    throw error;
  }
}
