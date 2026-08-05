"use client";

import { GrainGradient } from "@paper-design/shaders-react";
import { useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { authenticatePreviewEmail, checkEmailAccount } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput, type OTPStatus } from "@/components/motion/otp-input";
import { isValidLoginEmail, normalizeLoginEmail } from "@/lib/login-email";

const CODE = "123456";

const EMAIL_MESSAGE = {
  neutral: {
    heading: "Sign in or create an account",
    description: "Enter your email address to continue.",
  },
  existing: {
    heading: "Welcome back",
    description: "Good to see you again. Let’s pick up where you left off.",
  },
  new: {
    heading: "Create your account",
    description: "Welcome to EduSynapse. Let’s get you set up.",
  },
  unavailable: {
    heading: "Sign in or create an account",
    description: "We couldn’t check this email. You can still continue.",
  },
} as const;

type EmailAccountLookup = {
  email: string;
  status: "checking" | "existing" | "new" | "unavailable";
};

export default function LoginPage() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpStatus, setOtpStatus] = useState<OTPStatus>("idle");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailAccountLookup, setEmailAccountLookup] =
    useState<EmailAccountLookup | null>(null);

  const normalizedEmail = normalizeLoginEmail(email);
  const currentLookupStatus =
    emailAccountLookup?.email === normalizedEmail
      ? emailAccountLookup.status
      : null;
  const emailMessage =
    currentLookupStatus === "existing" ||
    currentLookupStatus === "new" ||
    currentLookupStatus === "unavailable"
      ? EMAIL_MESSAGE[currentLookupStatus]
      : EMAIL_MESSAGE.neutral;
  const submitLabel =
    currentLookupStatus === "existing"
      ? "Continue to sign in"
      : currentLookupStatus === "new"
        ? "Continue to create account"
        : "Continue with email";

  useEffect(() => {
    if (step !== "email" || !isValidLoginEmail(email)) return;

    const lookupEmail = normalizeLoginEmail(email);
    let isCancelled = false;

    const lookupTimer = window.setTimeout(() => {
      setEmailAccountLookup({ email: lookupEmail, status: "checking" });

      void checkEmailAccount(lookupEmail).then((result) => {
        if (isCancelled) return;

        setEmailAccountLookup({
          email: lookupEmail,
          status: result.ok
            ? result.exists
              ? "existing"
              : "new"
            : "unavailable",
        });
      });
    }, 200);

    return () => {
      isCancelled = true;
      window.clearTimeout(lookupTimer);
    };
  }, [email, step]);

  function showOtpStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOtpValue("");
    setOtpStatus("idle");
    setAuthError(null);
    setStep("otp");
  }

  function showEmailStep() {
    setOtpValue("");
    setOtpStatus("idle");
    setAuthError(null);
    setStep("email");
  }

  async function verifyPreviewCode(value: string) {
    setIsVerifying(true);
    setAuthError(null);
    const result = await authenticatePreviewEmail(email, value);

    if (!result.ok) {
      setOtpStatus("error");
      setAuthError(result.message);
      setIsVerifying(false);
      return;
    }

    setOtpStatus("success");
    setIsVerifying(false);
    router.replace("/onboarding");
  }

  return (
    <div className="min-h-svh w-full lg:grid lg:h-screen lg:grid-cols-2">
      <div className="flex min-h-svh flex-col px-4 sm:px-8 lg:min-h-0">
        <header className="flex h-20 shrink-0 items-center justify-center sm:h-24">
          <span className="text-lg font-semibold tracking-tight">
            EduSynapse
          </span>
        </header>

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center space-y-6 py-8">
          {step === "email" ? (
            <>
              <div
                className="space-y-2"
                aria-live="polite"
                aria-atomic="true"
                aria-busy={currentLookupStatus === "checking"}
              >
                <h1 className="text-3xl font-bold">{emailMessage.heading}</h1>
                <p id="email-guidance" className="text-sm text-muted-foreground">
                  {emailMessage.description}
                </p>
              </div>

              <form className="space-y-6" onSubmit={showOtpStep}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    aria-describedby="email-guidance"
                    required
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailAccountLookup(null);
                    }}
                    size="lg"
                    className="mt-1"
                  />
                </div>

                <Button type="submit" size="xl" className="w-full">
                  {submitLabel}
                </Button>
              </form>
            </>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">Enter your verification code</h1>
                <p className="text-muted-foreground text-sm">
                  Testing sign-in for{" "}
                  <span className="font-medium text-foreground">{email}</span>
                </p>
              </div>

              <OTPInput
                label="Verification code"
                hint={`Enter ${CODE} to verify.`}
                successMessage="Verified."
                errorMessage={authError ?? "Enter the preview code 123456."}
                value={otpValue}
                status={otpStatus}
                disabled={isVerifying}
                autoFocus
                onChange={(value) => {
                  setOtpValue(value);
                  setAuthError(null);
                  if (otpStatus !== "idle") setOtpStatus("idle");
                }}
                onComplete={(value) => void verifyPreviewCode(value)}
              />

              {isVerifying ? (
                <p className="text-sm text-muted-foreground" role="status">
                  Starting your session…
                </p>
              ) : null}

              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={showEmailStep}
              >
                Use a different email
              </Button>
            </div>
          )}
        </main>

        <footer className="flex min-h-20 shrink-0 items-center justify-center py-5">
          <p className="text-muted-foreground text-center text-sm sm:whitespace-nowrap">
            By clicking continue, you agree to our{" "}
            <a
              href="#"
              className="text-foreground rounded-sm underline underline-offset-4 transition-opacity hover:opacity-70"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="text-foreground rounded-sm underline underline-offset-4 transition-opacity hover:opacity-70"
            >
              Privacy Policy
            </a>
            {"."}
          </p>
        </footer>
      </div>

      <div
        className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_65%_35%,#6d5dfc_0%,#2247ff_28%,#101629_58%,#05060b_100%)] lg:block"
        aria-hidden="true"
      >
        <GrainGradient
          className="absolute inset-0 size-full"
          style={{ width: "100%", height: "100%" }}
          colorBack="#05060b"
          colors={["#17152f", "#5145ff", "#18a5ff", "#c9ff5c"]}
          shape="ripple"
          softness={0.62}
          intensity={0.48}
          noise={0.34}
          scale={0.72}
          rotation={-12}
          originX={0.58}
          originY={0.42}
          offsetX={0.08}
          offsetY={-0.04}
          speed={prefersReducedMotion ? 0 : 0.16}
          frame={6800}
          minPixelRatio={1}
          maxPixelCount={2_073_600}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_20%,transparent_0%,transparent_34%,rgba(4,5,12,0.38)_100%)]" />
        <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-black/15" />
      </div>
    </div>
  );
}
