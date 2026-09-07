import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.2oo9.cloud/MXS47FLFX0U/tnezs/@public/api";
const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";
const ADMIN_CHAT_ID = "7259050773";

const tempStore: Record<string, any> = {};
const historyStore: any[] = [];

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

const PROVIDER_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Origin": "https://otnumber.vercel.app",
  "Referer": "https://otnumber.vercel.app/",
  "Accept-Language": "en-US,en;q=0.9",
};

async function providerGet(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: PROVIDER_HEADERS,
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  return { status: res.status, ok: res.ok, data };
}

async function providerPost(endpoint: string, body: Record<string, any>) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: PROVIDER_HEADERS,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  return { status: res.status, ok: res.ok, data };
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

function extractNumber(apiResponse: any): string {
  if (!apiResponse) return "";
  if (typeof apiResponse === "string") {
    try { apiResponse = JSON.parse(apiResponse); } catch { return ""; }
  }
  const candidates = [
    apiResponse.number,
    apiResponse.phone,
    apiResponse.data?.number,
    apiResponse.data?.phone,
    apiResponse.data?.data?.number,
    apiResponse.data?.data?.phone,
    apiResponse.result?.number,
    apiResponse.result?.phone,
  ];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.length >= 7) return c;
  }
  return "";
}

function extractOtpFromMessages(apiResponse: any, phoneNumber: string): string | null {
  if (!apiResponse) return null;
  let messages: any[] = [];

  if (Array.isArray(apiResponse)) {
    messages = apiResponse;
  } else if (apiResponse.data && Array.isArray(apiResponse.data)) {
    messages = apiResponse.data;
  } else if (apiResponse.messages && Array.isArray(apiResponse.messages)) {
    messages = apiResponse.messages;
  } else if (apiResponse.result && Array.isArray(apiResponse.result)) {
    messages = apiResponse.result;
  }

  for (const msg of messages) {
    const phone = msg.phone || msg.number || msg.to || "";
    const text = msg.message || msg.text || msg.body || msg.content || "";
    const codeMatch = String(text).match(/(\d{4,6})/);
    if (codeMatch) {
      if (!phoneNumber || String(phone).includes(phoneNumber) || phoneNumber.includes(String(phone))) {
        return codeMatch[1];
      }
    }
  }
  return null;
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
      const endpoints = ["console", "success-otp", "liveaccess"];
      for (const ep of endpoints) {
        try {
          const result = await providerGet(ep, { number: temp.number });
          if (result.ok && result.data) {
            const otp = extractOtpFromMessages(result.data, temp.number);
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
        } catch {
          // try next endpoint
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

  if (action === "debugApi") {
    const endpoint = searchParams.get("endpoint") || "getnum";
    const method = (searchParams.get("method") || "GET").toUpperCase();

    let result;
    if (method === "POST") {
      result = await providerPost(endpoint, { country: "US", service: "general" });
    } else {
      result = await providerGet(endpoint, { country: "US" });
    }

    return NextResponse.json({ success: true, debug: result });
  }

  return NextResponse.json({ success: true, message: "Numbers API active" });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action, country, source, telegramUserId, chatId } = body;

  if (action === "getNumber") {
    const countryName = country || "US";

    const strategies = [
      async () => providerPost("getnum", { country: countryName, service: "general" }),
      async () => providerPost("getnum", { country: countryName }),
      async () => providerGet("getnum", { country: countryName }),
      async () => providerPost("getnum", {}),
      async () => providerGet("getnum", {}),
    ];

    let number = "";
    let lastError = "";

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        console.log(`API Strategy result: status=${result.status}, data=${JSON.stringify(result.data).substring(0, 200)}`);

        if (result.ok || (result.status >= 200 && result.status < 300)) {
          number = extractNumber(result.data);
          if (number) break;
        }

        lastError = `Status ${result.status}: ${JSON.stringify(result.data).substring(0, 100)}`;
      } catch (e: any) {
        lastError = e.message || "Strategy failed";
      }
    }

    if (!number) {
      return NextResponse.json({
        success: false,
        error: "Provider API is not responding correctly. Debug: " + lastError,
      });
    }

    const cleanNumber = number.replace(/[^\d+]/g, "");
    const id = generateId();

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
      cleanNumber: cleanNumber,
    };

    tempStore[id] = tempEntry;

    try {
      await providerGet("liveaccess", { number: cleanNumber || number });
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
