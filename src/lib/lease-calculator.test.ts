import { describe, it, expect } from 'vitest';
import {
  convertMFtoAPR,
  convertAPRtoMF,
  calculateEffectiveMF,
  calculateAdjustedCapCost,
  calculateResidualValue,
  calculateMonthlyDepreciation,
  calculateMonthlyFinanceCharge,
  calculateLease,
  calculateAmortizationSchedule,
  calculateMileageOverage,
} from './lease-calculator';
import type { LeaseInputs } from './lease-calculator';

// ─── Real-world test fixture ──────────────────────────────────────────────────
// Example: 2024 Toyota Camry lease deal (illustrative)
// MSRP: $30,000, Sale: $28,500, Down: $2,000, Trade: $0
// Residual: 55% ($16,500), MF: 0.00125, Term: 36 months
// Acquisition: $895, Sales Tax: 8%, No MSD
const sampleInputs: LeaseInputs = {
  msrp: 30000,
  salePrice: 28500,
  downPayment: 2000,
  tradeIn: 0,
  residualPercent: 55,
  moneyFactor: 0.00125,
  termMonths: 36,
  acquisitionFee: 895,
  dispositionFee: 395,
  salesTaxRate: 8,
  registrationFees: 300,
  taxOnFullCapCost: false,
  msdCount: 0,
  gapInsuranceMonthly: 0,
  annualMileage: 12000,
  overageCostPerMile: 25,
};

describe('convertMFtoAPR', () => {
  it('converts standard money factor to APR correctly', () => {
    expect(convertMFtoAPR(0.00125)).toBeCloseTo(3.0, 1);
  });

  it('returns 0 for MF of 0', () => {
    expect(convertMFtoAPR(0)).toBe(0);
  });

  it('converts 0.00250 to 6.0% APR', () => {
    expect(convertMFtoAPR(0.0025)).toBeCloseTo(6.0, 1);
  });
});

describe('convertAPRtoMF', () => {
  it('converts 3% APR to money factor correctly', () => {
    expect(convertAPRtoMF(3.0)).toBeCloseTo(0.00125, 5);
  });

  it('round-trips MF → APR → MF', () => {
    const original = 0.00175;
    expect(convertAPRtoMF(convertMFtoAPR(original))).toBeCloseTo(original, 5);
  });
});

describe('calculateEffectiveMF', () => {
  it('reduces MF by 0.00007 per MSD', () => {
    const result = calculateEffectiveMF(0.00125, 3);
    expect(result).toBeCloseTo(0.00125 - 3 * 0.00007, 5);
  });

  it('never returns negative MF', () => {
    expect(calculateEffectiveMF(0.00010, 10)).toBe(0);
  });

  it('returns unchanged MF for 0 MSDs', () => {
    expect(calculateEffectiveMF(0.00125, 0)).toBe(0.00125);
  });
});

describe('calculateAdjustedCapCost', () => {
  it('computes cap cost correctly', () => {
    // 28500 + 895 - 2000 - 0 = 27395
    const result = calculateAdjustedCapCost({
      salePrice: 28500,
      acquisitionFee: 895,
      downPayment: 2000,
      tradeIn: 0,
    });
    expect(result).toBe(27395);
  });

  it('applies trade-in as additional reduction', () => {
    const result = calculateAdjustedCapCost({
      salePrice: 28500,
      acquisitionFee: 895,
      downPayment: 2000,
      tradeIn: 3000,
    });
    expect(result).toBe(24395);
  });
});

describe('calculateResidualValue', () => {
  it('computes 55% residual of $30,000 MSRP', () => {
    expect(calculateResidualValue(30000, 55)).toBe(16500);
  });

  it('computes 0% residual', () => {
    expect(calculateResidualValue(30000, 0)).toBe(0);
  });

  it('computes 100% residual', () => {
    expect(calculateResidualValue(30000, 100)).toBe(30000);
  });
});

describe('calculateMonthlyDepreciation', () => {
  it('computes correct monthly depreciation', () => {
    // (27395 - 16500) / 36 = 10895 / 36 ≈ 302.64
    const result = calculateMonthlyDepreciation(27395, 16500, 36);
    expect(result).toBeCloseTo(302.64, 1);
  });

  it('returns 0 for 0 term months', () => {
    expect(calculateMonthlyDepreciation(27395, 16500, 0)).toBe(0);
  });
});

describe('calculateMonthlyFinanceCharge', () => {
  it('computes correct finance charge', () => {
    // (27395 + 16500) × 0.00125 = 43895 × 0.00125 = 54.87
    const result = calculateMonthlyFinanceCharge(27395, 16500, 0.00125);
    expect(result).toBeCloseTo(54.87, 1);
  });
});

