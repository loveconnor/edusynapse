"use server";

import { createClient } from "@/lib/supabase/server";
import { isValidLoginEmail, normalizeLoginEmail } from "@/lib/login-email";

const PREVIEW_OTP = "123456";

type AuthenticationResult =
  | { ok: true }
  | { ok: false; message: string; codeIsInvalid?: boolean };

type EmailAccountLookupResult =
  | { ok: true; exists: boolean }
  | { ok: false };

export async function checkEmailAccount(
  email: string,
): Promise<EmailAccountLookupResult> {
  const normalizedEmail = normalizeLoginEmail(email);

  if (!isValidLoginEmail(normalizedEmail)) return { ok: false };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("email_account_exists", {
    candidate_email: normalizedEmail,
  });

  if (error || typeof data !== "boolean") return { ok: false };

  return { ok: true, exists: data };
}

export async function authenticatePreviewEmail(
  email: string,
  code: string,
): Promise<AuthenticationResult> {
  const normalizedEmail = normalizeLoginEmail(email);

  if (code !== PREVIEW_OTP) {
    return { ok: false, message: "Enter the preview code 123456.", codeIsInvalid: true };
  }

  if (!isValidLoginEmail(normalizedEmail)) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: PREVIEW_OTP,
  });

  if (!signIn.error && signIn.data.session) {
    return { ok: true };
  }

  const signUp = await supabase.auth.signUp({
    email: normalizedEmail,
    password: PREVIEW_OTP,
  });

  if (signUp.error || !signUp.data.session) {
    return {
      ok: false,
      message: "We couldn’t start your preview session. Try again.",
    };
  }

  return { ok: true };
}
