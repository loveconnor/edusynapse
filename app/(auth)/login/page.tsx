"use client";

import { GrainGradient } from "@paper-design/shaders-react";
import { GoogleIcon } from "love-ui/logos";
import { useReducedMotion } from "motion/react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTPInput, type OTPStatus } from "@/components/motion/otp-input";
import { Separator } from "@/components/ui/separator";

const CODE = "123456";

export default function LoginPage() {
  const prefersReducedMotion = useReducedMotion();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otpValue, setOtpValue] = useState("");
  const [otpStatus, setOtpStatus] = useState<OTPStatus>("idle");

  function showOtpStep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOtpValue("");
    setOtpStatus("idle");
    setStep("otp");
  }

  function showEmailStep() {
    setOtpValue("");
    setOtpStatus("idle");
    setStep("email");
  }

  return (
    <div className="w-full sm:h-screen lg:grid lg:grid-cols-2">
      <div className="mx-auto h-full w-full max-w-md space-y-6 px-4 py-4 sm:px-0 lg:py-20">
        <div className="flex h-full flex-col justify-center space-y-6">
          {step === "email" ? (
            <>
              <h1 className="text-3xl font-bold">Sign in to your account</h1>

              <form className="space-y-6" onSubmit={showOtpStep}>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1"
                  />
                </div>

                <Button type="submit" className="w-full">
                  Continue with email
                </Button>
              </form>

              <div className="space-y-6">
                <div className="relative flex items-center gap-2">
                  <Separator className="flex-1" />
                  <span className="text-muted-foreground shrink-0 text-sm">
                    or
                  </span>
                  <Separator className="flex-1" />
                </div>

                <Button variant="outline" className="relative w-full">
                  <GoogleIcon
                    className="absolute start-4 size-5"
                    aria-hidden="true"
                    focusable="false"
                  />
                  Continue with Google
                </Button>
              </div>
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
                errorMessage="Wrong code, try again."
                value={otpValue}
                status={otpStatus}
                autoFocus
                onChange={(value) => {
                  setOtpValue(value);
                  if (otpStatus !== "idle") setOtpStatus("idle");
                }}
                onComplete={(value) =>
                  setOtpStatus(value === CODE ? "success" : "error")
                }
              />

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
        </div>
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
