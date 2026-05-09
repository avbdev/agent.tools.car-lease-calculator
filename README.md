# Car Lease Calculator

A full-featured car lease calculator built with Next.js 15 + React 19 + TypeScript.

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

## Development

```bash
npm install
npm run dev
npm test         # 34 unit tests
npm run build    # production build
```

## Deployment

Deployed to Vercel free tier. Configured via `vercel.json`.
