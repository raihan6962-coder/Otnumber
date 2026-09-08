import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.2oo9.cloud/MXS47FLFX0U/tnezs/@public/api";
const API_KEY = "MZP5U87OSW1";
const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";
const ADMIN_CHAT_ID = "7259050773";

const tempStore: Record<string, any> = {};
const historyStore: any[] = [];

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

const apiHeaders = {
  "Accept": "application/json",
  "Content-Type": "application/json",
  "mauthapi": API_KEY,
};

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

async function notifyAdmin(number: string, otp: string, source: string, country: string, sid?: string, operator?: string) {
  const msg = `🔔 *OTP Received Alert*

📞 *Number:* \`${number}\`
🔑 *OTP:* \`${otp}\`
🌍 *Country:* ${country}
📡 *Source:* ${source}
🏷️ *Service:* ${sid || "N/A"}
📶 *Operator:* ${operator || "N/A"}
🕐 *Time:* ${new Date().toISOString()}`;
  await sendTelegramMessage(ADMIN_CHAT_ID, msg);
}

function extractOtpFromMessage(text: string): string | null {
  if (!text) return null;
  const match = text.match(/(\d{4,6})/);
  return match ? match[1] : null;
}

// Fetch available ranges from liveaccess
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

// Shuffle array randomly
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Try to get a number for a specific country by trying multiple ranges
async function getNumberForCountry(countryCode: string, requestedCountry: string): Promise<any> {
  // First try liveaccess ranges (shuffled for random operator)
  const liveRanges = await getAvailableRanges();
  const allRids = shuffle(liveRanges);

  // If no live ranges, use fallback defaults
  if (allRids.length === 0) {
    allRids.push("26134", "22501", "8801", "12345", "67890");
  }

  // Try up to 5 random ranges to find matching country
  const maxAttempts = Math.min(5, allRids.length);
  for (let i = 0; i < maxAttempts; i++) {
    const rid = allRids[i];
    const result = await apiPost("getnum", { rid });

    if (result?.meta?.code === 200 && result?.data) {
      const d = result.data;
      const numCountry = (d.country || "").toLowerCase();
      const reqCountry = requestedCountry.toLowerCase();

      // If country matches or is close enough, return it
      if (numCountry.includes(reqCountry) || reqCountry.includes(numCountry)) {
        return { ...result, usedRid: rid };
      }

      // If it's a US/CA number and user wants US/CA, accept it
      if ((countryCode === "US" || countryCode === "CA") &&
          (numCountry.includes("united states") || numCountry.includes("canada"))) {
        return { ...result, usedRid: rid };
      }
    }

    // If out of stock, try next
    if (result?.meta?.code === 2946) continue;
  }

  // Final attempt - just get any number
  const lastRid = allRids[0] || "26134";
  const result = await apiPost("getnum", { rid: lastRid });
  if (result?.meta?.code === 200 && result?.data) {
    return { ...result, usedRid: lastRid };
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
      // Check console (global feed)
      const consoleRes = await apiGet("console");
      if (consoleRes?.meta?.code === 200 && consoleRes?.data?.hits) {
        for (const hit of consoleRes.data.hits) {
          const hitRange = (hit.range || "").replace(/XXX$/, "");
          const cleanNum = temp.cleanNumber || temp.number;
          if (cleanNum.includes(hitRange) || hitRange.includes(cleanNum)) {
            const otp = extractOtpFromMessage(hit.message);
            if (otp && !temp.otp) {
              temp.otp = otp;
              temp.status = "otp_received";
              temp.otpReceivedAt = Date.now();
              temp.otpSid = hit.sid || "";

              historyStore.push({
                id: temp.id, number: temp.number, country: temp.country,
                countryCode: temp.countryCode, otp, sid: hit.sid || "",
                operator: temp.operator || "",
                source: temp.source, createdAt: temp.createdAt, receivedAt: Date.now(),
              });

              notifyAdmin(temp.number, otp, temp.source, temp.country, hit.sid, temp.operator);
              if (temp.chatId) {
                sendTelegramMessage(temp.chatId.toString(), `🔑 OTP for \`${temp.number}\`:\n\n\`${otp}\``, "Markdown");
              }
            }
          }
        }
      }

      // Check success-otp (your own OTPs)
      const successRes = await apiGet("success-otp");
      if (successRes?.meta?.code === 200 && successRes?.data?.otps) {
        for (const entry of successRes.data.otps) {
          if (entry.number === temp.number || temp.number.includes(entry.number)) {
            const otp = extractOtpFromMessage(entry.message);
            if (otp && !temp.otp) {
              temp.otp = otp;
              temp.status = "otp_received";
              temp.otpReceivedAt = Date.now();

              historyStore.push({
                id: temp.id, number: temp.number, country: temp.country,
                countryCode: temp.countryCode, otp, operator: temp.operator || "",
                source: temp.source, createdAt: temp.createdAt, receivedAt: Date.now(),
              });

              notifyAdmin(temp.number, otp, temp.source, temp.country, "", temp.operator);
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
        id: temp.id, number: temp.number, fullNumber: temp.fullNumber,
        status: temp.status, otp: temp.otp || null,
        otpReceivedAt: temp.otpReceivedAt || null,
      },
    });
  }

  if (action === "liveaccess") {
    const result = await apiGet("liveaccess");
    return NextResponse.json({ success: true, data: result });
  }

  if (action === "adminData") {
    const password = searchParams.get("password");
    if (password !== "2808") {
      return NextResponse.json({ success: false, error: "Unauthorized" });
    }

    const allTemps = Object.values(tempStore);
    const active = allTemps.filter((t: any) => t.status === "active" || t.status === "otp_received");
    const expired = allTemps.filter((t: any) => t.status === "expired");

    return NextResponse.json({
      success: true,
      data: {
        totalGenerated: allTemps.length,
        activeCount: active.length,
        otpReceivedCount: historyStore.length,
        activeNumbers: active.map((t: any) => ({
          id: t.id, number: t.number, fullNumber: t.fullNumber,
          country: t.country, rid: t.rid, operator: t.operator,
          source: t.source, status: t.status, createdAt: t.createdAt,
          otp: t.otp || null, otpReceivedAt: t.otpReceivedAt || null,
        })),
        history: historyStore.map((h: any) => ({
          id: h.id, number: h.number, country: h.country, otp: h.otp,
          sid: h.sid || "", operator: h.operator || "",
          source: h.source, createdAt: h.createdAt, receivedAt: h.receivedAt,
        })),
        expiredNumbers: expired.map((t: any) => ({
          id: t.id, number: t.number, country: t.country,
          createdAt: t.createdAt,
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
    const countryName = country || "Unknown";

    // Try to get a number for the requested country with random operator
    const result = await getNumberForCountry(country, countryName);

    if (result?.meta?.code === 200 && result?.data) {
      const d = result.data;
      const number = d.no_plus_number || d.national_number || "";
      const fullNumber = d.full_number || `+${number}`;
      const detectedCountry = d.country || countryName;
      const operator = d.operator || "";
      const rid = result.usedRid || "26134";

      const id = generateId();
      const tempEntry = {
        id, number, fullNumber, country: detectedCountry,
        countryCode: countryName, rid, operator,
        source: source || "web", telegramUserId: telegramUserId || null,
        chatId: chatId || null, createdAt: Date.now(),
        status: "active", otp: null, otpReceivedAt: null, cleanNumber: number,
      };

      tempStore[id] = tempEntry;

      return NextResponse.json({
        success: true,
        data: {
          id: tempEntry.id, number: tempEntry.number, fullNumber: tempEntry.fullNumber,
          country: tempEntry.country, countryCode: tempEntry.countryCode,
          operator: tempEntry.operator, rid: tempEntry.rid,
          status: tempEntry.status, createdAt: tempEntry.createdAt,
        },
      });
    }

    const errMsg = result?.message || "Failed to get number from provider";
    const errCode = result?.meta?.code || "unknown";
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
        id: temp.id, number: temp.number, country: temp.country,
        otp: temp.otp, operator: temp.operator || "",
        source: temp.source, createdAt: temp.createdAt, receivedAt: Date.now(),
      });

      notifyAdmin(temp.number, otp, temp.source, temp.country, "", temp.operator);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, error: "Invalid" });
  }

  return NextResponse.json({ success: false, error: "Unknown action" });
}
