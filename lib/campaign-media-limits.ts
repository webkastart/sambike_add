export const maxCampaignImageSize = 50 * 1024 * 1024;
export const maxCampaignVideoSize = 500 * 1024 * 1024;

// Local development falls back to a Server Action upload. Keep that request
// below Next.js' configured 26 MB body limit; production uploads go directly
// from the browser to R2 and do not use this batch limit.
export const maxFallbackUploadBatchSize = 20 * 1024 * 1024;

export const campaignImageSizeLabel = "50 MB";
export const campaignVideoSizeLabel = "500 MB";

