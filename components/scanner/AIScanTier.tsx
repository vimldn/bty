"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { ScanState, LabPoint, MSTTier, UndertoneClass } from "@/types";
import { useLIQA } from "@/hooks/useLIQA";
import { extractSkinColor } from "@/hooks/useColorAnalysis";
import { AIScannerOverlay } from "./AIScannerOverlay";

interface Props {
  onComplete: (result: {
    skinLab:         LabPoint;
    mstTier:         MSTTier;
    undertoneClass:  UndertoneClass;
    undertoneVector: [number, number, number];
  }) => void;
}

export function AIScanTier({ onComplete }: Props) {
  const [scanState, setScanState]       = useState<ScanState>({
    status: "idle", liqaPass: false,
    lightingScore: 0, positionScore: 0, shadowWarning: false,
  });
  const [scanProgress, setScanProgress] = useState(0);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { liqaResult, startAnalysis, stopAnalysis } = useLIQA(videoRef);

  useEffect(() => {
    if (scanState.status === "scanning") {
      setScanState((p) => ({
        ...p,
        liqaPass:      liqaResult.pass,
        lightingScore: liqaResult.lightingScore,
        positionScore: liqaResult.positionScore,
        shadowWarning: liqaResult.shadowWarning,
      }));
    }
  }, [liqaResult, scanState.status]);

  const doAnalysis = useCallback(async () => {
    setScanState((s) => ({ ...s, status: "analysing" }));
    try {
      const result = await extractSkinColor(videoRef.current!, 15);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setScanState((s) => ({
        ...s, status: "complete",
        skinLab:           result.skinLab,
        mstDetected:       result.mstTier,
        undertoneDetected: result.undertoneClass,
        undertoneVector:   result.undertoneVector,
      }));
      onComplete(result);
    } catch {
      setScanState((s) => ({
        ...s, status: "error",
        errorMessage: "Analysis failed. Please retry.",
      }));
    }
  }, [onComplete]);

  const startScan = useCallback(async () => {
    try {
      setScanState((s) => ({ ...s, status: "requesting_camera" }));
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setScanState((s) => ({ ...s, status: "scanning" }));
      startAnalysis();

      let progress = 0;
      const interval = setInterval(() => {
        progress += 1;
        setScanProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          stopAnalysis();
          doAnalysis();
        }
      }, 100);
    } catch {
      setScanState((s) => ({
        ...s, status: "error",
        errorMessage: "Camera access denied. Please allow camera permissions.",
      }));
    }
  }, [startAnalysis, stopAnalysis, doAnalysis]);

  const reset = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setScanState({ status: "idle", liqaPass: false, lightingScore: 0, positionScore: 0, shadowWarning: false });
    setScanProgress(0);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Camera viewport */}
      {["scanning", "requesting_camera"].includes(scanState.status) && (
        <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4]">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
          <AIScannerOverlay
            lightingScore={scanState.lightingScore}
            positionScore={scanState.positionScore}
            shadowWarning={scanState.shadowWarning}
            liqaPass={scanState.liqaPass}
            scanProgress={scanProgress}
            status={scanState.status}
          />
        </div>
      )}

      {/* Analysing spinner */}
      {scanState.status === "analysing" && (
        <div className="flex flex-col items-center gap-3 py-12">
          <div className="w-16 h-16 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin" />
          <p className="text-white/60 text-sm">Applying D65 normalisation…</p>
        </div>
      )}

      {/* Idle CTA */}
      {scanState.status === "idle" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div className="w-24 h-24 rounded-full bg-violet-600/20 border-2 border-violet-500/30 flex items-center justify-center text-4xl">
            ◉
          </div>
          <div className="text-center">
            <p className="font-semibold text-white">Start 10-Second Scan</p>
            <p className="text-sm text-white/40 mt-1">
              Multi-spectral analysis detects your MST tier and undertone under D65-normalised conditions
            </p>
          </div>
          <button
            onClick={startScan}
            className="w-full max-w-xs py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 font-bold text-white transition-colors shadow-lg shadow-violet-500/25"
          >
            Begin Scan →
          </button>
        </div>
      )}

      {/* Error */}
      {scanState.status === "error" && (
        <div className="rounded-2xl bg-red-500/10 border border-red-500/30 p-4 text-center">
          <p className="text-red-400 text-sm">{scanState.errorMessage}</p>
          <button onClick={reset} className="mt-3 text-sm text-white/60 underline">
            Try again
          </button>
        </div>
      )}

      {/* Detected profile summary */}
      {scanState.status === "complete" && scanState.skinLab && (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex gap-4 items-center">
          <div className="flex flex-col gap-1 flex-1">
            <p className="text-[11px] text-white/40 uppercase tracking-widest">
              Skin Profile Detected
            </p>
            <p className="font-semibold">MST-{scanState.mstDetected}</p>
            <p className="text-sm text-white/60 capitalize">
              {scanState.undertoneDetected?.replace(/_/g, " ")} undertone
            </p>
            <p className="text-[11px] font-mono text-white/30 mt-1">
              L* {scanState.skinLab.L.toFixed(1)} ·
              a* {scanState.skinLab.a.toFixed(1)} ·
              b* {scanState.skinLab.b.toFixed(1)}
            </p>
          </div>
          <button
            onClick={reset}
            className="text-xs text-white/40 border border-white/10 rounded-lg px-3 py-1.5 hover:border-white/30 transition"
          >
            Rescan
          </button>
        </div>
      )}
    </div>
  );
}
