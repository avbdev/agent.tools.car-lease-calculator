/**
 * POST /api/quotes
 * Saves a lease calculator quote to Firestore.
 *
 * Request body:
 *   { inputs: LeaseInputs, label: string }
 *
 * Response 201:
 *   { id, label, createdAt, expiresAt }
 *
 * Response 400: validation error (with Zod error details)
 * Response 429: rate limit exceeded
 * Response 500: internal error
 */

import { NextRequest, NextResponse } from "next/server";
import { saveQuote, checkRateLimit } from "@/lib/quotes";
import { SaveQuoteBodySchema } from "@/lib/schemas";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = SaveQuoteBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { inputs, label } = parsed.data;

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 10 saves per hour." },
        { status: 429 }
      );
    }

    const quote = await saveQuote(inputs, label, ip);

    return NextResponse.json(
      {
        id: quote.id,
        label: quote.label,
        createdAt: quote.createdAt,
        expiresAt: quote.expiresAt,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[POST /api/quotes] Error:", err);
    return NextResponse.json(
      { error: "Failed to save quote. Please try again." },
      { status: 500 }
    );
  }
}
