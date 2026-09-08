import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";
const ADMIN_CHAT_ID = "7259050773";
const API_BASE = "https://api.2oo9.cloud/MXS47FLFX0U/tnezs/@public/api";
const API_KEY = process.env.API_2OO9_KEY || "";

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

interface UserSession {
  step: "idle" | "waiting_country" | "waiting_otp";
  country?: string;
  countryCode?: string;
  number?: string;
  fullNumber?: string;
  rid?: string;
}

const userSessions: Record<number, UserSession> = {};

function getHeaders() {
  const h: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  if (API_KEY) h["mauthapi"] = API_KEY;
  return h;
}

async function tg(method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(endpoint: string) {
  const res = await fetch(`${API_BASE}/${endpoint}`, { method: "GET", headers: getHeaders() });
  return res.json().catch(() => null);
}

async function apiPost(endpoint: string, body: any) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
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

async function pollForOtp(number: string, cleanNum: string, chatId: number, countryName: string, retries = 0) {
  if (retries > 60) {
    await tg("sendMessage", { chat_id: chatId, text: "⏰ OTP wait timed out (5 min). Try again with /start" });
    return;
  }

  try {
    const consoleData = await apiGet("console");
    if (consoleData?.meta?.code === 200 && consoleData?.data?.hits) {
      for (const hit of consoleData.data.hits) {
        const hitRange = hit.range || "";
        const hitNum = hitRange.replace(/XXX$/, "");
        if (cleanNum.includes(hitNum) || hitNum.includes(cleanNum) || number.includes(hitNum)) {
          const otpMatch = (hit.message || "").match(/(\d{4,6})/);
          if (otpMatch) {
            await tg("sendMessage", {
              chat_id: chatId,
              text: `✅ *OTP Received!*

Number: \`${number}\`
OTP: \`${otpMatch[1]}\``,
              parse_mode: "Markdown",
            });
            await sendAdminAlert(number, otpMatch[1], countryName);
            return;
          }
        }
      }
    }
  } catch {}

  setTimeout(() => pollForOtp(number, cleanNum, chatId, countryName, retries + 1), 5000);
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
        if (!API_KEY) {
          await tg("sendMessage", { chat_id: chatId, text: "❌ API key not configured. Contact admin." });
          return NextResponse.json({ ok: true });
        }

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

        const result = await apiPost("getnum", { rid: "26134" });

        if (result?.meta?.code === 200 && result?.data) {
          const d = result.data;
          const number = d.no_plus_number || d.national_number || "";
          const fullNumber = d.full_number || `+${number}`;

          userSessions[chatId] = {
            step: "waiting_otp",
            country: country.name,
            countryCode: country.code,
            number: fullNumber,
            cleanNumber: number,
            rid: "26134",
          };

          await tg("sendMessage", {
            chat_id: chatId,
            text: `📱 Your ${country.flag} temporary number:

\`${fullNumber}\`

Operator: ${d.operator || "N/A"}
🕐 Waiting for OTP... You will receive it automatically.`,
            parse_mode: "Markdown",
          });

          pollForOtp(fullNumber, number, chatId, country.name);
        } else {
          const errMsg = result?.message || "Failed to get number";
          await tg("sendMessage", {
            chat_id: chatId,
            text: `❌ ${errMsg}\n\nTry another country or try again later.`,
          });
        }

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
    apiKeyConfigured: !!API_KEY,
  });
}
