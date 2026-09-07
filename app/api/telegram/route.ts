import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";
const ADMIN_CHAT_ID = "7259050773";
const API_BASE = "https://api.2oo9.cloud/MXS47FLFX0U/tnezs/@public/api";

const COUNTRIES = [
  { name: "United States", code: "US", dial: "+1", flag: "\u{1F1FA}\u{1F1F8}" },
  { name: "United Kingdom", code: "GB", dial: "+44", flag: "\u{1F1EC}\u{1F1E7}" },
  { name: "Canada", code: "CA", dial: "+1", flag: "\u{1F1E8}\u{1F1E6}" },
  { name: "Australia", code: "AU", dial: "+61", flag: "\u{1F1E6}\u{1F1FA}" },
  { name: "Germany", code: "DE", dial: "+49", flag: "\u{1F1E9}\u{1F1EA}" },
  { name: "France", code: "FR", dial: "+33", flag: "\u{1F1EB}\u{1F1F7}" },
  { name: "India", code: "IN", dial: "+91", flag: "\u{1F1EE}\u{1F1F3}" },
  { name: "Brazil", code: "BR", dial: "+55", flag: "\u{1F1E7}\u{1F1F7}" },
  { name: "Japan", code: "JP", dial: "+81", flag: "\u{1F1EF}\u{1F1F5}" },
  { name: "Nigeria", code: "NG", dial: "+234", flag: "\u{1F1F3}\u{1F1EC}" },
  { name: "Philippines", code: "PH", dial: "+63", flag: "\u{1F1F5}\u{1F1ED}" },
  { name: "Indonesia", code: "ID", dial: "+62", flag: "\u{1F1EE}\u{1F1E9}" },
  { name: "Pakistan", code: "PK", dial: "+92", flag: "\u{1F1F5}\u{1F1F0}" },
  { name: "Bangladesh", code: "BD", dial: "+880", flag: "\u{1F1E7}\u{1F1E9}" },
  { name: "Mexico", code: "MX", dial: "+52", flag: "\u{1F1F2}\u{1F1FD}" },
  { name: "Turkey", code: "TR", dial: "+90", flag: "\u{1F1F9}\u{1F1F7}" },
  { name: "Russia", code: "RU", dial: "+7", flag: "\u{1F1F7}\u{1F1FA}" },
  { name: "Egypt", code: "EG", dial: "+20", flag: "\u{1F1EA}\u{1F1EC}" },
  { name: "South Africa", code: "ZA", dial: "+27", flag: "\u{1F1FF}\u{1F1E6}" },
  { name: "Kenya", code: "KE", dial: "+254", flag: "\u{1F1F0}\u{1F1EA}" },
];

const PROVIDER_HEADERS = {
  "Accept": "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Origin": "https://otnumber.vercel.app",
  "Referer": "https://otnumber.vercel.app/",
  "Accept-Language": "en-US,en;q=0.9",
};

interface UserSession {
  step: "idle" | "waiting_country" | "waiting_otp";
  country?: string;
  countryCode?: string;
  tempId?: string;
  number?: string;
}

const userSessions: Record<number, UserSession> = {};

async function tg(method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function providerPost(endpoint: string, reqBody: Record<string, any>) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: PROVIDER_HEADERS,
    body: JSON.stringify(reqBody),
  });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

