"use server";

import { createClient } from "@/lib/supabase/server";

const PREVIEW_OTP = "123456";

type AuthenticationResult =
  | { ok: true }
  | { ok: false; message: string; codeIsInvalid?: boolean };

export async function authenticatePreviewEmail(
  email: string,
  code: string,
): Promise<AuthenticationResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (code !== PREVIEW_OTP) {
    return { ok: false, message: "Enter the preview code 123456.", codeIsInvalid: true };
  }

  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: PREVIEW_OTP,
  });

  if (!signIn.error && signIn.data.session) return { ok: true };

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
