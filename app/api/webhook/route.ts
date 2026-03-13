// @ts-nocheck
import { NextResponse } from "next/server";

// In-memory signal store (resets on deploy/restart)
// For production, replace with a database like Supabase or Firebase
let signals = [];
let currentBias = "neutral";
let currentPosition = "flat";
let entryPrice = null;

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.ticker || !body.action) {
      return NextResponse.json({ error: "Missing ticker or action" }, { status: 400 });
    }

    // Build signal object
    const signal = {
      id: Date.now(),
      timestamp: Date.now(),
      ticker: body.ticker || "MNQ",
      action: body.action,
      sentiment: body.sentiment || "flat",
      signalPrice: body.signalPrice || body.price || null,
      stopLoss: body.stopLoss?.stopPrice || null,
      comment: body.extras?.comment || body.action,
    };

    // Update state based on signal
    if (signal.action === "buy" && signal.sentiment === "bullish") {
      currentBias = "bullish";
      currentPosition = "long";
      entryPrice = signal.signalPrice;
    } else if (signal.action === "sell" && signal.sentiment === "bearish") {
      currentBias = "bearish";
      currentPosition = "short";
      entryPrice = signal.signalPrice;
    } else if (signal.action === "exit") {
      currentPosition = "flat";
      entryPrice = null;
    }

    // Store signal (keep last 200)
    signals.unshift(signal);
    if (signals.length > 200) signals = signals.slice(0, 200);

    console.log(`[WWR] ${signal.action.toUpperCase()} @ ${signal.signalPrice} | Bias: ${currentBias} | Position: ${currentPosition}`);

    return NextResponse.json({ success: true, signal }, { status: 200 });
  } catch (error) {
    console.error("[WWR] Webhook error:", error);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}

// GET endpoint — dashboard polls this for current state + signals
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const since = parseInt(searchParams.get("since") || "0");

  // Filter signals newer than the "since" timestamp
  const newSignals = since > 0 ? signals.filter((s) => s.timestamp > since) : signals.slice(0, 50);

  return NextResponse.json({
    bias: currentBias,
    position: currentPosition,
    entryPrice: entryPrice,
    signals: newSignals,
    totalSignals: signals.length,
    serverTime: Date.now(),
  });
}
