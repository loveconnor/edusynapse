export type VerifiedAccountStatus = "existing" | "created";

export function normalizeLoginEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidLoginEmail(email: string) {
  const normalizedEmail = normalizeLoginEmail(email);

  return (
    normalizedEmail.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  );
}
