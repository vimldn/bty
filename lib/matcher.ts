import { getPool } from "@/lib/db";
import { ciede2000, undertoneSimilarity, confidenceFromDeltaE } from "@/lib/colorScience";
import { MatchRequest, MatchResponse, ShadeResult } from "@/types";

interface DbCandidate {
  color_metric_id: string;
  sku:             string;
  brand:           string;
  product_name:    string;
  shade_name:      string;
  finish:          string;
  coverage:        string;
  affiliate_url:   string;
  image_url:       string;
  mst_tier:        string;
  undertone_class: string;
  undertone_vector: number[];
  lab_l_fresh:     number;
  lab_a_fresh:     number;
  lab_b_fresh:     number;
  lab_l_oxidized:  number;
  lab_a_oxidized:  number;
  lab_b_oxidized:  number;
}

function buildExplanation(
  de_fresh:    number,
  de_wear:     number,
  utScore:     number,
  utClass:     string,
  mstDetected: number
): string {
  const depthWord =
    de_wear < 1.5 ? "precisely matches" :
    de_wear < 3.0 ? "closely matches"   : "approximates";

  const undertoneWord =
    utScore > 0.9 ? "perfectly neutralises your undertone" :
    utScore > 0.7 ? "works well with your undertone"       :
    utScore > 0.5 ? "has a slightly different undertone"   :
                    "has a different undertone — consider a mixer";

  return (
    `This shade ${depthWord} your MST-${mstDetected} depth ` +
    `(fresh ΔE ${de_fresh.toFixed(2)} / wear ΔE ${de_wear.toFixed(2)}) ` +
    `and ${undertoneWord} (${utClass.replace("_", " ")}, ${(utScore * 100).toFixed(0)}% similarity).`
  );
}

export async function findMatches(req: MatchRequest): Promise<MatchResponse> {
  const pool = getPool();
  const start = Date.now();

  // Step 1: ANN retrieval via pgvector (top 20 candidates)
  const pgVec = `[${req.skinLab.L},${req.skinLab.a},${req.skinLab.b}]`;

  const { rows } = await pool.query<DbCandidate>(`
    SELECT
      cm.id                        AS color_metric_id,
      p.sku,
      b.name                       AS brand,
      p.name                       AS product_name,
      cm.shade_name,
      p.finish::text,
      p.coverage::text,
      p.affiliate_url,
      p.image_url,
      cm.mst_tier::text,
      cm.undertone_class::text,
      ARRAY[
        (cm.undertone_vector::text::float[])[1],
        (cm.undertone_vector::text::float[])[2],
        (cm.undertone_vector::text::float[])[3]
      ]                            AS undertone_vector,
      cm.lab_l_fresh,
      cm.lab_a_fresh,
      cm.lab_b_fresh,
      cm.lab_l_oxidized,
      cm.lab_a_oxidized,
      cm.lab_b_oxidized
    FROM color_metrics cm
    JOIN products p ON p.id = cm.product_id
    JOIN brands   b ON b.id = p.brand_id
    WHERE cm.lab_vec_fresh IS NOT NULL
      ${req.finish ? "AND p.finish::text = $2" : ""}
    ORDER BY cm.lab_vec_fresh <-> $1::vector
    LIMIT 20
  `, req.finish ? [pgVec, req.finish] : [pgVec]);

  // Step 2: Re-rank with full CIEDE2000 + undertone cosine similarity
  const topN = req.topN ?? 5;

  const results: ShadeResult[] = rows
    .map((row) => {
      const freshLab     = { L: row.lab_l_fresh,    a: row.lab_a_fresh,    b: row.lab_b_fresh    };
      const oxidizedLab  = { L: row.lab_l_oxidized, a: row.lab_a_oxidized, b: row.lab_b_oxidized };

      const de_fresh    = ciede2000(req.skinLab, freshLab);
      const de_oxidized = ciede2000(req.skinLab, oxidizedLab);
      const de_wear     = 0.35 * de_fresh + 0.65 * de_oxidized;

      const utVec       = row.undertone_vector as [number, number, number];
      const utScore     = undertoneSimilarity(req.undertoneVector, utVec);

      // Composite: 60% color accuracy, 40% undertone harmony
      const composite   = 0.60 * de_wear + 0.40 * (1 - utScore) * 6;

      // Hard reject if clearly wrong shade
      if (de_fresh > 8) return null;

      const oxidation_delta_e = ciede2000(freshLab, oxidizedLab);

      return {
        colorMetricId: row.color_metric_id,
        sku:           row.sku,
        brand:         row.brand,
        productName:   row.product_name,
        shadeName:     row.shade_name,
        finish:        row.finish,
        coverage:      row.coverage,
        oxidation:     { fresh: freshLab, oxidized: oxidizedLab, oxidation_delta_e },
        mstTier:       parseInt(row.mst_tier.replace("MST_", "")) as import("@/types").MSTTier,
        undertoneClass: row.undertone_class as import("@/types").UndertoneClass,
        affiliateUrl:  row.affiliate_url ?? "#",
        imageUrl:      row.image_url ?? "",
        deltaEFresh:    de_fresh,
        deltaEOxidized: de_oxidized,
        deltaEWear:     de_wear,
        undertoneScore: utScore,
        confidencePct:  confidenceFromDeltaE(de_wear),
        explanation:    buildExplanation(de_fresh, de_wear, utScore, row.undertone_class, req.mstTier),
        _composite:     composite,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a as any)._composite - (b as any)._composite)
    .slice(0, topN)
    .map(({ _composite, ...rest }: any) => rest) as ShadeResult[];

  return {
    matches:     results,
    scanMs:      Date.now() - start,
    totalShades: rows.length,
  };
}