async function providerGet(endpoint: string, params?: Record<string, string>) {
  const url = new URL(`${API_BASE}/${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { method: "GET", headers: PROVIDER_HEADERS });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

function extractNumber(apiResponse: any): string {
  if (!apiResponse) return "";
  if (typeof apiResponse === "string") {
    try { apiResponse = JSON.parse(apiResponse); } catch { return ""; }
  }
  const candidates = [
    apiResponse.number, apiResponse.phone,
    apiResponse.data?.number, apiResponse.data?.phone,
    apiResponse.data?.data?.number, apiResponse.data?.data?.phone,
    apiResponse.result?.number, apiResponse.result?.phone,
  ];
  for (const c of candidates) {
    if (c && typeof c === "string" && c.length >= 7) return c;
  }
  return "";
}

async function fetchNumberFromProvider(countryCode: string): Promise<string> {
  const strategies = [
    async () => providerPost("getnum", { country: countryCode, service: "general" }),
    async () => providerPost("getnum", { country: countryCode }),
    async () => providerGet("getnum", { country: countryCode }),
    async () => providerPost("getnum", {}),
    async () => providerGet("getnum", {}),
  ];

  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result.ok || (result.status >= 200 && result.status < 300)) {
        const number = extractNumber(result.data);
        if (number) return number;
      }
    } catch {}
  }
  return "";
}

async function sendAdminAlert(number: string, otp: string, country: string) {
  const msg = `🔔 *OTP Received Alert*

📞 *Number:* \`${number}\`
🔑 *OTP:* \`${otp}\`
🌍 *Country:* ${country}
📡 *Source:* Bot
🕐 *Time:* ${new Date().toISOString()}`;
  await tg("sendMessage", { chat_id: ADMIN_CHAT_ID, text: msg, parse_mode: "Markdown" });
}

async function pollForOtp(number: string, chatId: number, countryName: string, retries = 0) {
  if (retries > 60) {
    await tg("sendMessage", { chat_id: chatId, text: "⏰ OTP wait timed out (5 min). Please try again with /start" });
    return;
  }

  const endpoints = ["console", "success-otp", "liveaccess"];
  for (const ep of endpoints) {
    try {
      const result = await providerGet(ep, { number });
      if (result.ok && result.data) {
        let messages: any[] = [];
        const d = result.data;
        if (Array.isArray(d)) messages = d;
        else if (d.data && Array.isArray(d.data)) messages = d.data;
        else if (d.messages && Array.isArray(d.messages)) messages = d.messages;
        else if (d.result && Array.isArray(d.result)) messages = d.result;

        for (const msg of messages) {
          const text = msg.message || msg.text || msg.body || msg.content || "";
          const codeMatch = String(text).match(/(\d{4,6})/);
          if (codeMatch) {
            await tg("sendMessage", {
              chat_id: chatId,
              text: `✅ *OTP Received!*

Number: \`${number}\`
OTP: \`${codeMatch[1]}\``,
              parse_mode: "Markdown",
            });
            await sendAdminAlert(number, codeMatch[1], countryName);
            return;
          }
        }
      }
    } catch {}
  }

  setTimeout(() => pollForOtp(number, chatId, countryName, retries + 1), 5000);
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    if (!update.message && !update.callback_query) {
      return NextResponse.json({ ok: true });
    }

    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = cq.message?.chat?.id || cq.from?.id;
      const data = cq.data;

      await tg("answerCallbackQuery", { callback_query_id: cq.id });

      if (data === "get_number") {
        const keyboard = [];
        for (let i = 0; i < COUNTRIES.length; i += 3) {
          const row = COUNTRIES.slice(i, i + 3).map((c) => ({
            text: `${c.flag} ${c.name}`,
            callback_data: `country_${c.code}`,
          }));
          keyboard.push(row);
        }

        await tg("sendMessage", {
          chat_id: chatId,
          text: "🌍 Select a country for your temporary number:",
          reply_markup: { inline_keyboard: keyboard },
        });

        userSessions[chatId] = { step: "waiting_country" };
        return NextResponse.json({ ok: true });
      }

      if (data.startsWith("country_")) {
        const countryCode = data.replace("country_", "");
        const country = COUNTRIES.find((c) => c.code === countryCode);
        if (!country) {
          await tg("sendMessage", { chat_id: chatId, text: "Invalid country." });
          return NextResponse.json({ ok: true });
        }

        await tg("sendMessage", {
          chat_id: chatId,
          text: `⏳ Fetching a ${country.flag} ${country.name} number...`,
        });

        const number = await fetchNumberFromProvider(countryCode);

        if (!number) {
          await tg("sendMessage", {
            chat_id: chatId,
            text: "❌ No numbers available right now. Please try another country or try again later.",
          });
          return NextResponse.json({ ok: true });
        }

        const cleanNumber = number.replace(/[^\d+]/g, "");

        try {
          await providerGet("liveaccess", { number: cleanNumber || number });
        } catch {}

        userSessions[chatId] = {
          step: "waiting_otp",
          country: country.name,
          countryCode: country.code,
          number: cleanNumber || number,
        };

        await tg("sendMessage", {
          chat_id: chatId,
          text: `📱 Your ${country.flag} temporary number:

\`${cleanNumber || number}\`

🕐 Waiting for OTP... You will receive it automatically.`,
          parse_mode: "Markdown",
        });

        pollForOtp(cleanNumber || number, chatId, country.name);
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();

    if (text === "/start") {
      await tg("sendMessage", {
        chat_id: chatId,
        text: `👋 *Welcome to Temp Number OTP Bot!*

I provide free temporary phone numbers for receiving OTP verification codes.

Click the button below to get started:`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "\u{1F522} Get a Number", callback_data: "get_number" }]],
        },
      });

      userSessions[chatId] = { step: "idle" };
      return NextResponse.json({ ok: true });
    }

    if (text === "/help") {
      await tg("sendMessage", {
        chat_id: chatId,
        text: `📖 *How to use:*

1. Send /start
2. Click "Get a Number"
3. Select a country
4. You will receive a temporary number
5. Use that number on any website
6. The OTP will be sent to you automatically

⏱ Numbers expire after 5 minutes.`,
        parse_mode: "Markdown",
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Telegram webhook error:", e);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Telegram webhook endpoint is active",
    bot: "TempNumberOTPBot",
  });
}
