# Car Lease Calculator

A full-featured car lease calculator built with Next.js + React 19 + TypeScript.

## Features

- **Monthly payment calculator** using the standard automotive lease formula
- **Money Factor ↔ APR converter** (bidirectional)
- **Amortization schedule** with month-by-month breakdown
- **Lease vs Buy vs PCP comparison** with configurable loan rates
- **Drive-off costs breakdown** (due at signing)
- **Mileage overage calculator**
- **Multiple Security Deposits (MSD)** calculator
- **State tax presets** (22 states + DC)
- **Save up to 3 scenarios** to localStorage for comparison
- **Share scenario via URL** — all inputs encoded in query string
- **Save & share quotes** — save any calculation to the cloud and retrieve it by 8-char ID or shareable link (quotes expire after 90 days)
- **Load saved quotes** by Quote ID or via `/quote/[ID]` shareable link
- **Payment composition chart** (depreciation vs finance vs tax)
- **Dark/light mode** toggle
- **Print-friendly view**
- **Mobile responsive** layout

## Formula Reference

```
Monthly Base Payment = Depreciation + Finance Charge
Depreciation = (Adjusted Cap Cost - Residual Value) / Term Months
Finance Charge = (Adjusted Cap Cost + Residual Value) × Money Factor
```

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript (strict)
- TailwindCSS v4
- Recharts
- Vitest (unit tests)
- Firebase Admin SDK (Firestore for cloud quote storage)

## Development

```bash
npm install
cp .env.example .env.local   # fill in Firebase credentials
npm run dev
npm test         # 34 unit tests
npm run build    # production build
```

## Environment Variables

Required to enable quote save/load. See `.env.example` for format.

| Variable | Description |
|----------|-------------|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key (PEM, with `\n` escaped) |

### Setting up Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/) → Create project
2. Enable **Firestore Database** (Start in production mode)
3. Go to Project Settings → Service Accounts → **Generate new private key**
4. Copy `project_id`, `client_email`, and `private_key` from the downloaded JSON into `.env.local`
5. For Vercel: add the same 3 vars via `npx vercel env add` or the Vercel dashboard

## Deployment

Deployed to Vercel free tier. Configured via `vercel.json`.

```bash
VERCEL_TOKEN=<token> npx vercel --prod
```

