"use client";
import { useState } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

// reCAPTCHA verification to run before each chat message
export function useRecaptchaCheck(enabled: boolean) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [failed, setFailed] = useState(false);

  async function verify(signal: AbortSignal) {
    if (!executeRecaptcha) {
      console.log("Execute recaptcha not yet available");
      return false;
    }
    try {
      const recaptchaToken = await executeRecaptcha("AIchatSubmit");
      const response = await fetch("/api/recaptcha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recaptchaToken }),
        signal,
      });
      if (!response.ok) {
        throw new Error(
          `Failed to verify captcha. (Status: ${response.status})`,
        );
      }
      const res = await response.json();
      if (res.success === false) {
        setFailed(true);
        setTimeout(() => {
          setFailed(false);
        }, 3000);
        return false;
      }
      return true;
    } catch (error) {
      if (!signal.aborted) {
        console.error("Recaptcha verify error (Client):", error);
      }
      return false;
    }
  }

  return { verify: enabled ? verify : undefined, failed };
}