describe('calculateLease — full integration', () => {
  it('produces correct monthly payment for known deal', () => {
    const results = calculateLease(sampleInputs);
    // Depreciation: (27395 - 16500) / 36 = 302.64
    // Finance: (27395 + 16500) × 0.00125 = 54.87
    // Pre-tax: ≈ 357.51
    // Tax (8%): ≈ 28.60
    // Total: ≈ 386.11
    expect(results.monthlyPayment).toBeGreaterThan(380);
    expect(results.monthlyPayment).toBeLessThan(400);
  });

  it('adjusted cap cost is correct', () => {
    const results = calculateLease(sampleInputs);
    expect(results.adjustedCapCost).toBe(27395);
  });

  it('residual value is correct', () => {
    const results = calculateLease(sampleInputs);
    expect(results.residualValue).toBe(16500);
  });

  it('effective money factor equals input MF when msdCount=0', () => {
    const results = calculateLease(sampleInputs);
    expect(results.effectiveMoneyFactor).toBe(0.00125);
  });

  it('MSD reduces effective money factor', () => {
    const inputs = { ...sampleInputs, msdCount: 3 };
    const results = calculateLease(inputs);
    expect(results.effectiveMoneyFactor).toBeCloseTo(0.00125 - 3 * 0.00007, 5);
    expect(results.monthlyPayment).toBeLessThan(calculateLease(sampleInputs).monthlyPayment);
  });

  it('monthly payment with zero down payment is higher', () => {
    const base = calculateLease(sampleInputs);
    const noDown = calculateLease({ ...sampleInputs, downPayment: 0 });
    expect(noDown.monthlyPayment).toBeGreaterThan(base.monthlyPayment);
  });

  it('total payments equals monthly payment × term', () => {
    const results = calculateLease(sampleInputs);
    expect(results.totalPayments).toBeCloseTo(
      results.monthlyPayment * sampleInputs.termMonths,
      1
    );
  });

  it('drive-off total is positive', () => {
    const results = calculateLease(sampleInputs);
    expect(results.driveOffCosts.total).toBeGreaterThan(0);
  });

  it('drive-off includes first month payment', () => {
    const results = calculateLease(sampleInputs);
    expect(results.driveOffCosts.firstMonthPayment).toBeCloseTo(results.monthlyPayment, 1);
  });
});

describe('calculateAmortizationSchedule', () => {
  it('returns correct number of rows', () => {
    const schedule = calculateAmortizationSchedule(sampleInputs);
    expect(schedule).toHaveLength(sampleInputs.termMonths);
  });

  it('ending balance at final month is close to residual value', () => {
    const schedule = calculateAmortizationSchedule(sampleInputs);
    const lastRow = schedule[schedule.length - 1];
    expect(lastRow!.endingBalance).toBeCloseTo(16500, 0);
  });

  it('first month starting balance equals adjusted cap cost', () => {
    const schedule = calculateAmortizationSchedule(sampleInputs);
    const firstRow = schedule[0];
    expect(firstRow!.startingBalance).toBeCloseTo(27395, 1);
  });
});

describe('calculateMileageOverage', () => {
  it('returns 0 when within mileage', () => {
    expect(calculateMileageOverage(12000, 12000, 36, 25)).toBe(0);
  });

  it('returns 0 when under mileage', () => {
    expect(calculateMileageOverage(10000, 12000, 36, 25)).toBe(0);
  });

  it('calculates overage correctly', () => {
    // 36-month lease, 10k/yr allowed, 12k/yr driven
    // Over: (12000 - 10000) × 3 = 6000 miles × $0.25 = $1500
    const result = calculateMileageOverage(12000, 10000, 36, 25);
    expect(result).toBe(1500);
  });
});

describe('edge cases', () => {
  it('handles zero acquisition fee', () => {
    const results = calculateLease({ ...sampleInputs, acquisitionFee: 0 });
    expect(results.adjustedCapCost).toBe(26500);
  });

  it('handles zero sales tax', () => {
    const results = calculateLease({ ...sampleInputs, salesTaxRate: 0 });
    expect(results.monthlyTax).toBe(0);
  });

  it('handles tax on full cap cost method', () => {
    const monthly = calculateLease({ ...sampleInputs, taxOnFullCapCost: false });
    const full = calculateLease({ ...sampleInputs, taxOnFullCapCost: true });
    // Both methods produce a tax; they differ in amount
    expect(monthly.monthlyTax).toBeGreaterThan(0);
    expect(full.monthlyTax).toBeGreaterThan(0);
  });
});
