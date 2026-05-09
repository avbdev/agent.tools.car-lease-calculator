/**
 * URL state encoding/decoding for shareable lease scenarios.
 * Encodes LeaseInputs as compact URL query parameters.
 */
import type { LeaseInputs } from './lease-calculator';

// Short parameter key mappings to keep URLs compact
const PARAM_KEYS: Record<keyof LeaseInputs, string> = {
  msrp: 'm',
  salePrice: 'sp',
  downPayment: 'dp',
  tradeIn: 'ti',
  residualPercent: 'rp',
  moneyFactor: 'mf',
  termMonths: 'tm',
  acquisitionFee: 'af',
  dispositionFee: 'df',
  salesTaxRate: 'tx',
  registrationFees: 'rf',
  taxOnFullCapCost: 'tfc',
  msdCount: 'ms',
  gapInsuranceMonthly: 'gi',
  annualMileage: 'am',
  overageCostPerMile: 'oc',
};

const REVERSE_KEYS: Record<string, keyof LeaseInputs> = Object.fromEntries(
  Object.entries(PARAM_KEYS).map(([k, v]) => [v, k as keyof LeaseInputs])
);

export function encodeLeaseInputsToURL(inputs: LeaseInputs): string {
  const params = new URLSearchParams();
  for (const [key, shortKey] of Object.entries(PARAM_KEYS)) {
    const value = inputs[key as keyof LeaseInputs];
    params.set(shortKey, String(value));
  }
  return params.toString();
}

export function decodeLeaseInputsFromURL(
  search: string,
  defaults: LeaseInputs
): LeaseInputs {
  const params = new URLSearchParams(search);
  const result = { ...defaults };

  for (const [shortKey, longKey] of Object.entries(REVERSE_KEYS)) {
    const raw = params.get(shortKey);
    if (raw === null) continue;

    if (longKey === 'taxOnFullCapCost') {
      (result as Record<string, unknown>)[longKey] = raw === 'true';
    } else {
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        (result as Record<string, unknown>)[longKey] = num;
      }
    }
  }

  return result;
}
