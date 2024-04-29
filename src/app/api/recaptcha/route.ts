import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { recaptchaToken } = await request.json();

  const fetchURL = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`;

  let res;
  try {
    const response = await fetch(fetchURL, { method: "POST" });
    if (!response.ok) {
      const error = new Error(`Failed to verify. (Status: ${response.status})`);
      throw error;
    }
    res = await response.json();
  } catch (error) {
    console.error("Recaptcha verify error:", error);
    return NextResponse.json({ success: false });
  }

  if (res && res.success && res.score > 0.5) {
    return NextResponse.json({
      success: true,
      score: res.score,
    });
  } else {
    return NextResponse.json({ success: false });
  }
}
