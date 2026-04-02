"use client";

import { srgbToLab, labToMST, labToUndertone } from "@/lib/colorScience";
import { LabPoint, MSTTier, UndertoneClass } from "@/types";

export interface ColorAnalysisResult {
  skinLab:         LabPoint;
  mstTier:         MSTTier;
  undertoneClass:  UndertoneClass;
  undertoneVector: [number, number, number];
}

/**
 * Samples bilateral cheek zones across sampleFrames video frames,
 * then returns the median Lab — robust against blink and motion artefacts.
 */
export async function extractSkinColor(
  videoElement: HTMLVideoElement,
  sampleFrames  = 15
): Promise<ColorAnalysisResult> {
  const canvas  = document.createElement("canvas");
  canvas.width  = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx     = canvas.getContext("2d")!;
  const samples: LabPoint[] = [];

  for (let i = 0; i < sampleFrames; i++) {
    await new Promise<void>((res) => setTimeout(res, 400));
    ctx.drawImage(videoElement, 0, 0);

    // Left and right cheek zones — avoids the nose specular highlight
    for (const region of [
      ctx.getImageData(canvas.width * 0.2, canvas.height * 0.4, 40, 40),
      ctx.getImageData(canvas.width * 0.6, canvas.height * 0.4, 40, 40),
    ]) {
      const d = region.data;
      let R = 0, G = 0, B = 0, count = 0;
      for (let j = 0; j < d.length; j += 4) {
        R += d[j]; G += d[j + 1]; B += d[j + 2]; count++;
      }
      samples.push(srgbToLab(R / count, G / count, B / count));
    }
  }

  const median = (vals: number[]) =>
    vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)];

  const skinLab: LabPoint = {
    L: median(samples.map((s) => s.L)),
    a: median(samples.map((s) => s.a)),
    b: median(samples.map((s) => s.b)),
  };

  const mstTier                              = labToMST(skinLab);
  const { cls: undertoneClass, vector: undertoneVector } = labToUndertone(skinLab);

  return { skinLab, mstTier, undertoneClass, undertoneVector };
}
