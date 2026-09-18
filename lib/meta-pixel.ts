import "server-only";

import { prisma } from "@/lib/prisma";

const settingsId = "default";
const pixelIdPattern = /^\d{5,30}$/;

export function configuredMetaPixelId() {
  const value = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() ?? "";
  return pixelIdPattern.test(value) ? value : null;
}

export async function getMetaPixelSettings() {
  const pixelId = configuredMetaPixelId();
  const setting = await prisma.appSetting.findUnique({ where: { id: settingsId } });

  return {
    configured: pixelId !== null,
    enabled: pixelId !== null && setting?.metaPixelEnabled === true,
    pixelId,
  };
}

export async function setMetaPixelEnabled(enabled: boolean) {
  return prisma.appSetting.upsert({
    where: { id: settingsId },
    create: { id: settingsId, metaPixelEnabled: enabled },
    update: { metaPixelEnabled: enabled },
  });
}
