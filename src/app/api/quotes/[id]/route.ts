/**
 * GET /api/quotes/[id]
 * Retrieves a saved lease quote by its 8-char ID.
 *
 * Response 200: { id, label, inputs, createdAt, expiresAt }
 * Response 404: not found or expired
 * Response 500: internal error
 */

import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/quotes";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid quote ID" }, { status: 400 });
    }

    const quote = await getQuote(id);

    if (!quote) {
      return NextResponse.json(
        { error: "Quote not found or has expired." },
        { status: 404 }
      );
    }

    return NextResponse.json(quote, { status: 200 });
  } catch (err) {
    console.error("[GET /api/quotes/[id]] Error:", err);
    return NextResponse.json(
      { error: "Failed to retrieve quote. Please try again." },
      { status: 500 }
    );
  }
}
