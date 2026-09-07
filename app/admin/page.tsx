"use client";

import { useState, useEffect } from "react";

interface ActiveNumber {
  id: string;
  number: string;
  country: string;
  source: string;
  status: string;
  createdAt: number;
  otp: string | null;
}

interface HistoryEntry {
  id: string;
  number: string;
  country: string;
  otp: string;
  source: string;
  createdAt: number;
  receivedAt: number;
}

interface AdminData {
  totalGenerated: number;
  activeNumbers: ActiveNumber[];
  history: HistoryEntry[];
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");

  const login = async () => {
    if (password !== "2808") {
      setError("Invalid password");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/numbers?action=adminData&password=${password}`);
      const result = await res.json();
      if (result.success) {
        setAuthenticated(true);
        setData(result.data);
      } else {
        setError("Authentication failed");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const refreshData = async () => {
    try {
      const res = await fetch(`/api/numbers?action=adminData&password=${password}`);
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch {}
  };

  useEffect(() => {
    if (authenticated) {
      const interval = setInterval(refreshData, 5000);
      return () => clearInterval(interval);
    }
  }, [authenticated, password]);

  const formatTime = (ts: number) => new Date(ts).toLocaleString();

  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "16px", padding: "40px", width: "100%", maxWidth: "400px" }}>
          <h1 style={{ textAlign: "center", marginBottom: "8px", fontSize: "1.5rem", background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Admin Panel
          </h1>
          <p style={{ textAlign: "center", color: "var(--text-dim)", marginBottom: "24px", fontSize: "0.9rem" }}>
            Enter password to access dashboard
          </p>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && login()}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--surface2)",
              border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
              borderRadius: "10px",
              color: "var(--text)",
              fontSize: "1rem",
              outline: "none",
              marginBottom: "16px",
            }}
          />
          {error && <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "12px" }}>{error}</p>}
          <button
            onClick={login}
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? <div className="spinner" /> : "Login"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: "30px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", background: "var(--gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Admin Dashboard
          </h1>
          <p style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>Temp Number & OTP Service</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-secondary btn-small" onClick={refreshData}>
            Refresh
          </button>
          <a href="/" className="btn btn-secondary btn-small" style={{ textDecoration: "none" }}>
            Main Site
          </a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "30px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
          <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Total Generated</div>
          <div style={{ fontSize: "2rem", fontWeight: "700", marginTop: "4px" }}>{data?.totalGenerated || 0}</div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
          <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>Active Numbers</div>
          <div style={{ fontSize: "2rem", fontWeight: "700", marginTop: "4px", color: "var(--success)" }}>
            {data?.activeNumbers?.length || 0}
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "20px" }}>
          <div style={{ color: "var(--text-dim)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "1px" }}>OTP Success</div>
          <div style={{ fontSize: "2rem", fontWeight: "700", marginTop: "4px", color: "var(--accent)" }}>
            {data?.history?.length || 0}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0", marginBottom: "20px" }}>
        <button
          onClick={() => setActiveTab("active")}
          className="btn btn-small"
          style={{
            background: activeTab === "active" ? "var(--primary)" : "var(--surface2)",
            color: "white",
            borderRadius: "10px 0 0 10px",
            border: "1px solid var(--border)",
          }}
        >
          Active Numbers ({data?.activeNumbers?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className="btn btn-small"
          style={{
            background: activeTab === "history" ? "var(--primary)" : "var(--surface2)",
            color: "white",
            borderRadius: "0 10px 10px 0",
            border: "1px solid var(--border)",
            borderLeft: "none",
          }}
        >
          OTP History ({data?.history?.length || 0})
        </button>
      </div>

      {activeTab === "active" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          {(!data?.activeNumbers || data.activeNumbers.length === 0) ? (
            <div className="empty-state" style={{ padding: "40px" }}>
              <div className="icon">&#128204;</div>
              <p>No active numbers right now</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ background: "var(--surface2)", textAlign: "left" }}>
                    <th style={{ padding: "12px 16px" }}>Number</th>
                    <th style={{ padding: "12px 16px" }}>Country</th>
                    <th style={{ padding: "12px 16px" }}>Source</th>
                    <th style={{ padding: "12px 16px" }}>Status</th>
                    <th style={{ padding: "12px 16px" }}>OTP</th>
                    <th style={{ padding: "12px 16px" }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.activeNumbers?.map((n) => (
                    <tr key={n.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: "600" }}>{n.number}</td>
                      <td style={{ padding: "12px 16px" }}>{n.country}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          background: n.source === "bot" ? "rgba(0, 206, 201, 0.15)" : "rgba(108, 92, 231, 0.15)",
                          color: n.source === "bot" ? "var(--accent)" : "var(--primary)",
                        }}>
                          {n.source === "bot" ? "🤖 Bot" : "🌐 Web"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          background: n.status === "otp_received" ? "rgba(0, 184, 148, 0.15)" : "rgba(255, 107, 107, 0.15)",
                          color: n.status === "otp_received" ? "var(--success)" : "var(--danger)",
                        }}>
                          {n.status === "otp_received" ? "OTP Received" : "Active"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--accent)", fontWeight: "600" }}>
                        {n.otp || "-"}
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: "0.8rem" }}>{formatTime(n.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          {(!data?.history || data.history.length === 0) ? (
            <div className="empty-state" style={{ padding: "40px" }}>
              <div className="icon">&#128214;</div>
              <p>No OTP history yet</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ background: "var(--surface2)", textAlign: "left" }}>
                    <th style={{ padding: "12px 16px" }}>Number</th>
                    <th style={{ padding: "12px 16px" }}>Country</th>
                    <th style={{ padding: "12px 16px" }}>OTP</th>
                    <th style={{ padding: "12px 16px" }}>Source</th>
                    <th style={{ padding: "12px 16px" }}>Generated</th>
                    <th style={{ padding: "12px 16px" }}>OTP Received</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.history?.map((h, i) => (
                    <tr key={`${h.id}-${i}`} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", fontWeight: "600" }}>{h.number}</td>
                      <td style={{ padding: "12px 16px" }}>{h.country}</td>
                      <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--accent)", fontWeight: "700", fontSize: "1rem" }}>{h.otp}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          background: h.source === "bot" ? "rgba(0, 206, 201, 0.15)" : "rgba(108, 92, 231, 0.15)",
                          color: h.source === "bot" ? "var(--accent)" : "var(--primary)",
                        }}>
                          {h.source === "bot" ? "🤖 Bot" : "🌐 Web"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px", color: "var(--text-dim)", fontSize: "0.8rem" }}>{formatTime(h.createdAt)}</td>
                      <td style={{ padding: "12px 16px", color: "var(--success)", fontSize: "0.8rem" }}>{formatTime(h.receivedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
