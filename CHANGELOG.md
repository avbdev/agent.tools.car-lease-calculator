# Changelog

All notable changes to this project are documented here.

## [Unreleased] — 2026-05-09

### Fixed
- **BUG-115** — Input fields could not delete the last character. Rewrote all numeric inputs to use `type="text" inputMode="decimal"` with a parallel `rawInputs` string-map state, allowing empty strings during editing without the field snapping back.

### Added
- **FEAT-116** — Save & Share Quotes via Firebase Firestore:
  - New `💾 Save this quote` button on the results panel — prompts for a label and saves the full calculator state to Firestore
  - Quote ID display (8-char uppercase alphanumeric) with one-click copy
  - Shareable link generation (`/quote/[ID]`) with one-click copy
  - Load quote by ID — enter any 8-char Quote ID to restore a saved calculation
  - Shareable `/quote/[id]` page — visiting a quote URL auto-populates the calculator server-side
  - Quotes expire after 90 days; expired or invalid IDs return a clear error
  - Rate limiting: max 10 saves per IP per hour
  - Labels sanitized (HTML stripped, max 60 chars)
- New API routes:
  - `POST /api/quotes` — save a quote
  - `GET /api/quotes/[id]` — retrieve a quote
- New page: `/quote/[id]` — server-rendered quote loader with OpenGraph metadata per quote
- Firebase Admin SDK integration (`firebase-admin`) with singleton initializer
- `.env.example` documenting required `FIREBASE_*` environment variables

### Changed
- `LeaseCalculator` component now accepts optional `initialInputs` and `quoteMeta` props for server-side quote pre-population
- APR input initial value now derived from actual initial `moneyFactor` instead of hardcoded `3.0`
- README updated with quote feature documentation, Firebase setup instructions, and environment variable reference
