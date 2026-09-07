import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.2oo9.cloud/MXS47FLFX0U/tnezs/@public/api";
const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";
const ADMIN_CHAT_ID = "7259050773";

const tempStore: Record<string, any> = {};
const historyStore: any[] = [];

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

async function sendTelegramMessage(chatId: string, text: string, parseMode?: string) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode || "Markdown" }),
    });
  } catch (e) {
    console.error("Telegram send error:", e);
  }
}

async function notifyAdmin(number: string, otp: string, source: string, country: string) {
  const msg = `🔔 *OTP Received Alert*

📞 *Number:* \`${number}\`
🔑 *OTP:* \`${otp}\`
🌍 *Country:* ${country}
📡 *Source:* ${source}
🕐 *Time:* ${new Date().toISOString()}`;
  await sendTelegramMessage(ADMIN_CHAT_ID, msg);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "checkOtp") {
    const id = searchParams.get("id");
    if (!id || !tempStore[id]) {
      return NextResponse.json({ success: false, error: "Not found" });
    }
    const temp = tempStore[id];

    try {
      const consoleRes = await fetch(`${API_BASE}/console`);
      const consoleData = await consoleRes.json();

      if (consoleData && Array.isArray(consoleData)) {
        for (const entry of consoleData) {
          const entryPhone = entry.phone || entry.number || "";
          const entryMessage = entry.message || entry.text || entry.body || "";

          if (entryPhone.includes(temp.number) || entryPhone.includes(temp.cleanNumber)) {
            const otpMatch = entryMessage.match(/(\d{4,6})/);
            if (otpMatch && !temp.otp) {
              const otpCode = otpMatch[1];
              temp.otp = otpCode;
              temp.status = "otp_received";
              temp.otpReceivedAt = Date.now();

              historyStore.push({
                id: temp.id,
                number: temp.number,
                country: temp.country,
                countryCode: temp.countryCode,
                otp: otpCode,
                source: temp.source,
                createdAt: temp.createdAt,
                receivedAt: Date.now(),
              });

              notifyAdmin(temp.number, otpCode, temp.source, temp.country);
              sendTelegramMessage(temp.chatId?.toString() || "", `🔑 OTP for \`${temp.number}\`:\n\n\`${otpCode}\``, "Markdown");
            }
          }
        }
      }
    } catch (e) {
      console.error("Console check error:", e);
    }

    if (temp.status === "active" && Date.now() - temp.createdAt > 5 * 60 * 1000) {
      temp.status = "expired";
    }

    return NextResponse.json({
      success: true,
      data: {
        id: temp.id,
        number: temp.number,
        status: temp.status,
        otp: temp.otp || null,
        otpReceivedAt: temp.otpReceivedAt || null,
      },
    });
  }

  if (action === "status") {
    const id = searchParams.get("id");
    if (!id || !tempStore[id]) {
      return NextResponse.json({ success: false, error: "Not found" });
    }
    return NextResponse.json({ success: true, data: tempStore[id] });
  }

  if (action === "adminData") {
    const password = searchParams.get("password");
    if (password !== "2808") {
      return NextResponse.json({ success: false, error: "Unauthorized" });
    }

    const allTemps = Object.values(tempStore);
    const active = allTemps.filter((t: any) => t.status === "active" || t.status === "otp_received");
    const totalGenerated = allTemps.length;

    return NextResponse.json({
      success: true,
      data: {
        totalGenerated,
        activeNumbers: active.map((t: any) => ({
          id: t.id,
          number: t.number,
          country: t.country,
          source: t.source,
          status: t.status,
          createdAt: t.createdAt,
          otp: t.otp || null,
        })),
        history: historyStore.map((h: any) => ({
          id: h.id,
          number: h.number,
          country: h.country,
          otp: h.otp,
          source: h.source,
          createdAt: h.createdAt,
          receivedAt: h.receivedAt,
        })),
      },
    });
  }

  return NextResponse.json({ success: true, message: "Numbers API active" });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, country, source, telegramUserId, chatId } = body;

  if (action === "getNumber") {
    try {
      const getNumRes = await fetch(`${API_BASE}/getnum`);
      const numData = await getNumRes.json();

      const number = numData.number || numData.phone || (numData.data && (numData.data.number || numData.data.phone)) || "";
      const cleanNumber = number.replace(/[^\d+]/g, "");

      if (!number) {
        return NextResponse.json({ success: false, error: "No numbers available. Try again later." });
      }

      const id = generateId();
      const countryName = body.country || "Unknown";

      const tempEntry = {
        id,
        number: cleanNumber || number,
        country: countryName,
        countryCode: countryName,
        source: source || "web",
        telegramUserId: telegramUserId || null,
        chatId: chatId || null,
        createdAt: Date.now(),
        status: "active",
        otp: null,
        otpReceivedAt: null,
      };

      tempStore[id] = tempEntry;

      try {
        await fetch(`${API_BASE}/liveaccess?number=${encodeURIComponent(cleanNumber || number)}`);
      } catch {
        // best effort
      }

      return NextResponse.json({
        success: true,
        data: {
          id: tempEntry.id,
          number: tempEntry.number,
          country: tempEntry.country,
          countryCode: tempEntry.countryCode,
          status: tempEntry.status,
          createdAt: tempEntry.createdAt,
        },
      });
    } catch (e) {
      return NextResponse.json({ success: false, error: "Failed to fetch number from provider." });
    }
  }

  if (action === "reportOtp") {
    const { id, otp } = body;
    if (id && tempStore[id]) {
      tempStore[id].otp = otp;
      tempStore[id].status = "otp_received";
      tempStore[id].otpReceivedAt = Date.now();

      const temp = tempStore[id];
      historyStore.push({
        id: temp.id,
        number: temp.number,
        country: temp.country,
        otp: temp.otp,
        source: temp.source,
        createdAt: temp.createdAt,
        receivedAt: Date.now(),
      });

      notifyAdmin(temp.number, otp, temp.source, temp.country);

      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "Invalid" });
  }

  return NextResponse.json({ success: false, error: "Unknown action" });
}
