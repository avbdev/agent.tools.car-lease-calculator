/**
 * Car Lease Calculator — Core Calculation Engine
 * All functions are pure (no side effects) and fully typed.
 * Formula reference: standard automotive lease payment formula.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LeaseInputs {
  /** Vehicle MSRP (sticker price) */
  msrp: number;
  /** Negotiated sale price / cap cost before reductions */
  salePrice: number;
  /** Cap cost reduction (down payment) */
  downPayment: number;
  /** Trade-in value applied to cap cost */
  tradeIn: number;
  /** Residual value as a percentage of MSRP (0–100) */
  residualPercent: number;
  /** Money factor (lease rate, e.g. 0.00125) */
  moneyFactor: number;
  /** Lease term in months */
  termMonths: number;
  /** Acquisition fee added to cap cost */
  acquisitionFee: number;
  /** Disposition fee (informational, due at lease end) */
  dispositionFee: number;
  /** Sales tax rate as percentage (e.g. 8.5 for 8.5%) */
  salesTaxRate: number;
  /** Registration and doc fees */
  registrationFees: number;
  /** Whether tax is applied to the full cap cost (some states) vs monthly payment */
  taxOnFullCapCost: boolean;
  /** Number of Multiple Security Deposits (reduces money factor) */
  msdCount: number;
  /** Gap insurance monthly cost */
  gapInsuranceMonthly: number;
  /** Annual mileage allowance (miles per year) */
  annualMileage: number;
  /** Per-mile overage fee (cents) */
  overageCostPerMile: number;
}

export interface LeaseResults {
  /** Adjusted cap cost after reductions */
  adjustedCapCost: number;
  /** Residual value in dollars */
  residualValue: number;
  /** Monthly depreciation component */
  monthlyDepreciation: number;
  /** Monthly finance charge component */
  monthlyFinanceCharge: number;
  /** Monthly payment before tax */
  monthlyPaymentPreTax: number;
  /** Monthly tax amount */
  monthlyTax: number;
  /** Total monthly payment including tax */
  monthlyPayment: number;
  /** Effective money factor after MSD reduction */
  effectiveMoneyFactor: number;
  /** Drive-off costs (first month + fees + taxes due at signing) */
  driveOffCosts: DriveOffCosts;
  /** Total of all payments over lease term */
  totalPayments: number;
  /** Total lease cost (payments + drive-off + disposition fee) */
  totalLeaseCost: number;
  /** Effective monthly cost including opportunity cost of down payment */
  effectiveMonthlyCost: number;
}

export interface DriveOffCosts {
  firstMonthPayment: number;
  acquisitionFee: number;
  registrationFees: number;
  downPayment: number;
  msdTotal: number;
  upfrontTax: number;
  total: number;
}

export interface AmortizationRow {
  month: number;
  startingBalance: number;
  depreciation: number;
  financeCharge: number;
  tax: number;
  totalPayment: number;
  endingBalance: number;
}

export interface ComparisonResults {
  lease: {
    totalCost: number;
    monthlyPayment: number;
    residualEquity: number;
  };
  buy: {
    totalCost: number;
    monthlyPayment: number;
    equity: number;
  };
  pcp: {
    totalCost: number;
    monthlyPayment: number;
    balloonPayment: number;
  };
  breakEvenMonths: number | null;
}

