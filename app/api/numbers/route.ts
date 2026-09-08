import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.2oo9.cloud/MXS47FLFX0U/tnezs/@public/api";
const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";
const ADMIN_CHAT_ID = "7259050773";
const API_KEY = process.env.API_2OO9_KEY || "";

const tempStore: Record<string, any> = {};
const historyStore: any[] = [];

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function getHeaders() {
  const h: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  };
  if (API_KEY) {
    h["mauthapi"] = API_KEY;
  }
  return h;
}

async function apiGet(endpoint: string) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "GET",
    headers: getHeaders(),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function apiPost(endpoint: string, body: any) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
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

function extractOtpFromMessage(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(\d{4,6})/);
  return match ? match[1] : null;
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

    if (!API_KEY) {
      return NextResponse.json({ success: false, error: "API key not configured. Set API_2OO9_KEY env var." });
    }

    try {
      const consoleRes = await apiGet("console");
      if (consoleRes.data?.meta?.code === 200 && consoleRes.data?.data?.hits) {
        const hits = consoleRes.data.data.hits;
        for (const hit of hits) {
          const hitRange = hit.range || "";
          const hitNumber = hitRange.replace(/XXX$/, "");
          if (temp.number.includes(hitNumber) || hitNumber.includes(temp.cleanNumber || "")) {
            const otp = extractOtpFromMessage(hit.message);
            if (otp && !temp.otp) {
              temp.otp = otp;
              temp.status = "otp_received";
              temp.otpReceivedAt = Date.now();
              temp.otpSid = hit.sid || "";

              historyStore.push({
                id: temp.id,
                number: temp.number,
                country: temp.country,
                countryCode: temp.countryCode,
                otp,
                sid: hit.sid || "",
                source: temp.source,
                createdAt: temp.createdAt,
                receivedAt: Date.now(),
              });

              notifyAdmin(temp.number, otp, temp.source, temp.country);
              if (temp.chatId) {
                sendTelegramMessage(temp.chatId.toString(), `🔑 OTP for \`${temp.number}\`:\n\n\`${otp}\``, "Markdown");
              }
            }
          }
        }
      }

      const successRes = await apiGet("success-otp");
      if (successRes.data?.meta?.code === 200 && successRes.data?.data?.otps) {
        const otps = successRes.data.data.otps;
        for (const entry of otps) {
          if (entry.number === temp.number || temp.number.includes(entry.number)) {
            const otp = extractOtpFromMessage(entry.message);
            if (otp && !temp.otp) {
              temp.otp = otp;
              temp.status = "otp_received";
              temp.otpReceivedAt = Date.now();

              historyStore.push({
                id: temp.id,
                number: temp.number,
                country: temp.country,
                countryCode: temp.countryCode,
                otp,
                source: temp.source,
                createdAt: temp.createdAt,
                receivedAt: Date.now(),
              });

              notifyAdmin(temp.number, otp, temp.source, temp.country);
              if (temp.chatId) {
                sendTelegramMessage(temp.chatId.toString(), `🔑 OTP for \`${temp.number}\`:\n\n\`${otp}\``, "Markdown");
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("OTP check error:", e);
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

  if (action === "liveaccess") {
    if (!API_KEY) {
      return NextResponse.json({ success: false, error: "API key not configured" });
    }
    const result = await apiGet("liveaccess");
    return NextResponse.json({ success: true, data: result.data });
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
        apiKeyConfigured: !!API_KEY,
        activeNumbers: active.map((t: any) => ({
          id: t.id,
          number: t.number,
          country: t.country,
          rid: t.rid,
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
          sid: h.sid || "",
          source: h.source,
          createdAt: h.createdAt,
          receivedAt: h.receivedAt,
        })),
      },
    });
  }

  return NextResponse.json({
    success: true,
    message: "Numbers API active",
    apiKeyConfigured: !!API_KEY,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, country, source, telegramUserId, chatId, rid } = body;

  if (action === "getNumber") {
    if (!API_KEY) {
      return NextResponse.json({ success: false, error: "API key not configured. Set API_2OO9_KEY env var in Vercel." });
    }

    const countryName = country || "Unknown";
    const rangeId = rid || "26134";

    const result = await apiPost("getnum", { rid: rangeId });

    if (result.data?.meta?.code === 200 && result.data?.data) {
      const d = result.data.data;
      const number = d.no_plus_number || d.national_number || d.full_number || "";
      const fullNumber = d.full_number || `+${number}`;
      const detectedCountry = d.contry || d.country || countryName;
      const operator = d.operator || "";

      const id = generateId();
      const tempEntry = {
        id,
        number: number,
        fullNumber: fullNumber,
        country: detectedCountry,
        countryCode: countryName,
        rid: rangeId,
        operator,
        source: source || "web",
        telegramUserId: telegramUserId || null,
        chatId: chatId || null,
        createdAt: Date.now(),
        status: "active",
        otp: null,
        otpReceivedAt: null,
        cleanNumber: number,
      };

      tempStore[id] = tempEntry;

      return NextResponse.json({
        success: true,
        data: {
          id: tempEntry.id,
          number: tempEntry.number,
          fullNumber: tempEntry.fullNumber,
          country: tempEntry.country,
          countryCode: tempEntry.countryCode,
          operator: tempEntry.operator,
          rid: tempEntry.rid,
          status: tempEntry.status,
          createdAt: tempEntry.createdAt,
        },
      });
    }

    const errMsg = result.data?.message || "Failed to get number from provider";
    const errCode = result.data?.meta?.code || result.status;
    return NextResponse.json({ success: false, error: `${errMsg} (code: ${errCode})` });
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
