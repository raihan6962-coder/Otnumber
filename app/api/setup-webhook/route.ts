import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return NextResponse.json({ success: false, error: "Provide ?domain=your-vercel-domain.vercel.app" });
  }

  const webhookUrl = `https://${domain}/api/telegram`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, allowed_updates: ["message", "callback_query"] }),
    });
    const data = await res.json();
    return NextResponse.json({ success: data.ok, webhookUrl, result: data });
  } catch (e) {
    return NextResponse.json({ success: false, error: "Failed to set webhook" });
  }
}
