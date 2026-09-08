"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

interface TempData {
  id: string;
  number: string;
  fullNumber?: string;
  country: string;
  countryCode: string;
  operator?: string;
  rid?: string;
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
  const [apiError, setApiError] = useState("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const fetchNumber = async (countryCode: string) => {
    setLoading(true);
    setApiError("");
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
        const errMsg = data.error || "Failed to get number";
        setApiError(errMsg);
        showToast(errMsg);
      }
    } catch {
      setApiError("Network error. Please try again.");
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
      } catch {}
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

  const copyNumber = () => {
    if (tempData) {
      navigator.clipboard.writeText(tempData.fullNumber || tempData.number);
      showToast("Number copied!");
    }
  };

  const goBack = () => {
    stopPolling();
    setView("select");
    setSelectedCountry(null);
    setTempData(null);
    setOtpMessages([]);
    setApiError("");
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
                className={`country-card ${selectedCountry?.code === c.code && loading ? "selected" : ""}`}
                onClick={() => !loading && handleCountrySelect(c)}
              >
                <span className="country-flag">{c.flag}</span>
                <div className="country-info">
                  <h3>{c.name}</h3>
                  <span>{c.dial}</span>
                </div>
              </div>
            ))}
          </div>

          {loading && (
            <div style={{ textAlign: "center", marginTop: "20px" }}>
              <div className="spinner" style={{ margin: "0 auto" }}></div>
              <p style={{ color: "var(--text-dim)", marginTop: "10px", fontSize: "0.9rem" }}>Fetching number...</p>
            </div>
          )}

          {apiError && (
            <div style={{
              marginTop: "20px",
              padding: "16px 20px",
              background: "rgba(255, 107, 107, 0.1)",
              border: "1px solid rgba(255, 107, 107, 0.3)",
              borderRadius: "12px",
              color: "var(--danger)",
              fontSize: "0.9rem",
              textAlign: "center",
            }}>
              {apiError}
            </div>
          )}

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
            <div className="number">{tempData.fullNumber || tempData.number}</div>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
              <div className="country-badge">
                {selectedCountry?.flag} {tempData.country || selectedCountry?.name}
              </div>
              {tempData.operator && (
                <div className="country-badge">
                  📡 {tempData.operator}
                </div>
              )}
            </div>
            <button className="btn btn-secondary btn-small" style={{ marginTop: "16px" }} onClick={copyNumber}>
              Copy Number
            </button>
          </div>

          <div className="status-bar">
            <div className="status-dot" style={{ background: polling ? "var(--success)" : "var(--danger)" }}></div>
            {tempData.status === "expired" ? (
              <span>This number has expired. <button className="back-btn" onClick={goBack} style={{ display: "inline", margin: 0, padding: 0 }}>Get new number</button></span>
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
                    <button className="btn btn-secondary btn-small" onClick={copyNumber}>
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
