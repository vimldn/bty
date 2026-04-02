import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { TextMatchRequest } from "@/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { query, topN = 10 }: TextMatchRequest = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const pool = getPool();

    // Fuzzy trigram search on normalised shade name + brand + SKU
    const { rows } = await pool.query(`
      SELECT
        cm.id                AS color_metric_id,
        p.sku,
        b.name               AS brand,
        p.name               AS product_name,
        cm.shade_name,
        p.finish::text,
        p.coverage::text,
        p.affiliate_url,
        p.image_url,
        cm.mst_tier::text,
        cm.undertone_class::text,
        cm.lab_l_fresh,
        cm.lab_a_fresh,
        cm.lab_b_fresh,
        cm.lab_l_oxidized,
        cm.lab_a_oxidized,
        cm.lab_b_oxidized,
        similarity(cm.shade_name_norm || ' ' || lower(b.name) || ' ' || lower(p.sku), lower($1)) AS sim_score
      FROM color_metrics cm
      JOIN products p ON p.id = cm.product_id
      JOIN brands   b ON b.id = p.brand_id
      WHERE
        cm.shade_name_norm % lower($1)
        OR lower(b.name)   % lower($1)
        OR lower(p.sku)    % lower($1)
      ORDER BY sim_score DESC
      LIMIT $2
    `, [query.trim(), topN]);

    return NextResponse.json({ matches: rows, totalFound: rows.length });
  } catch (err) {
    console.error("[/api/text-match]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
