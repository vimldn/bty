import { LabPoint, MSTTier, UndertoneClass } from "@/types";

/** sRGB → CIE L*a*b* (D65 illuminant) — IEC 61966-2-1 / ISO 11664-3 */
export function srgbToLab(r255: number, g255: number, b255: number): LabPoint {
  const linearise = (c: number): number => {
    const n = c / 255;
    return n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  const rL = linearise(r255);
  const gL = linearise(g255);
  const bL = linearise(b255);

  // sRGB → XYZ (D65 illuminant matrix)
  const X = rL * 0.4124564 + gL * 0.3575761 + bL * 0.1804375;
  const Y = rL * 0.2126729 + gL * 0.7151522 + bL * 0.0721750;
  const Z = rL * 0.0193339 + gL * 0.1191920 + bL * 0.9503041;

  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(X / 0.95047);
  const fy = f(Y / 1.00000);
  const fz = f(Z / 1.08883);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** L* → Monk Skin Tone tier (1 = lightest, 10 = deepest) */
export function labToMST(lab: LabPoint): MSTTier {
  const { L } = lab;
  if (L > 88) return 1;
  if (L > 80) return 2;
  if (L > 72) return 3;
  if (L > 64) return 4;
  if (L > 56) return 5;
  if (L > 48) return 6;
  if (L > 40) return 7;
  if (L > 32) return 8;
  if (L > 24) return 9;
  return 10;
}

/** a*, b* axes → undertone classification + unit vector */
export function labToUndertone(lab: LabPoint): {
  cls: UndertoneClass;
  vector: [number, number, number];
} {
  const { a, b } = lab;
  const warm  = Math.max(0, b / 30);
  const cool  = Math.max(0, -a / 20);
  const olive = Math.max(0, (b - a * 0.5) / 25);
  const total = warm + cool + olive + 0.001;
  const vec: [number, number, number] = [warm / total, cool / total, olive / total];

  let cls: UndertoneClass = "neutral";
  if (vec[0] > 0.55)      cls = b > 18 ? "golden_warm" : "warm";
  else if (vec[1] > 0.55) cls = a < -5 ? "pink_cool"   : "cool";
  else if (vec[2] > 0.45) cls = "olive";

  return { cls, vector: vec };
}

/**
 * CIEDE2000 — full IEC 61966-4 / CIE 142-2001 formula.
 * Returns ΔE₀₀ between two CIE L*a*b* points.
 * Thresholds: <1.5 imperceptible · 1.5–3 acceptable · >3 noticeable · >6 rejected
 */
export function ciede2000(lab1: LabPoint, lab2: LabPoint): number {
  const deg = (r: number) => (r * 180) / Math.PI;
  const rad = (d: number) => (d * Math.PI) / 180;

  const C1 = Math.sqrt(lab1.a ** 2 + lab1.b ** 2);
  const C2 = Math.sqrt(lab2.a ** 2 + lab2.b ** 2);
  const Cb = (C1 + C2) / 2;
  const Cb7 = Cb ** 7;
  const G = 0.5 * (1 - Math.sqrt(Cb7 / (Cb7 + 25 ** 7)));

  const a1p = lab1.a * (1 + G);
  const a2p = lab2.a * (1 + G);
  const C1p = Math.sqrt(a1p ** 2 + lab1.b ** 2);
  const C2p = Math.sqrt(a2p ** 2 + lab2.b ** 2);

  const hp = (a: number, b: number) => {
    if (a === 0 && b === 0) return 0;
    const h = deg(Math.atan2(b, a));
    return h < 0 ? h + 360 : h;
  };
  const h1p = hp(a1p, lab1.b);
  const h2p = hp(a2p, lab2.b);

  const dLp = lab2.L - lab1.L;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) dhp = 0;
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;
  else dhp = h2p - h1p + 360;

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));

  const Lbp = (lab1.L + lab2.L) / 2;
  const Cbp = (C1p + C2p) / 2;

  let hbp: number;
  if (C1p * C2p === 0) hbp = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hbp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hbp = (h1p + h2p + 360) / 2;
  else hbp = (h1p + h2p - 360) / 2;

  const T =
    1 -
    0.17 * Math.cos(rad(hbp - 30)) +
    0.24 * Math.cos(rad(2 * hbp)) +
    0.32 * Math.cos(rad(3 * hbp + 6)) -
    0.2  * Math.cos(rad(4 * hbp - 63));

  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;

  const Cbp7 = Cbp ** 7;
  const RC = 2 * Math.sqrt(Cbp7 / (Cbp7 + 25 ** 7));
  const dt = 30 * Math.exp(-((hbp - 275) / 25) ** 2);
  const RT = -Math.sin(rad(2 * dt)) * RC;

  return Math.sqrt(
    (dLp / SL) ** 2 +
    (dCp / SC) ** 2 +
    (dHp / SH) ** 2 +
    RT * (dCp / SC) * (dHp / SH)
  );
}

/** Cosine similarity between two undertone vectors (0 = opposite, 1 = identical) */
export function undertoneSimilarity(
  v1: [number, number, number],
  v2: [number, number, number]
): number {
  const dot  = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const n1   = Math.sqrt(v1.reduce((s, x) => s + x * x, 0));
  const n2   = Math.sqrt(v2.reduce((s, x) => s + x * x, 0));
  return n1 === 0 || n2 === 0 ? 0.5 : dot / (n1 * n2);
}

/** ΔE₀₀ → human-readable confidence % */
export function confidenceFromDeltaE(de: number): number {
  return Math.max(0, 100 * Math.exp(-0.23 * de));
}
