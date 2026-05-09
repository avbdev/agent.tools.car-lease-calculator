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
 * Response 400: validation error
 * Response 429: rate limit exceeded
 * Response 500: internal error
 */

import { NextRequest, NextResponse } from "next/server";
import { saveQuote, checkRateLimit } from "@/lib/quotes";
import { LeaseInputs } from "@/lib/lease-calculator";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function isValidInputs(inputs: unknown): inputs is LeaseInputs {
  if (!inputs || typeof inputs !== "object") return false;
  const i = inputs as Record<string, unknown>;
  // Validate required numeric fields — must match LeaseInputs exactly
  const requiredNumbers = [
    "msrp",
    "salePrice",
    "tradeIn",
    "downPayment",
    "moneyFactor",
    "residualPercent",
    "termMonths",
    "annualMileage",
    "acquisitionFee",
    "dispositionFee",
    "salesTaxRate",
    "registrationFees",
    "msdCount",
    "gapInsuranceMonthly",
    "overageCostPerMile",
  ];
  for (const field of requiredNumbers) {
    if (typeof i[field] !== "number" || !isFinite(i[field] as number)) {
      return false;
    }
  }
  return true;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { inputs, label } = body as { inputs: unknown; label: unknown };

    if (!isValidInputs(inputs)) {
      return NextResponse.json(
        { error: "Invalid or incomplete lease inputs" },
        { status: 400 }
      );
    }

    if (typeof label !== "string") {
      return NextResponse.json(
        { error: "Label must be a string" },
        { status: 400 }
      );
    }

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
