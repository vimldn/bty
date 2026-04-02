import { NextRequest, NextResponse } from "next/server";
import { findMatches } from "@/lib/matcher";
import { MatchRequest } from "@/types";

export const runtime = "nodejs"; // needs pg (no Edge runtime)

export async function POST(req: NextRequest) {
  try {
    const body: MatchRequest = await req.json();

    // Basic validation
    if (!body.skinLab || body.skinLab.L === undefined) {
      return NextResponse.json(
        { error: "skinLab is required" },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.undertoneVector) || body.undertoneVector.length !== 3) {
      return NextResponse.json(
        { error: "undertoneVector must be a 3-element array" },
        { status: 400 }
      );
    }

    const result = await findMatches(body);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store", // skin results must never be cached
      },
    });
  } catch (err) {
    console.error("[/api/match]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Pre-flight for B2B widget CORS
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
