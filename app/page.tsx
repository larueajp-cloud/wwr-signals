// @ts-nocheck
"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════════════════════════════════════════════════════════
// WWR SIGNAL DASHBOARD — Wickless Wave Rider
// Mobile-first PWA for live MNQ trading signals
// Polls /api/webhook for live signals from TradingView
// ═══════════════════════════════════════════════════════════════

const POLL_INTERVAL = 2000; // check for new signals every 2 seconds

// Sound generation using Web Audio API
const playSound = (type) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === "long") {
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.2);
    } else if (type === "short") {
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(440, ctx.currentTime + 0.2);
    } else if (type === "exit") {
      osc.frequency.setValueAtTime(550, ctx.currentTime);
      osc.frequency.setValueAtTime(550, ctx.currentTime + 0.15);
    } else {
      osc.frequency.setValueAtTime(770, ctx.currentTime);
    }

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    console.log("Audio not available");
  }
};

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
};

export default function WWRDashboard() {
  const [signals, setSignals] = useState([]);
  const [bias, setBias] = useState("neutral");
  const [position, setPosition] = useState("flat");
  const [entryPrice, setEntryPrice] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [pulseAction, setPulseAction] = useState(null);
  const lastSignalId = useRef(0);
  const prevSignalCount = useRef(0);

  // Poll the API for new signals
  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const since = lastSignalId.current > 0 ? `?since=${lastSignalId.current}` : "";
        const res = await fetch(`/api/webhook${since}`);
        if (!res.ok) throw new Error("API error");
        const data = await res.json();

        if (!active) return;
        setConnected(true);

        // Update state from server
        setBias(data.bias || "neutral");
        setPosition(data.position || "flat");
        setEntryPrice(data.entryPrice || null);

        // Process new signals
        if (data.signals && data.signals.length > 0) {
          const latestId = data.signals[0]?.id || 0;

          if (latestId > lastSignalId.current && lastSignalId.current > 0) {
            // New signal arrived — play sound
            const newSig = data.signals[0];
            if (soundEnabled) {
              if (newSig.action === "buy") playSound("long");
              else if (newSig.action === "sell") playSound("short");
              else playSound("exit");
            }
            setPulseAction(newSig.action === "buy" ? "long" : newSig.action === "sell" ? "short" : "exit");
            setTimeout(() => setPulseAction(null), 2000);
          }

          lastSignalId.current = latestId;
          setLastUpdate(Date.now());

          // Merge new signals with existing (on first load, replace entirely)
          if (prevSignalCount.current === 0) {
            setSignals(data.signals);
          } else {
            setSignals((prev) => {
              const existingIds = new Set(prev.map((s) => s.id));
              const newOnes = data.signals.filter((s) => !existingIds.has(s.id));
              return [...newOnes, ...prev].slice(0, 200);
            });
          }
          prevSignalCount.current = data.totalSignals;
        }
      } catch (e) {
        if (active) setConnected(false);
      }
    };

    poll(); // initial fetch
    const interval = setInterval(poll, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [soundEnabled]);

  const stats = {
    total: signals.length,
    buys: signals.filter((s) => s.action === "buy").length,
    sells: signals.filter((s) => s.action === "sell").length,
  };

  const biasColor = bias === "bullish" ? "#26a69a" : bias === "bearish" ? "#ef5350" : "#555e7e";
  const biasGlow = bias === "bullish" ? "#26a69a30" : bias === "bearish" ? "#ef535030" : "transparent";
  const posColor = position === "long" ? "#26a69a" : position === "short" ? "#ef5350" : "#555e7e";

  return (
    <div style={{
      minHeight: "100vh",
      background: "#06080e",
      color: "#c8ccd8",
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      maxWidth: 480,
      margin: "0 auto",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Ambient glow */}
      <div style={{
        position: "fixed", top: "-30%", left: "-20%", width: "80%", height: "80%",
        background: `radial-gradient(ellipse, ${biasGlow}, transparent 65%)`,
        pointerEvents: "none", zIndex: 0, transition: "background 1.5s ease",
      }} />

      <div style={{ position: "relative", zIndex: 1, padding: "0 16px 100px" }}>

        {/* Header */}
        <div style={{
          padding: "20px 0 16px",
          borderBottom: "1px solid #151a28",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "0.12em", color: "#555e7e", marginBottom: 4,
            }}>
              Wickless Wave Rider
            </div>
            <div style={{
              fontSize: 26, fontWeight: 300, color: "#e8ebf4",
              letterSpacing: "-0.02em", lineHeight: 1,
            }}>
              MNQ <span style={{ color: biasColor, fontWeight: 600 }}>Signals</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: soundEnabled ? "#151a28" : "#0e1018",
                border: `1px solid ${soundEnabled ? "#252a3a" : "#151a28"}`,
                color: soundEnabled ? "#e8ebf4" : "#555e7e",
                fontSize: 16, cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {soundEnabled ? "\uD83D\uDD0A" : "\uD83D\uDD07"}
            </button>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: connected ? "#26a69a" : "#ef5350",
              boxShadow: connected ? "0 0 8px #26a69a80" : "0 0 8px #ef535080",
            }} />
          </div>
        </div>

        {/* Bias Card */}
        <div style={{
          margin: "20px 0",
          padding: "20px",
          background: "#0b0d16",
          border: `1px solid ${bias !== "neutral" ? biasColor + "30" : "#151a28"}`,
          borderRadius: 16,
          transition: "all 0.5s ease",
          boxShadow: pulseAction ? `0 0 30px ${pulseAction === "long" ? "#26a69a20" : pulseAction === "short" ? "#ef535020" : "#ffd54f20"}` : "none",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.1em", color: "#555e7e", marginBottom: 8,
              }}>
                60 Min Bias
              </div>
              <div style={{
                fontSize: 32, fontWeight: 700, color: biasColor,
                letterSpacing: "-0.02em", lineHeight: 1,
                textTransform: "uppercase",
              }}>
                {bias === "bullish" ? "\u25B2 BULL" : bias === "bearish" ? "\u25BC BEAR" : "\u2014 NEUTRAL"}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                letterSpacing: "0.1em", color: "#555e7e", marginBottom: 8,
              }}>
                Position
              </div>
              <div style={{
                fontSize: 20, fontWeight: 600, color: posColor,
                textTransform: "uppercase",
              }}>
                {position}
              </div>
              {entryPrice && (
                <div style={{ fontSize: 12, color: "#555e7e", marginTop: 4 }}>
                  @ {entryPrice.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8, marginBottom: 20,
        }}>
          {[
            { label: "Signals", value: stats.total, color: "#e8ebf4" },
            { label: "Longs", value: stats.buys, color: "#26a69a" },
            { label: "Shorts", value: stats.sells, color: "#ef5350" },
          ].map((s, i) => (
            <div key={i} style={{
              background: "#0b0d16", border: "1px solid #151a28",
              borderRadius: 12, padding: "12px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#555e7e", marginBottom: 4 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontVariantNumeric: "tabular-nums" }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>

        {/* Signal Feed */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, textTransform: "uppercase",
            letterSpacing: "0.1em", color: "#555e7e",
          }}>
            Signal Feed {connected ? "(Live)" : "(Connecting...)"}
          </div>
          {lastUpdate && (
            <div style={{ fontSize: 10, color: "#3a4158" }}>
              Last: {formatTime(lastUpdate)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {signals.length === 0 ? (
            <div style={{
              padding: 40, textAlign: "center", color: "#3a4158",
              fontSize: 13, background: "#0b0d16", borderRadius: 12,
              border: "1px solid #151a28",
            }}>
              Waiting for signals from TradingView...
              <br />
              <span style={{ fontSize: 11, marginTop: 8, display: "block" }}>
                The connection dot turns green when the API is reachable.
                <br />Signals appear here when your strategy fires.
              </span>
            </div>
          ) : (
            signals.slice(0, 50).map((sig, i) => {
              const isBuy = sig.action === "buy";
              const isSell = sig.action === "sell";
              const actionColor = isBuy ? "#26a69a" : isSell ? "#ef5350" : "#ffd54f";
              const actionBg = isBuy ? "#26a69a10" : isSell ? "#ef535010" : "#ffd54f10";
              const isNew = i === 0 && Date.now() - sig.timestamp < 3000;

              return (
                <div
                  key={sig.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px",
                    background: isNew ? actionBg : "#0b0d16",
                    border: `1px solid ${isNew ? actionColor + "30" : "#151a28"}`,
                    borderRadius: 12,
                    transition: "all 0.5s ease",
                    animation: isNew ? "slideIn 0.3s ease" : "none",
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: actionColor + "15",
                    border: `1px solid ${actionColor}30`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                  }}>
                    {isBuy ? "\u25B2" : isSell ? "\u25BC" : "\u2298"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700, color: actionColor,
                        textTransform: "uppercase",
                      }}>
                        {sig.action === "buy" ? "LONG" : sig.action === "sell" ? "SHORT" : "EXIT"}
                      </div>
                      <div style={{
                        fontSize: 15, fontWeight: 600, color: "#e8ebf4",
                        fontVariantNumeric: "tabular-nums",
                      }}>
                        {sig.signalPrice?.toFixed(2)}
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                      <div style={{ fontSize: 10, color: "#555e7e" }}>
                        {sig.ticker} {sig.comment ? `\u00B7 ${sig.comment}` : ""}
                      </div>
                      <div style={{ fontSize: 10, color: "#3a4158", fontVariantNumeric: "tabular-nums" }}>
                        {formatTime(sig.timestamp)}
                      </div>
                    </div>
                    {sig.stopLoss && (
                      <div style={{ fontSize: 10, color: "#ef535080", marginTop: 2 }}>
                        SL: {sig.stopLoss.toFixed ? sig.stopLoss.toFixed(2) : sig.stopLoss}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Setup Guide */}
        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setShowSetup(!showSetup)}
            style={{
              width: "100%", padding: "14px",
              background: "#0b0d16", border: "1px solid #151a28",
              borderRadius: 12, color: "#555e7e", fontSize: 12,
              fontWeight: 600, cursor: "pointer", textAlign: "left",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <span>{"\uD83D\uDCE1"} Webhook Setup Guide</span>
            <span style={{ transform: showSetup ? "rotate(180deg)" : "none", transition: "0.2s" }}>{"\u25BE"}</span>
          </button>

          {showSetup && (
            <div style={{
              padding: 16, background: "#0b0d16",
              border: "1px solid #151a28", borderTop: "none",
              borderRadius: "0 0 12px 12px", fontSize: 12,
              color: "#8890a8", lineHeight: 1.7,
            }}>
              <p style={{ marginBottom: 12, color: "#c8ccd8", fontWeight: 600 }}>
                Your webhook URL is:
              </p>
              <div style={{
                background: "#151a28", padding: "10px 12px", borderRadius: 8,
                fontSize: 11, color: "#ffd54f", marginBottom: 12, wordBreak: "break-all",
              }}>
                https://YOUR-APP.vercel.app/api/webhook
              </div>
              <p style={{ marginBottom: 8 }}>
                <span style={{ color: "#26a69a", fontWeight: 700 }}>1.</span> In TradingView, edit your strategy alert
              </p>
              <p style={{ marginBottom: 8 }}>
                <span style={{ color: "#26a69a", fontWeight: 700 }}>2.</span> Add a second webhook notification with the URL above
              </p>
              <p style={{ marginBottom: 8 }}>
                <span style={{ color: "#26a69a", fontWeight: 700 }}>3.</span> Keep the alert message as: {"{{strategy.order.alert_message}}"}
              </p>
              <p style={{ marginBottom: 8 }}>
                <span style={{ color: "#26a69a", fontWeight: 700 }}>4.</span> Signals will appear here in real time
              </p>
              <p style={{ marginTop: 12, padding: "10px 12px", background: "#151a28", borderRadius: 8, fontSize: 11, color: "#ffd54f" }}>
                {"\uD83D\uDCA1"} Note: In-memory storage resets on each deploy. For persistent signals, connect a database like Supabase.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 24, paddingTop: 16,
          borderTop: "1px solid #151a28",
          textAlign: "center", fontSize: 10, color: "#3a4158",
        }}>
          WWR Signal Dashboard {"\u00B7"} Wickless Wave Rider {"\u00B7"} MNQ
          <br />
          Not financial advice {"\u00B7"} Trade at your own risk
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
