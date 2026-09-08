import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";
const ADMIN_CHAT_ID = "7259050773";
const API_BASE = "https://api.2oo9.cloud/MXS47FLFX0U/tnezs/@public/api";
const API_KEY = "MZP5U87OSW1";

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
  cleanNumber?: string;
  operator?: string;
}

const userSessions: Record<number, UserSession> = {};

const apiHeaders = {
  "Accept": "application/json",
  "Content-Type": "application/json",
  "mauthapi": API_KEY,
};

async function tg(method: string, body: any) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(endpoint: string) {
  const res = await fetch(`${API_BASE}/${endpoint}`, { method: "GET", headers: apiHeaders });
  return res.json().catch(() => null);
}

async function apiPost(endpoint: string, body: any) {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST", headers: apiHeaders, body: JSON.stringify(body),
  });
  return res.json().catch(() => null);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function getAvailableRanges(): Promise<string[]> {
  const res = await apiGet("liveaccess");
  if (res?.meta?.code === 200 && res?.data?.services) {
    const ranges: string[] = [];
    for (const svc of res.data.services) {
      if (svc.ranges) {
        for (const r of svc.ranges) {
          const rid = r.replace(/XXX$/, "");
          if (rid && !ranges.includes(rid)) ranges.push(rid);
        }
      }
    }
    return ranges;
  }
  return [];
}

async function getNumberForCountry(countryCode: string, requestedCountry: string): Promise<any> {
  const liveRanges = await getAvailableRanges();
  const allRids = shuffle(liveRanges);

  if (allRids.length === 0) {
    allRids.push("26134", "22501", "8801");
  }

  const maxAttempts = Math.min(5, allRids.length);
  for (let i = 0; i < maxAttempts; i++) {
    const rid = allRids[i];
    const result = await apiPost("getnum", { rid });

    if (result?.meta?.code === 200 && result?.data) {
      const d = result.data;
      const numCountry = (d.country || "").toLowerCase();
      const reqCountry = requestedCountry.toLowerCase();

      if (numCountry.includes(reqCountry) || reqCountry.includes(numCountry)) {
        return { ...result, usedRid: rid };
      }

      if ((countryCode === "US" || countryCode === "CA") &&
          (numCountry.includes("united states") || numCountry.includes("canada"))) {
        return { ...result, usedRid: rid };
      }
    }

    if (result?.meta?.code === 2946) continue;
  }

  const lastRid = allRids[0] || "26134";
  const result = await apiPost("getnum", { rid: lastRid });
  if (result?.meta?.code === 200 && result?.data) {
    return { ...result, usedRid: lastRid };
  }

  return null;
}

async function sendAdminAlert(number: string, otp: string, country: string, sid?: string, operator?: string) {
  const msg = `🔔 *OTP Received Alert*

📞 *Number:* \`${number}\`
🔑 *OTP:* \`${otp}\`
🌍 *Country:* ${country}
📡 *Source:* Bot
📶 *Operator:* ${operator || "N/A"}
🕐 *Time:* ${new Date().toISOString()}`;
  await tg("sendMessage", { chat_id: ADMIN_CHAT_ID, text: msg, parse_mode: "Markdown" });
}

async function pollForOtp(number: string, cleanNum: string, chatId: number, countryName: string, retries = 0) {
  if (retries > 60) {
    await tg("sendMessage", { chat_id: chatId, text: "⏰ OTP wait timed out (5 min). Try again with /start" });
    return;
  }

  try {
    const consoleRes = await apiGet("console");
    if (consoleRes?.meta?.code === 200 && consoleRes?.data?.hits) {
      for (const hit of consoleRes.data.hits) {
        const hitRange = (hit.range || "").replace(/XXX$/, "");
        if (cleanNum.includes(hitRange) || hitRange.includes(cleanNum) || number.includes(hitRange)) {
          const otpMatch = (hit.message || "").match(/(\d{4,6})/);
          if (otpMatch) {
            await tg("sendMessage", {
              chat_id: chatId,
              text: `✅ *OTP Received!*

Number: \`${number}\`
OTP: \`${otpMatch[1]}\``,
              parse_mode: "Markdown",
            });
            await sendAdminAlert(number, otpMatch[1], countryName, hit.sid);
            return;
          }
        }
      }
    }

    const successRes = await apiGet("success-otp");
    if (successRes?.meta?.code === 200 && successRes?.data?.otps) {
      for (const entry of successRes.data.otps) {
        if (entry.number === cleanNum || cleanNum.includes(entry.number)) {
          const otpMatch = (entry.message || "").match(/(\d{4,6})/);
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

        const result = await getNumberForCountry(countryCode, country.name);

        if (result?.meta?.code === 200 && result?.data) {
          const d = result.data;
          const cleanNum = d.no_plus_number || d.national_number || "";
          const fullNumber = d.full_number || `+${cleanNum}`;

          userSessions[chatId] = {
            step: "waiting_otp",
            country: country.name,
            countryCode: country.code,
            number: fullNumber,
            cleanNumber: cleanNum,
            operator: d.operator || "",
          };

          await tg("sendMessage", {
            chat_id: chatId,
            text: `📱 Your ${country.flag} temporary number:

\`${fullNumber}\`

📶 Operator: ${d.operator || "N/A"}
🕐 Waiting for OTP... You will receive it automatically.`,
            parse_mode: "Markdown",
          });

          pollForOtp(fullNumber, cleanNum, chatId, country.name);
        } else {
          const errMsg = result?.message || "Failed to get number";
          const errCode = result?.meta?.code || "";
          await tg("sendMessage", {
            chat_id: chatId,
            text: `❌ ${errMsg} (code: ${errCode})\n\nTry another country or try again later.`,
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
  return NextResponse.json({ status: "ok", message: "Telegram webhook active" });
}
