import { describe, expect, it } from "vitest";
import { normalizePhone, parseLeadSubmission } from "@/lib/lead-validation";

function validForm() {
  const form = new FormData();
  Object.entries({
    campaignId: "campaign-1", name: "  Ján Novák  ", phone: "0904 123 456", email: "JAN@EXAMPLE.COM",
    note: "Prosím o termín.", consent: "on", formToken: "x".repeat(40), website: "", "cf-turnstile-response": "token",
  }).forEach(([key, value]) => form.set(key, value));
  return form;
}

describe("lead validation", () => {
  it("normalizes valid contact data", () => {
    const result = parseLeadSubmission(validForm());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Ján Novák");
      expect(result.data.email).toBe("jan@example.com");
      expect(normalizePhone(result.data.phone)).toBe("+421904123456");
    }
  });

  it("rejects invalid and oversized values", () => {
    const form = validForm();
    form.set("email", "nie-je-email");
    expect(parseLeadSubmission(form).success).toBe(false);
    form.set("email", "ok@example.com");
    form.set("note", "x".repeat(2001));
    expect(parseLeadSubmission(form).success).toBe(false);
  });
});
