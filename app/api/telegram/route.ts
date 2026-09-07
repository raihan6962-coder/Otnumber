import { NextRequest, NextResponse } from "next/server";

const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";
const ADMIN_CHAT_ID = "7259050773";
const API_BASE = "https://api.2oo9.cloud/MXS47FLFX0U/tnezs/@public/api";

const COUNTRIES = [
  { name: "United States", code: "US", dial: "+1", flag: "🇺🇸" },
  { name: "United Kingdom", code: "GB", dial: "+44", flag: "🇬🇧" },
  { name: "Canada", code: "CA", dial: "+1", flag: "🇨🇦" },
  { name: "Australia", code: "AU", dial: "+61", flag: "🇦🇺" },
  { name: "Germany", code: "DE", dial: "+49", flag: "🇩🇪" },
  { name: "France", code: "FR", dial: "+33", flag: "🇫🇷" },
  { name: "India", code: "IN", dial: "+91", flag: "🇮🇳" },
  { name: "Brazil", code: "BR", dial: "+55", flag: "🇧🇷" },
  { name: "Japan", code: "JP", dial: "+81", flag: "🇯🇵" },
  { name: "Nigeria", code: "NG", dial: "+234", flag: "🇳🇬" },
  { name: "Philippines", code: "PH", dial: "+63", flag: "🇵🇭" },
  { name: "Indonesia", code: "ID", dial: "+62", flag: "🇮🇩" },
  { name: "Pakistan", code: "PK", dial: "+92", flag: "🇵🇰" },
  { name: "Bangladesh", code: "BD", dial: "+880", flag: "🇧🇩" },
  { name: "Mexico", code: "MX", dial: "+52", flag: "🇲🇽" },
  { name: "Turkey", code: "TR", dial: "+90", flag: "🇹🇷" },
  { name: "Russia", code: "RU", dial: "+7", flag: "🇷🇺" },
  { name: "Egypt", code: "EG", dial: "+20", flag: "🇪🇬" },
  { name: "South Africa", code: "ZA", dial: "+27", flag: "🇿🇦" },
  { name: "Kenya", code: "KE", dial: "+254", flag: "🇰🇪" },
];

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

async function sendAdminAlert(number: string, otp: string, country: string) {
  const msg = `🔔 *OTP Received Alert*

📞 *Number:* \`${number}\`
🔑 *OTP:* \`${otp}\`
🌍 *Country:* ${country}
📡 *Source:* Bot
🕐 *Time:* ${new Date().toISOString()}`;
  await tg("sendMessage", { chat_id: ADMIN_CHAT_ID, text: msg, parse_mode: "Markdown" });
}

async function pollForOtp(tempId: string, number: string, chatId: number, countryCode: string, countryName: string, retries = 0) {
  if (retries > 60) {
    await tg("sendMessage", { chat_id: chatId, text: "⏰ OTP wait timed out. Please try again." });
    return;
  }

  try {
    const consoleRes = await fetch(`${API_BASE}/console`);
    const consoleData = await consoleRes.json();

    if (consoleData && Array.isArray(consoleData)) {
      for (const entry of consoleData) {
        const entryPhone = entry.phone || entry.number || "";
        const entryMessage = entry.message || entry.text || entry.body || "";

        if (entryPhone.includes(number)) {
          const otpMatch = entryMessage.match(/(\d{4,6})/);
          if (otpMatch) {
            const otpCode = otpMatch[1];
            await tg("sendMessage", {
              chat_id: chatId,
              text: `✅ *OTP Received!*

Number: \`${number}\`
OTP: \`${otpCode}\``,
              parse_mode: "Markdown",
            });
            await sendAdminAlert(number, otpCode, countryName);
            return;
          }
        }
      }
    }
  } catch {
    // silent
  }

  setTimeout(() => pollForOtp(tempId, number, chatId, countryCode, countryName, retries + 1), 5000);
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

        try {
          const getNumRes = await fetch(`${API_BASE}/getnum`);
          const numData = await getNumRes.json();
          const number = numData.number || numData.phone || (numData.data && (numData.data.number || numData.data.phone)) || "";
          const cleanNumber = number.replace(/[^\d+]/g, "");

          if (!number) {
            await tg("sendMessage", { chat_id: chatId, text: "❌ No numbers available right now. Please try another country." });
            return NextResponse.json({ ok: true });
          }

          const tempId = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);

          try {
            await fetch(`${API_BASE}/liveaccess?number=${encodeURIComponent(cleanNumber || number)}`);
          } catch {
            // best effort
          }

          userSessions[chatId] = {
            step: "waiting_otp",
            country: country.name,
            countryCode: country.code,
            tempId,
            number: cleanNumber || number,
          };

          await tg("sendMessage", {
            chat_id: chatId,
            text: `📱 Your ${country.flag} temporary number:

\`${cleanNumber || number}\`

🕐 Waiting for OTP... You will receive it automatically.`,
            parse_mode: "Markdown",
          });

          pollForOtp(tempId, cleanNumber || number, chatId, country.code, country.name);
        } catch {
          await tg("sendMessage", { chat_id: chatId, text: "❌ Failed to fetch number. Please try again." });
        }

        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    const msg = update.message;
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    const userId = msg.from?.id;

    if (text === "/start") {
      await tg("sendMessage", {
        chat_id: chatId,
        text: `👋 *Welcome to Temp Number OTP Bot!*

I provide free temporary phone numbers for receiving OTP verification codes.

Click the button below to get started:`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[{ text: "🔢 Get a Number", callback_data: "get_number" }]],
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

    const session = userSessions[chatId];
    if (session && session.step === "waiting_otp" && /^\d{4,6}$/.test(text)) {
      if (session.tempId && session.number) {
        await tg("sendMessage", {
          chat_id: chatId,
          text: `📝 OTP \`${text}\` noted. Checking verification for \`${session.number}\`...`,
          parse_mode: "Markdown",
        });
      }
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
