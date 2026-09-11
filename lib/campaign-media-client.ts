"use client";

export type PreparedCampaignMedia = {
  mediaType: "IMAGE" | "VIDEO";
  mediaUrl: string;
};

const uploadEndpoint = "/api/campaign-media-upload";

async function responseError(response: Response) {
  if (response.status === 413) {
    return "Server odmietol súbor pre jeho veľkosť. Skontrolujte nastavenie Cloudflare R2 úložiska.";
  }
  try {
    const body = await response.json() as { error?: string };
    return body.error || "Nahrávanie súboru zlyhalo.";
  } catch {
    return "Nahrávanie súboru zlyhalo.";
  }
}

function uploadDirectlyToStorage(
  file: File,
  uploadUrl: string,
  onProgress: (uploadedBytes: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", uploadUrl);
    request.setRequestHeader("Content-Type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(file.size);
        resolve();
        return;
      }
      reject(new Error(`Úložisko odmietlo nahrávanie (chyba ${request.status}). Skúste to znova.`));
    };
    request.onerror = () => reject(new Error(
      "Súbor sa nepodarilo odoslať do úložiska. Skontrolujte internetové pripojenie a CORS nastavenie Cloudflare R2 pre túto doménu.",
    ));
    request.onabort = () => reject(new Error("Nahrávanie súboru bolo prerušené."));
    request.send(file);
  });
}

export async function uploadCampaignMedia(
  file: File,
  onProgress: (uploadedBytes: number) => void,
) {
  const startResponse = await fetch(uploadEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "start", size: file.size, type: file.type }),
  });
  if (startResponse.status === 409) return null;
  if (!startResponse.ok) throw new Error(await responseError(startResponse));

  const start = await startResponse.json() as { filename: string; uploadUrl: string };
  if (!start.filename || !start.uploadUrl) throw new Error("Server vrátil neplatné údaje pre nahrávanie súboru.");

  let completed = false;
  try {
    await uploadDirectlyToStorage(file, start.uploadUrl, onProgress);

    const completeResponse = await fetch(uploadEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "complete",
        filename: start.filename,
        size: file.size,
        type: file.type,
      }),
    });
    if (!completeResponse.ok) throw new Error(await responseError(completeResponse));
    completed = true;
    return await completeResponse.json() as PreparedCampaignMedia;
  } finally {
    if (!completed) {
      void fetch(uploadEndpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: start.filename }),
      });
    }
  }
}
