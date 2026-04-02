"use client";

import { useState } from "react";
import { FunnelTier, ShadeResult, LabPoint, MSTTier, UndertoneClass } from "@/types";
import { TierSelector } from "@/components/ui/TierSelector";
import { AIScanTier } from "@/components/scanner/AIScanTier";
import { MatchCard } from "@/components/results/MatchCard";

export function ShadeMatrixApp() {
  const [tier, setTier]       = useState<FunnelTier>("ai");
  const [matches, setMatches] = useState<ShadeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [textQuery, setTextQuery] = useState("");

  // ── Called by AIScanTier once the 10-second scan completes ───────────────
  const handleScanComplete = async (result: {
    skinLab:         LabPoint;
    mstTier:         MSTTier;
    undertoneClass:  UndertoneClass;
    undertoneVector: [number, number, number];
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/match", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skinLab:         result.skinLab,
          mstTier:         result.mstTier,
          undertoneClass:  result.undertoneClass,
          undertoneVector: result.undertoneVector,
          topN: 5,
        }),
      });
      if (!res.ok) throw new Error(`Match API returned ${res.status}`);
      const data = await res.json();
      setMatches(data.matches ?? []);
    } catch (e) {
      setError("Could not load matches. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // ── Text match handler ────────────────────────────────────────────────────
  const handleTextMatch = async () => {
    if (!textQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/text-match", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: textQuery.trim(), topN: 5 }),
      });
      if (!res.ok) throw new Error(`Text match API returned ${res.status}`);
      const data = await res.json();
      setMatches(data.matches ?? []);
    } catch (e) {
      setError("Search failed. Please try again.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTierChange = (t: FunnelTier) => {
    setTier(t);
    setMatches([]);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Header ── */}
        <div className="text-center">
          <p className="text-[10px] tracking-[0.3em] text-violet-400/70 uppercase mb-1">
            Scientific Shade Matrix
          </p>
          <h1 className="text-2xl font-black tracking-tight">Your Perfect Foundation</h1>
          <p className="text-sm text-white/40 mt-1">
            CIEDE2000 · MST Scale · Oxidation-Aware
          </p>
        </div>

        {/* ── Tier switcher ── */}
        <TierSelector active={tier} onChange={handleTierChange} />

        {/* ── Tier: AI Scan ── */}
        {tier === "ai" && (
          <AIScanTier onComplete={handleScanComplete} />
        )}

        {/* ── Tier: Text Match ── */}
        {tier === "text" && (
          <div className="flex flex-col gap-3">
            <input
              type="text"
              value={textQuery}
              onChange={(e) => setTextQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextMatch()}
              placeholder='e.g. "MAC NC30" or "Fenty 230N"'
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-white/30 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition"
            />
            <button
              onClick={handleTextMatch}
              disabled={loading || !textQuery.trim()}
              className="py-3.5 rounded-2xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 font-bold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Searching…" : "Find Matches →"}
            </button>
          </div>
        )}

        {/* ── Tier: AR VTO ── */}
        {tier === "vto" && (
          <div className="rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col items-center gap-3 py-14 px-6 text-center">
            <span className="text-5xl">✦</span>
            <p className="font-semibold text-white">AR Virtual Try-On</p>
            <p className="text-sm text-white/40">
              Hyper-realistic overlay with oxidised 2-hour wear preview.
              Requires a WebXR-compatible device.
            </p>
            <button className="mt-2 px-6 py-3 rounded-xl bg-violet-600/50 text-violet-200 text-sm font-medium border border-violet-500/30 cursor-not-allowed opacity-60">
              Launch AR — Coming Soon
            </button>
          </div>
        )}

        {/* ── Global loading state (post-scan API call) ── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-10 h-10 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin" />
            <p className="text-white/50 text-sm">Finding your matches…</p>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* ── Results ── */}
        {!loading && matches.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-white/40 uppercase tracking-widest">
                Top {matches.length} Matches · CIEDE2000 Wear Score
              </p>
              <button
                onClick={() => setMatches([])}
                className="text-[11px] text-white/30 hover:text-white/60 transition"
              >
                Clear
              </button>
            </div>
            {matches.map((m, i) => (
              <MatchCard key={m.colorMetricId} result={m} rank={i + 1} />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}
