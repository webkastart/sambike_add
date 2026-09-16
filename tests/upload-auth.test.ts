import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({ isAdminAuthenticated: vi.fn().mockResolvedValue(false) }));

import { DELETE, POST } from "@/app/api/campaign-media-upload/route";

describe("campaign upload API", () => {
  it("rejects upload URL creation without an admin session", async () => {
    const response = await POST(new Request("https://example.com/api/campaign-media-upload", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("rejects media deletion without an admin session", async () => {
    const response = await DELETE(new Request("https://example.com/api/campaign-media-upload", { method: "DELETE", body: "{}" }));
    expect(response.status).toBe(401);
  });
});