export interface MileageScenario {
  annualMiles: number;
  residualPercent: number;
  estimatedOverageCost: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** MSD discount per deposit (reduces money factor by this amount) */
const MSD_MF_REDUCTION_PER_UNIT = 0.00007;

/** Opportunity cost rate: annual return foregone on down payment (5%) */
const OPPORTUNITY_COST_ANNUAL_RATE = 0.05;

// ─── Core Calculation Functions ───────────────────────────────────────────────

/**
 * Convert Money Factor to APR equivalent.
 * Formula: APR = MF × 2400
 */
export function convertMFtoAPR(moneyFactor: number): number {
  return moneyFactor * 2400;
}

/**
 * Convert APR to Money Factor equivalent.
 * Formula: MF = APR / 2400
 */
export function convertAPRtoMF(apr: number): number {
  return apr / 2400;
}

/**
 * Calculate the effective money factor after applying MSD reduction.
 * Each MSD reduces the MF by a fixed amount (typically 0.00007).
 */
export function calculateEffectiveMF(
  moneyFactor: number,
  msdCount: number
): number {
  const reduced = moneyFactor - msdCount * MSD_MF_REDUCTION_PER_UNIT;
  return Math.max(0, reduced);
}

/**
 * Calculate the adjusted cap cost (capitalized cost).
 * Adjusted Cap Cost = Sale Price + Acquisition Fee - Down Payment - Trade-In
 */
export function calculateAdjustedCapCost(inputs: Pick<LeaseInputs,
  'salePrice' | 'acquisitionFee' | 'downPayment' | 'tradeIn'>): number {
  return inputs.salePrice + inputs.acquisitionFee - inputs.downPayment - inputs.tradeIn;
}

/**
 * Calculate residual value in dollars from MSRP and residual percent.
 */
export function calculateResidualValue(msrp: number, residualPercent: number): number {
  return msrp * (residualPercent / 100);
}

/**
 * Calculate monthly depreciation component.
 * Formula: (Adjusted Cap Cost - Residual Value) / Term Months
 */
export function calculateMonthlyDepreciation(
  adjustedCapCost: number,
  residualValue: number,
  termMonths: number
): number {
  if (termMonths <= 0) return 0;
  return (adjustedCapCost - residualValue) / termMonths;
}

/**
 * Calculate monthly finance charge component.
 * Formula: (Adjusted Cap Cost + Residual Value) × Money Factor
 */
export function calculateMonthlyFinanceCharge(
  adjustedCapCost: number,
  residualValue: number,
  effectiveMoneyFactor: number
): number {
  return (adjustedCapCost + residualValue) * effectiveMoneyFactor;
}

/**
 * Main calculation function — computes full lease results from inputs.
 *
 * Standard lease payment formula:
 *   Monthly Base = Depreciation + Finance Charge
 *   Depreciation = (Cap Cost - Residual) / Term
 *   Finance Charge = (Cap Cost + Residual) × Money Factor
 */
export function calculateLease(inputs: LeaseInputs): LeaseResults {
  const effectiveMF = calculateEffectiveMF(inputs.moneyFactor, inputs.msdCount);

  const adjustedCapCost = calculateAdjustedCapCost(inputs);
  const residualValue = calculateResidualValue(inputs.msrp, inputs.residualPercent);

  const monthlyDepreciation = calculateMonthlyDepreciation(
    adjustedCapCost,
    residualValue,
    inputs.termMonths
  );

  const monthlyFinanceCharge = calculateMonthlyFinanceCharge(
    adjustedCapCost,
    residualValue,
    effectiveMF
  );

  const monthlyPaymentPreTax = monthlyDepreciation + monthlyFinanceCharge;

  // Tax calculation: some states tax only monthly payment, others the full cap cost
  let monthlyTax: number;
  if (inputs.taxOnFullCapCost) {
    // Tax spread across lease term
    const totalTaxOnCapCost = adjustedCapCost * (inputs.salesTaxRate / 100);
    monthlyTax = totalTaxOnCapCost / inputs.termMonths;
  } else {
    monthlyTax = monthlyPaymentPreTax * (inputs.salesTaxRate / 100);
  }

  const monthlyPayment = monthlyPaymentPreTax + monthlyTax + inputs.gapInsuranceMonthly;

  // MSD total (refundable at lease end)
  const msdTotal = inputs.msdCount > 0
    ? Math.ceil(monthlyPayment / 50) * 50 * inputs.msdCount
    : 0;

  // Drive-off costs
  const upfrontTax = inputs.taxOnFullCapCost
    ? adjustedCapCost * (inputs.salesTaxRate / 100)
    : monthlyTax; // just first month's tax if monthly tax
  
  const driveOffCosts: DriveOffCosts = {
    firstMonthPayment: monthlyPayment,
    acquisitionFee: inputs.acquisitionFee,
    registrationFees: inputs.registrationFees,
    downPayment: inputs.downPayment,
    msdTotal,
    upfrontTax: inputs.taxOnFullCapCost ? upfrontTax : 0,
    get total() {
      return (
        this.firstMonthPayment +
        this.acquisitionFee +
        this.registrationFees +
        this.downPayment +
        this.msdTotal +
        this.upfrontTax
      );
    },
  };

  const totalPayments = monthlyPayment * inputs.termMonths;
  const totalLeaseCost =
    totalPayments +
    inputs.downPayment +
    inputs.registrationFees +
    inputs.acquisitionFee +
    inputs.dispositionFee +
    msdTotal; // MSD is refundable — included for cash flow, can be subtracted

  // Effective monthly cost includes opportunity cost of down payment
  const opportunityCostMonthly =
    (inputs.downPayment + inputs.tradeIn) *
    (OPPORTUNITY_COST_ANNUAL_RATE / 12);

  const effectiveMonthlyCost =
    monthlyPayment +
    opportunityCostMonthly +
    (inputs.registrationFees + inputs.acquisitionFee + inputs.dispositionFee) / inputs.termMonths;

  return {
    adjustedCapCost,
    residualValue,
    monthlyDepreciation,
    monthlyFinanceCharge,
    monthlyPaymentPreTax,
    monthlyTax,
    monthlyPayment,
    effectiveMoneyFactor: effectiveMF,
    driveOffCosts: {
      ...driveOffCosts,
      total: driveOffCosts.total,
    },
    totalPayments,
    totalLeaseCost,
    effectiveMonthlyCost,
  };
}

/**
 * Generate month-by-month amortization schedule.
 * Each month: balance reduces by depreciation component.
 */
export function calculateAmortizationSchedule(
  inputs: LeaseInputs
): AmortizationRow[] {
  const results = calculateLease(inputs);
  const rows: AmortizationRow[] = [];

  let balance = results.adjustedCapCost;

  for (let month = 1; month <= inputs.termMonths; month++) {
    const startingBalance = balance;
    const depreciation = results.monthlyDepreciation;
    const financeCharge = results.monthlyFinanceCharge;
    const tax = results.monthlyTax;
    const totalPayment = results.monthlyPayment;
    balance = Math.max(0, balance - depreciation);

    rows.push({
      month,
      startingBalance,
      depreciation,
      financeCharge,
      tax,
      totalPayment,
      endingBalance: balance,
    });
  }

  return rows;
}

/**
 * Calculate mileage overage cost for driving more than the annual allowance.
 */
export function calculateMileageOverage(
  actualAnnualMiles: number,
  allowedAnnualMiles: number,
  termMonths: number,
  overageCentsPerMile: number
): number {
  const totalAllowed = allowedAnnualMiles * (termMonths / 12);
  const totalActual = actualAnnualMiles * (termMonths / 12);
  const overage = Math.max(0, totalActual - totalAllowed);
  return overage * (overageCentsPerMile / 100);
}

/**
 * Compare lease vs buy vs PCP (Personal Contract Purchase).
 * Returns total cost of ownership for each option over the same period.
 */
export function compareLeaseVsBuy(
  inputs: LeaseInputs,
  loanAPR: number,
  pcpAPR: number
): ComparisonResults {
  const leaseResults = calculateLease(inputs);

  // Buy scenario: finance the full sale price
  const buyLoanAmount = inputs.salePrice - inputs.downPayment - inputs.tradeIn;
  const buyMonthlyRate = loanAPR / 100 / 12;
  const n = inputs.termMonths;

  let buyMonthlyPayment: number;
  if (buyMonthlyRate === 0 || buyLoanAmount <= 0) {
    buyMonthlyPayment = buyLoanAmount <= 0 ? 0 : buyLoanAmount / n;
  } else {
    buyMonthlyPayment =
      (buyLoanAmount * buyMonthlyRate * Math.pow(1 + buyMonthlyRate, n)) /
      (Math.pow(1 + buyMonthlyRate, n) - 1);
  }

  // Estimated remaining equity at end of term (using residual % as depreciation proxy)
  const buyEquity = leaseResults.residualValue;
  const buyTotalCost =
    buyMonthlyPayment * n +
    inputs.downPayment +
    inputs.registrationFees -
    buyEquity;

  // PCP scenario: balloon payment = residual value
  const pcpLoanAmount = inputs.salePrice - inputs.downPayment - inputs.tradeIn - leaseResults.residualValue;
  const pcpMonthlyRate = pcpAPR / 100 / 12;

  let pcpMonthlyPayment: number;
  if (pcpMonthlyRate === 0 || pcpLoanAmount <= 0) {
    pcpMonthlyPayment = pcpLoanAmount <= 0 ? 0 : pcpLoanAmount / n;
  } else {
    pcpMonthlyPayment =
      (pcpLoanAmount * pcpMonthlyRate * Math.pow(1 + pcpMonthlyRate, n)) /
      (Math.pow(1 + pcpMonthlyRate, n) - 1);
  }

  const pcpBalloon = leaseResults.residualValue;
  const pcpTotalCost =
    pcpMonthlyPayment * n +
    inputs.downPayment +
    pcpBalloon +
    inputs.registrationFees;

  const leaseTotalCost = leaseResults.totalLeaseCost;

  // Break-even: approximate months where lease total > buy total
  // Simple linear approximation: when cumulative difference crosses zero
  let breakEvenMonths: number | null = null;
  const leaseMonthlyCost = leaseResults.monthlyPayment;
  const buyMonthlyCost = buyMonthlyPayment;
  if (leaseMonthlyCost < buyMonthlyCost) {
    // Lease is cheaper per month; may never break even (buy gets equity)
    const monthlyDiff = buyMonthlyCost - leaseMonthlyCost;
    const leaseDriveOff = leaseResults.driveOffCosts.total;
    const buyDriveOff = inputs.downPayment + inputs.registrationFees;
    const initialLeaseCostAdv = leaseDriveOff - buyDriveOff;
    if (monthlyDiff > 0 && initialLeaseCostAdv < 0) {
      breakEvenMonths = Math.ceil(Math.abs(initialLeaseCostAdv) / monthlyDiff);
    }
  }

  return {
    lease: {
      totalCost: leaseTotalCost,
      monthlyPayment: leaseResults.monthlyPayment,
      residualEquity: 0, // No ownership equity in a lease
    },
    buy: {
      totalCost: buyTotalCost,
      monthlyPayment: buyMonthlyPayment,
      equity: buyEquity,
    },
    pcp: {
      totalCost: pcpTotalCost,
      monthlyPayment: pcpMonthlyPayment,
      balloonPayment: pcpBalloon,
    },
    breakEvenMonths,
  };
}

/**
 * Format currency for display.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format money factor for display (typically 5 decimal places).
 */
export function formatMoneyFactor(mf: number): string {
  return mf.toFixed(5);
}

/**
 * Format percentage for display.
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// ─── State Sales Tax Presets ──────────────────────────────────────────────────

export interface StateTaxPreset {
  state: string;
  code: string;
  rate: number;
  taxMethod: 'monthly' | 'full_cap_cost';
  notes: string;
}

export const STATE_TAX_PRESETS: StateTaxPreset[] = [
  { state: 'Alabama', code: 'AL', rate: 2.0, taxMethod: 'monthly', notes: '' },
  { state: 'Alaska', code: 'AK', rate: 0.0, taxMethod: 'monthly', notes: 'No sales tax' },
  { state: 'Arizona', code: 'AZ', rate: 5.6, taxMethod: 'monthly', notes: '' },
  { state: 'California', code: 'CA', rate: 7.25, taxMethod: 'monthly', notes: 'Base rate; local can be higher' },
  { state: 'Colorado', code: 'CO', rate: 2.9, taxMethod: 'monthly', notes: '' },
  { state: 'Connecticut', code: 'CT', rate: 6.35, taxMethod: 'full_cap_cost', notes: 'Tax on full cap cost' },
  { state: 'Florida', code: 'FL', rate: 6.0, taxMethod: 'monthly', notes: '' },
  { state: 'Georgia', code: 'GA', rate: 7.0, taxMethod: 'monthly', notes: '' },
  { state: 'Illinois', code: 'IL', rate: 6.25, taxMethod: 'monthly', notes: '' },
  { state: 'Maryland', code: 'MD', rate: 6.0, taxMethod: 'monthly', notes: '' },
  { state: 'Massachusetts', code: 'MA', rate: 6.25, taxMethod: 'monthly', notes: '' },
  { state: 'Michigan', code: 'MI', rate: 6.0, taxMethod: 'monthly', notes: '' },
  { state: 'Minnesota', code: 'MN', rate: 6.875, taxMethod: 'monthly', notes: '' },
  { state: 'New Jersey', code: 'NJ', rate: 6.625, taxMethod: 'monthly', notes: '' },
  { state: 'New York', code: 'NY', rate: 4.0, taxMethod: 'monthly', notes: 'Base rate; NYC adds 4.5%' },
  { state: 'North Carolina', code: 'NC', rate: 3.0, taxMethod: 'monthly', notes: 'Capped at $1,000' },
  { state: 'Ohio', code: 'OH', rate: 5.75, taxMethod: 'monthly', notes: '' },
  { state: 'Oregon', code: 'OR', rate: 0.0, taxMethod: 'monthly', notes: 'No sales tax' },
  { state: 'Pennsylvania', code: 'PA', rate: 6.0, taxMethod: 'full_cap_cost', notes: 'Tax on full cap cost' },
  { state: 'Texas', code: 'TX', rate: 6.25, taxMethod: 'monthly', notes: '' },
  { state: 'Virginia', code: 'VA', rate: 4.15, taxMethod: 'monthly', notes: '' },
  { state: 'Washington', code: 'WA', rate: 6.5, taxMethod: 'monthly', notes: '' },
];
