/**
 * Quote storage utilities.
 * Quotes are stored in Firestore collection: "quotes"
 *
 * Document shape:
 * {
 *   id: string           — 8-char uppercase alphanumeric
 *   label: string        — user-provided label (max 60 chars, HTML stripped)
 *   inputs: LeaseInputs  — full calculator state
 *   createdAt: Timestamp
 *   expiresAt: Timestamp — createdAt + 90 days
 *   ipHash: string       — SHA-256 of client IP (for rate limiting; not stored in plaintext)
 * }
 */

import { getFirebaseAdmin } from "./firebase-admin";
import { LeaseInputs } from "./lease-calculator";
import { createHash } from "crypto";

const COLLECTION = "quotes";
const RATE_LIMITS_COLLECTION = "rate_limits";
const QUOTE_TTL_DAYS = 90;
const ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ID_LENGTH = 8;
const MAX_LABEL_LENGTH = 60;
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export interface SavedQuote {
  id: string;
  label: string;
  inputs: LeaseInputs;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
}

// ─── ID generation ───────────────────────────────────────────────────────────

function generateQuoteId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => ID_CHARS[b % ID_CHARS.length])
    .join("");
}

// ─── Label sanitization ──────────────────────────────────────────────────────

function sanitizeLabel(raw: string): string {
  // Strip HTML tags
  const stripped = raw.replace(/<[^>]*>/g, "").trim();
  return stripped.slice(0, MAX_LABEL_LENGTH);
}

// ─── IP hashing ──────────────────────────────────────────────────────────────

function hashIp(ip: string): string {
  return createHash("sha256").update(ip + "quote-salt").digest("hex");
}

// ─── Rate limiting ───────────────────────────────────────────────────────────
//
// Uses a separate `rate_limits` collection with one document per IP hash.
// Document ID = ipHash, shape: { count: number, windowStart: string (ISO) }
// A single-document read+write inside a transaction requires NO composite index.
//
// NOTE: This rate limiter uses Firestore as the backing store (rate_limits collection).
// This works correctly across all Vercel serverless function instances since state
// is stored in Firestore, not in-memory. Each request reads/writes the rate_limits
// document transactionally, ensuring consistency across instances.

export async function checkRateLimit(ip: string): Promise<boolean> {
  const { db } = getFirebaseAdmin();
  const ipHash = hashIp(ip);
  const rateLimitRef = db.collection(RATE_LIMITS_COLLECTION).doc(ipHash);

  let allowed = true;

  await db.runTransaction(async (tx) => {
    const doc = await tx.get(rateLimitRef);
    const now = new Date();
    const windowCutoff = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

    if (!doc.exists) {
      // First request ever from this IP — create the window
      tx.set(rateLimitRef, { count: 1, windowStart: now.toISOString() });
      return;
    }

    const data = doc.data()!;
    const docWindowStart = new Date(data.windowStart as string);

    if (docWindowStart < windowCutoff) {
      // Previous window has expired — reset
      tx.set(rateLimitRef, { count: 1, windowStart: now.toISOString() });
      return;
    }

    if ((data.count as number) >= RATE_LIMIT_MAX) {
      allowed = false;
      return;
    }

    tx.update(rateLimitRef, { count: (data.count as number) + 1 });
  });

  return allowed;
}

// ─── Save quote ──────────────────────────────────────────────────────────────

export async function saveQuote(
  inputs: LeaseInputs,
  label: string,
  ip: string
): Promise<SavedQuote> {
  const { db } = getFirebaseAdmin();

  const cleanLabel = sanitizeLabel(label) || "My Quote";
  const ipHash = hashIp(ip);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + QUOTE_TTL_DAYS * 86400 * 1000);

  // Generate a unique ID (retry on collision — astronomically rare)
  let id = generateQuoteId();
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await db.collection(COLLECTION).doc(id).get();
    if (!existing.exists) break;
    id = generateQuoteId();
  }

  const doc = {
    id,
    label: cleanLabel,
    inputs,
    createdAt: now,
    expiresAt,
    ipHash,
  };

  await db.collection(COLLECTION).doc(id).set(doc);

  return {
    id,
    label: cleanLabel,
    inputs,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

// ─── Get quote ───────────────────────────────────────────────────────────────

export async function getQuote(id: string): Promise<SavedQuote | null> {
  const { db } = getFirebaseAdmin();

  // Sanitize ID — must be exactly 8 uppercase alphanumeric chars
  const cleanId = id.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleanId.length !== ID_LENGTH) return null;

  const snap = await db.collection(COLLECTION).doc(cleanId).get();
  if (!snap.exists) return null;

  const data = snap.data()!;

  // Check expiry
  const expiresAt = data.expiresAt?.toDate?.() ?? new Date(data.expiresAt);
  if (expiresAt < new Date()) return null;

  return {
    id: data.id,
    label: data.label,
    inputs: data.inputs as LeaseInputs,
    createdAt: (data.createdAt?.toDate?.() ?? new Date(data.createdAt)).toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}
