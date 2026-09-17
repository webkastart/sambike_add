export type CampaignMediaLibraryItem = {
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  campaignIds: string[];
  campaignNames: string[];
  label: string | null;
  lastUsedAt: string;
};
