"use client";

import { useRef, useCallback, useState, RefObject } from "react";

export interface LIQAResult {
  pass:          boolean;
  lightingScore: number;
  positionScore: number;
  shadowWarning: boolean;
}

function analyseFrame(
  canvas: HTMLCanvasElement,
  ctx:    CanvasRenderingContext2D
): LIQAResult {
  const { width, height } = canvas;
  const face = ctx.getImageData(width * 0.25, height * 0.1, width * 0.5, height * 0.6);
  const data = face.data;

  let totalLum = 0, dark = 0, hot = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    totalLum += lum;
    if (lum < 60)  dark++;
    if (lum > 220) hot++;
  }

  const n              = data.length / 4;
  const avgLum         = totalLum / n;
  const overExposedRat = hot / n;

  const lightingScore = Math.max(0, Math.min(1, (avgLum - 40) / 160) * (1 - overExposedRat * 3));
  const shadowWarning = dark / n > 0.2;
  const positionScore = 0.85; // TODO: replace with MediaPipe FaceMesh in production

  return {
    pass: lightingScore > 0.5 && !shadowWarning && positionScore > 0.7,
    lightingScore,
    positionScore,
    shadowWarning,
  };
}

export function useLIQA(videoRef: RefObject<HTMLVideoElement>) {
  const [liqaResult, setLiqaResult] = useState<LIQAResult>({
    pass: false, lightingScore: 0, positionScore: 0, shadowWarning: false,
  });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef    = useRef<number | null>(null);

  const startAnalysis = useCallback(() => {
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;
    const tick = () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      setLiqaResult(analyseFrame(canvas, ctx));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [videoRef]);

  const stopAnalysis = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  return { liqaResult, startAnalysis, stopAnalysis };
}
