export type ContactCvEligibilityInput = {
  email?: string | null;
  cv_email?: boolean | null;
};

export const CONTACT_CV_EMAIL_REQUIRED_MESSAGE = "E-post må legges til først";

export function normalizeContactEmail(email?: string | null): string | null {
  if (typeof email !== "string") return null;
  const trimmed = email.trim();
  return trimmed ? trimmed : null;
}

export function contactHasEmail(contact: ContactCvEligibilityInput): boolean {
  return normalizeContactEmail(contact.email) !== null;
}

export function sanitizeContactCvEmail(email?: string | null, cvEmail?: boolean | null): boolean {
  return Boolean(cvEmail) && contactHasEmail({ email });
}

export function buildContactCvSafeUpdates<T extends ContactCvEligibilityInput>(
  current: T,
  updates: Partial<T>,
): Partial<T> {
  const hasEmailUpdate = Object.prototype.hasOwnProperty.call(updates, "email");
  const normalizedNextEmail = hasEmailUpdate
    ? normalizeContactEmail(updates.email)
    : normalizeContactEmail(current.email);
  const emailUpdates = hasEmailUpdate
    ? ({
        email: normalizedNextEmail,
      } as Partial<T>)
    : {};

  if (Object.prototype.hasOwnProperty.call(updates, "cv_email")) {
    return {
      ...updates,
      ...emailUpdates,
      cv_email: sanitizeContactCvEmail(normalizedNextEmail, updates.cv_email),
    };
  }

  if (hasEmailUpdate && !normalizedNextEmail) {
    return {
      ...updates,
      ...emailUpdates,
      cv_email: false,
    };
  }

  return {
    ...updates,
    ...emailUpdates,
  };
}
