"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

interface TempData {
  id: string;
  number: string;
  country: string;
  countryCode: string;
  status: string;
  otp?: string;
  otpReceivedAt?: number;
  createdAt: number;
}

interface OtpMessage {
  code: string;
  time: string;
}

export default function HomePage() {
  const [view, setView] = useState<"select" | "number">("select");
  const [selectedCountry, setSelectedCountry] = useState<typeof COUNTRIES[0] | null>(null);
  const [tempData, setTempData] = useState<TempData | null>(null);
  const [otpMessages, setOtpMessages] = useState<OtpMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [toast, setToast] = useState("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const fetchNumber = async (countryCode: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getNumber", country: countryCode, source: "web" }),
      });
      const data = await res.json();
      if (data.success) {
        setTempData(data.data);
        setView("number");
        startPolling(data.data.id);
      } else {
        showToast(data.error || "Failed to get number");
      }
    } catch {
      showToast("Network error. Please try again.");
    }
    setLoading(false);
  };

  const startPolling = useCallback((tempId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPolling(true);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/numbers?action=checkOtp&id=${tempId}`);
        const data = await res.json();
        if (data.success && data.data) {
          if (data.data.otp && data.data.otp !== tempData?.otp) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString();
            setOtpMessages((prev) => {
              const exists = prev.some((m) => m.code === data.data.otp);
              if (exists) return prev;
              return [{ code: data.data.otp, time: timeStr }, ...prev];
            });
            setTempData((prev) => (prev ? { ...prev, otp: data.data.otp, status: "otp_received" } : prev));
            showToast("OTP received!");
          }
          if (data.data.status === "expired") {
            setTempData((prev) => (prev ? { ...prev, status: "expired" } : prev));
            stopPolling();
          }
        }
      } catch {
        // silent fail on poll
      }
    }, 3000);
  }, [tempData?.otp]);

  const stopPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setPolling(false);
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleCountrySelect = (country: typeof COUNTRIES[0]) => {
    setSelectedCountry(country);
    fetchNumber(country.code);
  };

  const copyOtp = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast("OTP copied!");
  };

  const goBack = () => {
    stopPolling();
    setView("select");
    setSelectedCountry(null);
    setTempData(null);
    setOtpMessages([]);
  };

  return (
    <div className="container">
      {view === "select" && (
        <>
          <div className="hero">
            <h1>Temp Number</h1>
            <p>Get a free temporary phone number to receive OTP verification codes instantly.</p>
          </div>

          <h2 style={{ marginBottom: "16px", fontSize: "1.1rem" }}>Select a Country</h2>
          <div className="country-grid">
            {COUNTRIES.map((c) => (
              <div
                key={c.code}
                className={`country-card ${selectedCountry?.code === c.code ? "selected" : ""}`}
                onClick={() => handleCountrySelect(c)}
              >
                <span className="country-flag">{c.flag}</span>
                <div className="country-info">
                  <h3>{c.name}</h3>
                  <span>{c.dial}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: "40px", padding: "20px", color: "var(--text-dim)", fontSize: "0.85rem" }}>
            <p>Or use our Telegram Bot: <strong>@TempNumberOTP_bot</strong></p>
          </div>
        </>
      )}

      {view === "number" && tempData && (
        <>
          <button className="back-btn" onClick={goBack}>
            &larr; Choose Another Country
          </button>

          <div className="number-display">
            <div className="label">Your Temporary Number</div>
            <div className="number">{tempData.number}</div>
            <div className="country-badge">
              {selectedCountry?.flag} {selectedCountry?.name} ({selectedCountry?.dial})
            </div>
          </div>

          <div className="status-bar">
            <div className="status-dot" style={{ background: polling ? "var(--success)" : "var(--danger)" }}></div>
            {tempData.status === "expired" ? (
              <span>This number has expired.</span>
            ) : polling ? (
              <span>Waiting for OTP messages...</span>
            ) : (
              <span>Reconnecting...</span>
            )}
          </div>

          <div className="otp-section">
            <h2>
              <span>&#128231;</span> Inbox / OTP
            </h2>
            {otpMessages.length === 0 ? (
              <div className="empty-state">
                <div className="icon">&#128233;</div>
                <p>No OTP messages yet. Waiting for incoming codes...</p>
                <div className="spinner" style={{ margin: "16px auto 0" }}></div>
              </div>
            ) : (
              otpMessages.map((msg, i) => (
                <div key={i} className="otp-item">
                  <div className="otp-code">{msg.code}</div>
                  <div className="otp-time">Received at {msg.time}</div>
                  <div className="otp-actions">
                    <button className="btn btn-primary btn-small" onClick={() => copyOtp(msg.code)}>
                      Copy OTP
                    </button>
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => {
                        navigator.clipboard.writeText(tempData.number);
                        showToast("Number copied!");
                      }}
                    >
                      Copy Number
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
