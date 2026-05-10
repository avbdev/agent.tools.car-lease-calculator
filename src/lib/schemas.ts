import { z } from "zod";

/**
 * Zod schema for LeaseInputs — mirrors the LeaseInputs interface in lease-calculator.ts.
 * Used by API routes to validate incoming quote payloads before saving to Firestore.
 */
export const LeaseInputsSchema = z.object({
  /** Vehicle MSRP (sticker price) */
  msrp: z.number().min(0).max(1_000_000),
  /** Negotiated sale price / cap cost before reductions */
  salePrice: z.number().min(0).max(1_000_000),
  /** Cap cost reduction (down payment) */
  downPayment: z.number().min(0).max(1_000_000),
  /** Trade-in value applied to cap cost */
  tradeIn: z.number().min(0).max(1_000_000),
  /** Residual value as a percentage of MSRP (0–100) */
  residualPercent: z.number().min(0).max(100),
  /** Money factor (lease rate, e.g. 0.00125) */
  moneyFactor: z.number().min(0).max(1),
  /** Lease term in months */
  termMonths: z.number().int().min(12).max(84),
  /** Acquisition fee added to cap cost */
  acquisitionFee: z.number().min(0).max(10_000),
  /** Disposition fee (due at lease end) */
  dispositionFee: z.number().min(0).max(10_000),
  /** Sales tax rate as percentage (e.g. 8.5 for 8.5%) */
  salesTaxRate: z.number().min(0).max(20),
  /** Registration and doc fees */
  registrationFees: z.number().min(0).max(10_000),
  /** Whether tax is applied to the full cap cost (some states) vs monthly payment */
  taxOnFullCapCost: z.boolean(),
  /** Number of Multiple Security Deposits */
  msdCount: z.number().int().min(0).max(10),
  /** Gap insurance monthly cost */
  gapInsuranceMonthly: z.number().min(0).max(5_000),
  /** Annual mileage allowance (miles per year) */
  annualMileage: z.number().int().min(5_000).max(50_000),
  /** Per-mile overage fee (cents) */
  overageCostPerMile: z.number().min(0).max(100),
});

export type LeaseInputs = z.infer<typeof LeaseInputsSchema>;

/**
 * Schema for the POST /api/quotes request body.
 * label: max 60 chars, HTML stripped via transform.
 */
export const SaveQuoteBodySchema = z.object({
  label: z
    .string()
    .min(1, "Label is required")
    .max(60, "Label must be 60 characters or fewer")
    .transform((s) => s.replace(/<[^>]*>/g, "").trim()),
  inputs: LeaseInputsSchema,
});

export type SaveQuoteBody = z.infer<typeof SaveQuoteBodySchema>;
