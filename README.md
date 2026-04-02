# Scientific Shade Matrix

> AI-driven foundation matching built on Next.js 15 (App Router), using CIEDE2000 colour science, the Monk Skin Tone scale, and oxidation modelling. Deployable to Vercel in one command.

---

## Project Structure

```
shade-matrix/
├── app/
│   ├── layout.tsx                        # Root layout (Geist font, metadata)
│   ├── globals.css                       # Tailwind base + custom scrollbar
│   ├── page.tsx                          # Home page (Server Component shell)
│   └── api/
│       ├── match/route.ts                # POST /api/match  — AI scan results
│       └── text-match/route.ts           # POST /api/text-match — fuzzy SKU search
├── components/
│   ├── ShadeMatrixApp.tsx                # Root Client Component / funnel orchestrator
│   ├── ui/
│   │   └── TierSelector.tsx             # Three-tier nav (Text / AI / AR)
│   ├── scanner/
│   │   ├── AIScanTier.tsx               # Full scan flow (camera + LIQA + analysis)
│   │   └── AIScannerOverlay.tsx         # Real-time guidance UI over video feed
│   └── results/
│       └── MatchCard.tsx                # Explainability card per shade result
├── hooks/
│   ├── useLIQA.ts                       # Live Image Quality Assurance (RAF loop)
│   └── useColorAnalysis.ts              # sRGB → D65 → Lab, median sampling
├── lib/
│   ├── colorScience.ts                  # CIEDE2000, MST, undertone (server + client)
│   ├── db.ts                            # Singleton pg connection pool
│   └── matcher.ts                       # ANN retrieve + CIEDE2000 re-rank
├── types/
│   └── index.ts                         # All shared TypeScript types
├── python/
│   └── ciede2000_engine.py              # Standalone Python matching engine
├── sql/
│   └── shade_matrix_schema.sql          # PostgreSQL 16 schema (pgvector + HNSW)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── .env.example
```

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment
```bash
cp .env.example .env.local
# Fill in POSTGRES_URL with your pgvector-enabled PostgreSQL connection string
```

### 3. Set up the database
```bash
# Requires PostgreSQL 16+ with pgvector extension installed
psql -U postgres -d your_db -f sql/shade_matrix_schema.sql
```

### 4. Run locally
```bash
npm run dev
# Open http://localhost:3000
```

### 5. Deploy to Vercel
```bash
npx vercel --prod
# Set POSTGRES_URL in the Vercel dashboard under Project → Settings → Environment Variables
```

---

## API Reference

### `POST /api/match`
Accepts a skin Lab reading from the AI scan and returns CIEDE2000-ranked shade matches.

**Request**
```json
{
  "skinLab":         { "L": 62.4, "a": 14.1, "b": 18.7 },
  "mstTier":         5,
  "undertoneClass":  "golden_warm",
  "undertoneVector": [0.7, 0.1, 0.2],
  "topN":            5,
  "finish":          "matte"
}
```

**Response**
```json
{
  "matches":     [ ...ShadeResult[] ],
  "scanMs":      12,
  "totalShades": 847
}
```

### `POST /api/text-match`
Fuzzy shade name / brand / SKU search using PostgreSQL trigrams.

**Request**
```json
{ "query": "MAC NC30", "topN": 5 }
```

---

## Key Concepts

| Term | Meaning |
|---|---|
| **CIEDE2000** | Perceptually-uniform colour difference (IEC 61966). The industry standard formula. |
| **ΔE₀₀ < 1.5** | Below the human perceptual threshold — an imperceptible match |
| **OxidationProfile** | Every shade has two Lab points: T=0 (fresh) and T=120 min (oxidised) |
| **TrueWear Score** | `0.35 × ΔE_fresh + 0.65 × ΔE_oxidised` — weights real wear experience |
| **MST Scale** | Monk Skin Tone (10 tiers) — replaces the outdated Fitzpatrick scale |
| **LIQA** | Live Image Quality Assurance — RAF loop that gates the scan on lighting quality |
| **D65** | Standard daylight illuminant used for white-balance normalisation |
| **HNSW** | pgvector index type — sub-millisecond ANN search across millions of shades |

---

## Confidence Thresholds

| ΔE₀₀ | Human perception |
|---|---|
| < 1.0 | Imperceptible |
| 1.0–1.5 | Visible only under close inspection |
| 1.5–3.0 | Noticeable on careful observation |
| 3.0–6.0 | Clearly visible at a glance |
| > 6.0 | Distinct colours — rejected by the matcher |

---

## Production Roadmap

- [ ] Replace heuristic LIQA with compiled ONNX face quality model (TFLite / WASM)
- [ ] Add WebXR + MediaPipe FaceMesh for AR Tier 3
- [ ] Sigmoid oxidation curve per formula base type (silicone vs water vs oil)
- [ ] Row-Level Security for B2B tenant isolation
- [ ] Spectrophotometer lab pipeline to upgrade `trust_score` to 1.0
- [ ] Partition `match_results` by month for analytics performance
- [ ] Kalman filter for temporal smoothing on skin Lab samples

---

## License
MIT
