import { describe, it, expect } from "vitest";
import { buildContactCvSafeUpdates } from "@/lib/contactCvEligibility";

type ContactRow = {
  email?: string | null;
  cv_email?: boolean | null;
  phone?: string | null;
};

describe("buildContactCvSafeUpdates", () => {
  it("clears cv_email when email is removed", () => {
    expect(
      buildContactCvSafeUpdates<ContactRow>(
        { email: "kontakt@stacq.no", cv_email: true },
        { email: "" },
      ),
    ).toEqual({ email: "", cv_email: false });
  });

  it("keeps unrelated updates untouched", () => {
    expect(
      buildContactCvSafeUpdates<ContactRow>(
        { email: "kontakt@stacq.no", cv_email: true },
        { phone: "90000000" },
      ),
    ).toEqual({ phone: "90000000" });
  });

  it("sanitizes direct cv_email updates against the next email value", () => {
    expect(
      buildContactCvSafeUpdates<ContactRow>(
        { email: null, cv_email: false },
        { cv_email: true },
      ),
    ).toEqual({ cv_email: false });

    expect(
      buildContactCvSafeUpdates<ContactRow>(
        { email: "kontakt@stacq.no", cv_email: false },
        { cv_email: true },
      ),
    ).toEqual({ cv_email: true });
  });
});
