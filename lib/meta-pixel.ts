import "server-only";

import { prisma } from "@/lib/prisma";
import { getOperationalSettings, validMetaPixelId } from "@/lib/operational-settings";

const settingsId = "default";

export function configuredMetaPixelId() {
  return validMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
}

export async function getMetaPixelSettings() {
  const settings = await getOperationalSettings();

  return {
    configured: settings.metaPixelId !== null,
    enabled: settings.metaPixelEnabled,
    pixelId: settings.metaPixelId,
    source: settings.metaPixelSource,
  };
}

export async function setMetaPixelEnabled(enabled: boolean) {
  return prisma.appSetting.upsert({
    where: { id: settingsId },
    create: { id: settingsId, metaPixelEnabled: enabled },
    update: { metaPixelEnabled: enabled },
  });
}

export async function setMetaPixelConfiguration(pixelId: string | null, enabled: boolean) {
  const normalized = validMetaPixelId(pixelId);
  if (pixelId && !normalized) throw new Error("Meta Pixel/Dataset ID musí obsahovať 5 až 30 číslic.");
  if (enabled && !normalized && !configuredMetaPixelId()) throw new Error("Pixel nemožno zapnúť bez platného ID.");
  return prisma.appSetting.upsert({
    where: { id: settingsId },
    create: { id: settingsId, metaPixelId: normalized, metaPixelEnabled: enabled },
    update: { metaPixelId: normalized, metaPixelEnabled: enabled },
  });
}
