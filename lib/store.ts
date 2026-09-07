export interface TempData {
  id: string;
  number: string;
  country: string;
  countryCode: string;
  source: "web" | "bot";
  telegramUserId?: number;
  chatId?: number;
  createdAt: number;
  status: "active" | "otp_received" | "expired";
  otp?: string;
  otpReceivedAt?: number;
}

export interface AdminSession {
  authenticated: boolean;
  createdAt: number;
}

export const COUNTRIES = [
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

export const API_BASE = "https://api.2oo9.cloud/MXS47FLFX0U/tnezs/@public/api";
export const BOT_TOKEN = "8645181362:AAG1v_kyYMs9yCdsJ88otpq4T07H3q5IsXY";
export const ADMIN_CHAT_ID = "7259050773";
export const ADMIN_PASSWORD = "2808";
