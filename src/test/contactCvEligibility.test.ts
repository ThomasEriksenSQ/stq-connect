import { describe, expect, it } from "vitest";

import {
  CONTACT_CV_EMAIL_REQUIRED_MESSAGE,
  buildContactCvSafeUpdates,
  contactHasEmail,
  sanitizeContactCvEmail,
} from "@/lib/contactCvEligibility";

describe("contactCvEligibility", () => {
  it("requires a non-empty email before CV-Epost can be enabled", () => {
    expect(contactHasEmail({ email: "" })).toBe(false);
    expect(contactHasEmail({ email: "  " })).toBe(false);
    expect(contactHasEmail({ email: "kontakt@stacq.no" })).toBe(true);
    expect(CONTACT_CV_EMAIL_REQUIRED_MESSAGE).toBe("E-post må legges til først");
  });

  it("forces cv_email off when email is missing", () => {
    expect(sanitizeContactCvEmail(null, true)).toBe(false);
    expect(sanitizeContactCvEmail("   ", true)).toBe(false);
    expect(sanitizeContactCvEmail("kontakt@stacq.no", true)).toBe(true);
  });

  it("turns off CV-Epost when email is cleared", () => {
    expect(
      buildContactCvSafeUpdates(
        { email: "kontakt@stacq.no", cv_email: true },
        { email: "" },
      ),
    ).toEqual({ email: null, cv_email: false });
  });

  it("keeps unrelated updates untouched", () => {
    expect(
      buildContactCvSafeUpdates(
        { email: "kontakt@stacq.no", cv_email: true },
        { phone: "90000000" },
      ),
    ).toEqual({ phone: "90000000" });
  });

  it("sanitizes direct cv_email updates against the next email value", () => {
    expect(
      buildContactCvSafeUpdates(
        { email: null, cv_email: false as boolean },
        { cv_email: true as boolean },
      ),
    ).toEqual({ cv_email: false });

    expect(
      buildContactCvSafeUpdates(
        { email: "kontakt@stacq.no", cv_email: false as boolean },
        { cv_email: true as boolean },
      ),
    ).toEqual({ cv_email: true });
  });

  it("trims email updates before persisting them", () => {
    expect(
      buildContactCvSafeUpdates(
        { email: null, cv_email: false },
        { email: "  kontakt@stacq.no  " },
      ),
    ).toEqual({ email: "kontakt@stacq.no" });
  });
});
