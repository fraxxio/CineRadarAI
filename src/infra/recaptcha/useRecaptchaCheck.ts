"use client";
import { useState } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

// the reCAPTCHA token sent with each chat message; the server verifies it
export function useRecaptchaCheck(enabled: boolean) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [failed, setFailed] = useState(false);

  // null when there's no token to send
  async function getToken(): Promise<string | null> {
    if (!executeRecaptcha) {
      console.log("Execute recaptcha not yet available");
      return null;
    }
    try {
      return await executeRecaptcha("AIchatSubmit");
    } catch (error) {
      console.error("Recaptcha token error (Client):", error);
      return null;
    }
  }

  // shows the failure message for a while
  function showFailed() {
    setFailed(true);
    setTimeout(() => {
      setFailed(false);
    }, 3000);
  }

  return { getToken: enabled ? getToken : undefined, showFailed, failed };
}
