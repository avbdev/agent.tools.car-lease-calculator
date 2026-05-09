'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  calculateLease,
  calculateAmortizationSchedule,
  calculateMileageOverage,
  compareLeaseVsBuy,
  convertMFtoAPR,
  convertAPRtoMF,
  formatCurrency,
  formatPercent,
  STATE_TAX_PRESETS,
} from '@/lib/lease-calculator';
import type { LeaseInputs, LeaseResults, AmortizationRow, ComparisonResults } from '@/lib/lease-calculator';
import { encodeLeaseInputsToURL, decodeLeaseInputsFromURL } from '@/lib/url-state';
import { loadScenarios, saveScenario, deleteScenario } from '@/lib/scenarios';
import type { SavedScenario } from '@/lib/scenarios';
import { PaymentChart } from './PaymentChart';

// ─── Default Inputs ───────────────────────────────────────────────────────────

const DEFAULT_INPUTS: LeaseInputs = {
  msrp: 35000,
  salePrice: 33000,
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

// Numeric keys in LeaseInputs (all except boolean and termMonths/annualMileage which use selects)
type NumericLeaseKey = Exclude<keyof LeaseInputs, 'taxOnFullCapCost' | 'termMonths' | 'annualMileage'>;

/** Convert DEFAULT_INPUTS to raw string map for input display */
function inputsToRaw(inputs: LeaseInputs): Record<NumericLeaseKey, string> {
  return {
    msrp: String(inputs.msrp),
    salePrice: String(inputs.salePrice),
    downPayment: String(inputs.downPayment),
    tradeIn: String(inputs.tradeIn),
    residualPercent: String(inputs.residualPercent),
    moneyFactor: String(inputs.moneyFactor),
    dispositionFee: String(inputs.dispositionFee),
    acquisitionFee: String(inputs.acquisitionFee),
    salesTaxRate: String(inputs.salesTaxRate),
    registrationFees: String(inputs.registrationFees),
    msdCount: String(inputs.msdCount),
    gapInsuranceMonthly: String(inputs.gapInsuranceMonthly),
    overageCostPerMile: String(inputs.overageCostPerMile),
  };
}

/** Parse raw string map back to numeric inputs, using current inputs as fallback */
function rawToInputs(raw: Record<NumericLeaseKey, string>, current: LeaseInputs): LeaseInputs {
  const parse = (key: NumericLeaseKey): number => {
    const v = parseFloat(raw[key]);
    return isNaN(v) ? (current[key] as number) : v;
  };
  return {
    ...current,
    msrp: parse('msrp'),
    salePrice: parse('salePrice'),
    downPayment: parse('downPayment'),
    tradeIn: parse('tradeIn'),
    residualPercent: parse('residualPercent'),
    moneyFactor: parse('moneyFactor'),
    dispositionFee: parse('dispositionFee'),
    acquisitionFee: parse('acquisitionFee'),
    salesTaxRate: parse('salesTaxRate'),
    registrationFees: parse('registrationFees'),
    msdCount: Math.round(parse('msdCount')),
    gapInsuranceMonthly: parse('gapInsuranceMonthly'),
    overageCostPerMile: parse('overageCostPerMile'),
  };
}

// ─── Tooltip Component ────────────────────────────────────────────────────────

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button
        type="button"
        className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-bold leading-4 inline-flex items-center justify-center hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        aria-label="Help"
      >
        ?
      </button>
      {show && (
        <span className="absolute left-5 top-0 z-50 w-64 p-2 text-xs text-white bg-gray-800 dark:bg-gray-700 rounded shadow-lg whitespace-normal">
          {text}
        </span>
      )}
    </span>
  );
}

// ─── Input Field Component ────────────────────────────────────────────────────
// Uses type="text" with inputMode="decimal" to allow empty state without browser coercion.

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tooltip?: string;
  prefix?: string;
  suffix?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
  className?: string;
}

function InputField({
  label, value, onChange, tooltip, prefix, suffix, inputMode = 'decimal', className = ''
}: InputFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </label>
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-3 text-gray-500 dark:text-gray-400 text-sm pointer-events-none">{prefix}</span>
        )}
        <input
          type="text"
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && (
          <span className="absolute right-3 text-gray-500 dark:text-gray-400 text-sm pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
      <span>{icon}</span>
      {title}
    </h3>
  );
}

// ─── Result Row ───────────────────────────────────────────────────────────────

function ResultRow({ label, value, highlight = false, tooltip }: {
  label: string;
  value: string;
  highlight?: boolean;
  tooltip?: string;
}) {
  return (
    <div className={`flex justify-between items-center py-2 ${highlight ? 'border-t-2 border-blue-200 dark:border-blue-700 mt-1' : 'border-b border-gray-100 dark:border-gray-700'}`}>
      <span className={`text-sm ${highlight ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'} flex items-center`}>
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      <span className={`text-sm font-mono ${highlight ? 'text-2xl font-bold text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Quote Save/Load Modal ────────────────────────────────────────────────────

interface QuoteSaveModalProps {
  onSave: (label: string) => void;
  onClose: () => void;
  isSaving: boolean;
}

function QuoteSaveModal({ onSave, onClose, isSaving }: QuoteSaveModalProps) {
  const [label, setLabel] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Save Quote</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Give this quote a name so you can find it later.</p>
        <input
          type="text"
          autoFocus
          placeholder="e.g. BMW 3 Series deal"
          value={label}
          onChange={e => setLabel(e.target.value.slice(0, 60))}
          onKeyDown={e => { if (e.key === 'Enter' && label.trim()) onSave(label.trim()); }}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={() => { if (label.trim()) onSave(label.trim()); }}
            disabled={!label.trim() || isSaving}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isSaving ? 'Saving…' : 'Save Quote'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface QuoteSuccessProps {
  quoteId: string;
  onClose: () => void;
}

function QuoteSuccessPanel({ quoteId, onClose }: QuoteSuccessProps) {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/quote/${quoteId}` : `/quote/${quoteId}`;

  const copyId = () => {
    navigator.clipboard.writeText(quoteId).then(() => { setCopiedId(true); setTimeout(() => setCopiedId(false), 2000); });
  };
  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); });
  };

  return (
    <div className="mt-3 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-semibold text-green-800 dark:text-green-300">✅ Quote saved!</p>
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">✕</button>
      </div>
      <p className="text-xs text-green-700 dark:text-green-400 mb-3">Your Quote ID:</p>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-2xl font-bold text-green-800 dark:text-green-300 tracking-widest">{quoteId}</span>
        <button onClick={copyId} className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-900/60 transition-colors">
          {copiedId ? '✓ Copied' : 'Copy ID'}
        </button>
      </div>
      <button
        onClick={copyLink}
        className="w-full text-xs py-2 px-3 bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors font-medium"
      >
        {copiedLink ? '✓ Link copied!' : '🔗 Copy shareable link'}
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Quote expires in 90 days.</p>
    </div>
  );
}

// ─── Main Calculator Component ────────────────────────────────────────────────

interface LeaseCalculatorProps {
  /** Pre-populated inputs (e.g. from a shared /quote/[id] route) */
  initialInputs?: LeaseInputs;
  /** Metadata for a pre-loaded quote (shows a banner) */
  quoteMeta?: { id: string; label: string; createdAt: string; expiresAt: string };
}

export function LeaseCalculator({ initialInputs, quoteMeta: initialQuoteMeta }: LeaseCalculatorProps = {}) {
  const startInputs = initialInputs ?? DEFAULT_INPUTS;
  const [inputs, setInputs] = useState<LeaseInputs>(startInputs);
  // rawInputs holds exactly what the user typed — separate from parsed inputs
  const [rawInputs, setRawInputs] = useState<Record<NumericLeaseKey, string>>(inputsToRaw(startInputs));
  const [rawActualMiles, setRawActualMiles] = useState('15000');
  const [results, setResults] = useState<LeaseResults | null>(null);
  const [amortization, setAmortization] = useState<AmortizationRow[]>([]);
  const [showAmortization, setShowAmortization] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [comparison, setComparison] = useState<ComparisonResults | null>(null);
  const [rawLoanAPR, setRawLoanAPR] = useState('6.5');
  const [rawPcpAPR, setRawPcpAPR] = useState('5.5');
  const [aprInput, setAprInput] = useState(convertMFtoAPR(startInputs.moneyFactor).toFixed(2));
  const [scenarios, setScenarios] = useState<SavedScenario[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [showScenarios, setShowScenarios] = useState(false);
  const [dark, setDark] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);
  const isInitialized = useRef(false);

  // Quote save/load state
  const [showQuoteSaveModal, setShowQuoteSaveModal] = useState(false);
  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [savedQuoteId, setSavedQuoteId] = useState<string | null>(null);
  const [showLoadQuote, setShowLoadQuote] = useState(false);
  const [loadQuoteId, setLoadQuoteId] = useState('');
  const [loadQuoteError, setLoadQuoteError] = useState('');
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  // initialQuoteMeta pre-populates when arriving via /quote/[id]
  const [loadedQuoteMeta, setLoadedQuoteMeta] = useState<{ label: string; createdAt: string; expiresAt: string } | null>(
    initialQuoteMeta ? { label: initialQuoteMeta.label, createdAt: initialQuoteMeta.createdAt, expiresAt: initialQuoteMeta.expiresAt } : null
  );

  // Load from URL on mount — skip URL decode if initialInputs was provided (server-side quote load)
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    if (!initialInputs) {
      const urlInputs = decodeLeaseInputsFromURL(window.location.search, DEFAULT_INPUTS);
      setInputs(urlInputs);
      setRawInputs(inputsToRaw(urlInputs));
      setAprInput(convertMFtoAPR(urlInputs.moneyFactor).toFixed(2));
    }

    const saved = loadScenarios();
    setScenarios(saved);

    // Theme from localStorage
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        setDark(true);
        document.documentElement.classList.add('dark');
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch { /* noop */ }
    } else {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('theme', 'light'); } catch { /* noop */ }
    }
  }, [dark]);

  // Recalculate on input change — skip if any critical field is empty/invalid
  useEffect(() => {
    try {
      const r = calculateLease(inputs);
      if (!isFinite(r.monthlyPayment) || r.monthlyPayment < 0) return;
      setResults(r);
      setAmortization(calculateAmortizationSchedule(inputs));
      if (showComparison) {
        const loanAPR = parseFloat(rawLoanAPR);
        const pcpAPR = parseFloat(rawPcpAPR);
        if (isFinite(loanAPR) && isFinite(pcpAPR)) {
          setComparison(compareLeaseVsBuy(inputs, loanAPR, pcpAPR));
        }
      }
    } catch {
      // Invalid inputs — keep previous results visible
    }
  }, [inputs, showComparison, rawLoanAPR, rawPcpAPR]);

  /** Update a raw string for a numeric input and sync parsed inputs */
  const handleRaw = useCallback((key: NumericLeaseKey) => (raw: string) => {
    setRawInputs(prev => {
      const next = { ...prev, [key]: raw };
      // Parse all raw values and update inputs
      setInputs(cur => rawToInputs(next, cur));
      return next;
    });
  }, []);

  const updateInput = useCallback(<K extends keyof LeaseInputs>(key: K, value: LeaseInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleReset = () => {
    setInputs(DEFAULT_INPUTS);
    setRawInputs(inputsToRaw(DEFAULT_INPUTS));
    setRawActualMiles('15000');
    setAprInput(convertMFtoAPR(DEFAULT_INPUTS.moneyFactor).toFixed(2));
    setSavedQuoteId(null);
    setLoadedQuoteMeta(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const handleShareURL = () => {
    const encoded = encodeLeaseInputsToURL(inputs);
    const url = `${window.location.origin}${window.location.pathname}?${encoded}`;
    navigator.clipboard.writeText(url).then(() => {
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    });
    window.history.replaceState(null, '', `?${encoded}`);
  };

  const handleSaveScenario = () => {
    if (!scenarioName.trim()) return;
    const updated = saveScenario(scenarioName.trim(), inputs);
    setScenarios(updated);
    setScenarioName('');
  };

  const handleLoadScenario = (scenario: SavedScenario) => {
    setInputs(scenario.inputs);
    setRawInputs(inputsToRaw(scenario.inputs));
    setAprInput(convertMFtoAPR(scenario.inputs.moneyFactor).toFixed(2));
  };

  const handleDeleteScenario = (id: string) => {
    const updated = deleteScenario(id);
    setScenarios(updated);
  };

  const handlePrint = () => window.print();

  // Quote: save
  const handleSaveQuote = async (label: string) => {
    setIsSavingQuote(true);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, inputs }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert((err as { error?: string }).error ?? 'Failed to save quote. Please try again.');
        return;
      }
      const data = await res.json() as { id: string };
      setSavedQuoteId(data.id);
      setShowQuoteSaveModal(false);
    } catch {
      alert('Network error saving quote. Please check your connection.');
    } finally {
      setIsSavingQuote(false);
    }
  };

  // Quote: load
  const handleLoadQuote = async () => {
    const id = loadQuoteId.trim().toUpperCase();
    if (!id) return;
    setIsLoadingQuote(true);
    setLoadQuoteError('');
    try {
      const res = await fetch(`/api/quotes/${id}`);
      if (res.status === 404) {
        setLoadQuoteError('Quote not found or expired. Check the ID and try again.');
        return;
      }
      if (!res.ok) {
        setLoadQuoteError('Error loading quote. Please try again.');
        return;
      }
      const data = await res.json() as { inputs: LeaseInputs; label: string; createdAt: string; expiresAt: string };
      setInputs(data.inputs);
      setRawInputs(inputsToRaw(data.inputs));
      setAprInput(convertMFtoAPR(data.inputs.moneyFactor).toFixed(2));
      setLoadedQuoteMeta({ label: data.label, createdAt: data.createdAt, expiresAt: data.expiresAt });
      setShowLoadQuote(false);
      setLoadQuoteId('');
    } catch {
      setLoadQuoteError('Network error. Please check your connection.');
    } finally {
      setIsLoadingQuote(false);
    }
  };

  const actualMiles = parseFloat(rawActualMiles);
  const safeActualMiles = isFinite(actualMiles) && actualMiles >= 0 ? actualMiles : 0;
  const mileageOverage = calculateMileageOverage(
    safeActualMiles,
    inputs.annualMileage,
    inputs.termMonths,
    inputs.overageCostPerMile
  );

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors`}>
      {/* Quote Save Modal */}
      {showQuoteSaveModal && (
        <QuoteSaveModal
          onSave={handleSaveQuote}
          onClose={() => setShowQuoteSaveModal(false)}
          isSaving={isSavingQuote}
        />
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🚗 Car Lease Calculator
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Real-time lease analysis & comparison</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareURL}
              className="px-3 py-1.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-700"
            >
              {urlCopied ? '✅ Copied!' : '🔗 Share URL'}
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
            >
              🖨️ Print
            </button>
            <button
              onClick={() => setDark(d => !d)}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
            >
              {dark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Loaded quote banner */}
        {loadedQuoteMeta && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                📋 Quote loaded: {loadedQuoteMeta.label}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400">
                Saved {new Date(loadedQuoteMeta.createdAt).toLocaleDateString()} · Expires {new Date(loadedQuoteMeta.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <button onClick={() => setLoadedQuoteMeta(null)} className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 ml-4">✕</button>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ─── Left Panel: Inputs ─── */}
          <div className="xl:col-span-1 space-y-4">
            {/* Vehicle Details */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <SectionHeader title="Vehicle Details" icon="🚗" />
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="MSRP"
                  value={rawInputs.msrp}
                  onChange={handleRaw('msrp')}
                  prefix="$"
                  tooltip="Manufacturer's Suggested Retail Price — the sticker price before any negotiation."
                />
                <InputField
                  label="Sale Price"
                  value={rawInputs.salePrice}
                  onChange={handleRaw('salePrice')}
                  prefix="$"
                  tooltip="Your negotiated price. Lower is better — this becomes your cap cost."
                />
                <InputField
                  label="Down Payment"
                  value={rawInputs.downPayment}
                  onChange={handleRaw('downPayment')}
                  prefix="$"
                  tooltip="Cap cost reduction paid upfront. Reduces monthly payment but is not refundable if the car is totaled."
                />
                <InputField
                  label="Trade-In Value"
                  value={rawInputs.tradeIn}
                  onChange={handleRaw('tradeIn')}
                  prefix="$"
                  tooltip="Value of your current vehicle applied to reduce the cap cost."
                />
              </div>
            </div>

            {/* Lease Terms */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <SectionHeader title="Lease Terms" icon="📋" />
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                    Term
                    <Tooltip text="The length of your lease in months. Common terms are 24, 36, 39, or 48 months." />
                  </label>
                  <select
                    value={inputs.termMonths}
                    onChange={(e) => updateInput('termMonths', parseInt(e.target.value))}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[24, 36, 39, 48, 60].map(t => (
                      <option key={t} value={t}>{t} months</option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="Residual %"
                  value={rawInputs.residualPercent}
                  onChange={handleRaw('residualPercent')}
                  suffix="%"
                  tooltip="The percentage of MSRP the car is worth at lease end. Higher = lower payment. Set by the manufacturer."
                />
              </div>

              {/* Money Factor / APR */}
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-100 dark:border-blue-900">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">
                  💱 Money Factor ↔ APR Converter
                  <Tooltip text="Money Factor is the lease equivalent of an interest rate. Multiply by 2400 to get the approximate APR." />
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <InputField
                    label="Money Factor"
                    value={rawInputs.moneyFactor}
                    onChange={(v) => {
                      handleRaw('moneyFactor')(v);
                      const mf = parseFloat(v);
                      if (isFinite(mf) && mf >= 0) {
                        setAprInput(convertMFtoAPR(mf).toFixed(2));
                      }
                    }}
                    tooltip="Lease rate expressed as a decimal (e.g. 0.00125 = 3% APR). Multiply by 2400 to compare to loan APR."
                  />
                  <InputField
                    label="≈ APR"
                    value={aprInput}
                    onChange={(v) => {
                      setAprInput(v);
                      const apr = parseFloat(v);
                      if (isFinite(apr) && apr >= 0) {
                        const mf = convertAPRtoMF(apr);
                        updateInput('moneyFactor', mf);
                        setRawInputs(prev => ({ ...prev, moneyFactor: String(mf) }));
                      }
                    }}
                    suffix="%"
                    tooltip="Approximate APR equivalent. Enter APR here to auto-fill the money factor."
                  />
                </div>
              </div>
            </div>

            {/* Fees & Taxes */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <SectionHeader title="Fees & Taxes" icon="💰" />
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="Acquisition Fee"
                  value={rawInputs.acquisitionFee}
                  onChange={handleRaw('acquisitionFee')}
                  prefix="$"
                  tooltip="Bank fee for originating the lease. Typically $500–$1,200. Often rolled into the cap cost."
                />
                <InputField
                  label="Disposition Fee"
                  value={rawInputs.dispositionFee}
                  onChange={handleRaw('dispositionFee')}
                  prefix="$"
                  tooltip="Fee charged at lease end if you don't buy the car or lease another from the same brand. Typically $300–$500."
                />
                <InputField
                  label="Reg/Doc Fees"
                  value={rawInputs.registrationFees}
                  onChange={handleRaw('registrationFees')}
                  prefix="$"
                  tooltip="Registration, title, and documentation fees paid at lease signing."
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                    State
                    <Tooltip text="Select your state to auto-fill the base sales tax rate and tax method." />
                  </label>
                  <select
                    onChange={(e) => {
                      const preset = STATE_TAX_PRESETS.find(s => s.code === e.target.value);
                      if (preset) {
                        updateInput('salesTaxRate', preset.rate);
                        updateInput('taxOnFullCapCost', preset.taxMethod === 'full_cap_cost');
                        setRawInputs(prev => ({ ...prev, salesTaxRate: String(preset.rate) }));
                      }
                    }}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select state...</option>
                    {STATE_TAX_PRESETS.map(s => (
                      <option key={s.code} value={s.code}>{s.state} ({s.rate}%)</option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="Sales Tax Rate"
                  value={rawInputs.salesTaxRate}
                  onChange={handleRaw('salesTaxRate')}
                  suffix="%"
                  tooltip="Local sales tax rate. Can vary from state base rate by county/city."
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                    Tax Method
                    <Tooltip text="Most states tax only the monthly lease payment. A few (CT, PA) tax the full cap cost upfront." />
                  </label>
                  <select
                    value={inputs.taxOnFullCapCost ? 'full' : 'monthly'}
                    onChange={(e) => updateInput('taxOnFullCapCost', e.target.value === 'full')}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly">Tax on monthly payment</option>
                    <option value="full">Tax on full cap cost</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Advanced Options */}
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <SectionHeader title="Advanced Options" icon="⚙️" />
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  label="MSD Count"
                  value={rawInputs.msdCount}
                  onChange={handleRaw('msdCount')}
                  inputMode="numeric"
                  tooltip="Multiple Security Deposits: each deposit reduces your money factor by ~0.00007. Refundable at lease end. Max varies by lender."
                />
                <InputField
                  label="GAP Insurance"
                  value={rawInputs.gapInsuranceMonthly}
                  onChange={handleRaw('gapInsuranceMonthly')}
                  prefix="$"
                  suffix="/mo"
                  tooltip="Guaranteed Asset Protection covers the gap between insurance payout and remaining lease balance if the car is totaled."
                />
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                    Annual Mileage
                    <Tooltip text="Miles per year included in your lease. Exceeding this incurs per-mile fees at lease end." />
                  </label>
                  <select
                    value={inputs.annualMileage}
                    onChange={(e) => updateInput('annualMileage', parseInt(e.target.value))}
                    className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {[7500, 10000, 12000, 15000, 20000].map(m => (
                      <option key={m} value={m}>{m.toLocaleString()} mi/yr</option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="Overage Cost"
                  value={rawInputs.overageCostPerMile}
                  onChange={handleRaw('overageCostPerMile')}
                  suffix="¢/mi"
                  tooltip="Per-mile fee for driving over your annual mileage limit. Typically 10–30 cents per mile."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 no-print">
              <button
                onClick={handleReset}
                className="flex-1 py-2 px-4 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium border border-gray-200 dark:border-gray-700"
              >
                🔄 Reset
              </button>
            </div>
          </div>

          {/* ─── Right Panel: Results ─── */}
          <div className="xl:col-span-2 space-y-4">
            {results && (
              <>
                {/* Monthly Payment Summary */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-xl p-6 text-white">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <p className="text-blue-200 text-sm font-medium">Monthly Payment</p>
                      <p className="text-5xl font-bold font-mono mt-1">
                        {formatCurrency(results.monthlyPayment)}
                      </p>
                      <p className="text-blue-200 text-xs mt-1">
                        {inputs.termMonths} months · {formatCurrency(results.adjustedCapCost)} cap cost · {formatPercent(inputs.residualPercent)} residual
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-blue-200 text-xs">Effective APR</div>
                      <div className="text-2xl font-bold">{convertMFtoAPR(results.effectiveMoneyFactor).toFixed(2)}%</div>
                      {inputs.msdCount > 0 && (
                        <div className="text-blue-200 text-xs">
                          MF reduced by {inputs.msdCount} MSDs
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Payment Breakdown + Chart */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <SectionHeader title="Payment Breakdown" icon="📊" />
                    <ResultRow label="Cap Cost" value={formatCurrency(results.adjustedCapCost)} tooltip="Adjusted capitalized cost = Sale Price + Acq Fee - Down - Trade-In" />
                    <ResultRow label="Residual Value" value={formatCurrency(results.residualValue)} />
                    <ResultRow label="Depreciation / mo" value={formatCurrency(results.monthlyDepreciation)} tooltip="(Cap Cost - Residual) ÷ Term months" />
                    <ResultRow label="Finance Charge / mo" value={formatCurrency(results.monthlyFinanceCharge)} tooltip="(Cap Cost + Residual) × Money Factor" />
                    <ResultRow label="Tax / mo" value={formatCurrency(results.monthlyTax)} />
                    {inputs.gapInsuranceMonthly > 0 && (
                      <ResultRow label="GAP Insurance / mo" value={formatCurrency(inputs.gapInsuranceMonthly)} />
                    )}
                    <ResultRow label="Monthly Payment" value={formatCurrency(results.monthlyPayment)} highlight />
                  </div>

                  <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <SectionHeader title="Payment Composition" icon="🥧" />
                    <PaymentChart
                      depreciation={results.monthlyDepreciation}
                      financeCharge={results.monthlyFinanceCharge}
                      tax={results.monthlyTax}
                      gap={inputs.gapInsuranceMonthly}
                    />
                  </div>
                </div>

                {/* Cost Summary */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <SectionHeader title="Total Cost Summary" icon="💵" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Drive-Off Total</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(results.driveOffCosts.total)}</p>
                      <p className="text-xs text-gray-500 mt-1">Due at signing</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Payments</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(results.totalPayments)}</p>
                      <p className="text-xs text-gray-500 mt-1">{inputs.termMonths} months</p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Total Lease Cost</p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">{formatCurrency(results.totalLeaseCost)}</p>
                      <p className="text-xs text-gray-500 mt-1">All-in cost</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-900">
                      <p className="text-xs text-blue-600 dark:text-blue-400">Effective Monthly</p>
                      <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(results.effectiveMonthlyCost)}</p>
                      <p className="text-xs text-blue-500 mt-1">Incl. opportunity cost</p>
                    </div>
                  </div>
                </div>

                {/* Drive-Off Breakdown */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <SectionHeader title="Drive-Off Costs (Due at Signing)" icon="🔑" />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-gray-600 dark:text-gray-400">1st Month Payment</span>
                      <span className="font-mono">{formatCurrency(results.driveOffCosts.firstMonthPayment)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-gray-600 dark:text-gray-400">Down Payment</span>
                      <span className="font-mono">{formatCurrency(results.driveOffCosts.downPayment)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-gray-600 dark:text-gray-400">Acquisition Fee</span>
                      <span className="font-mono">{formatCurrency(results.driveOffCosts.acquisitionFee)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <span className="text-gray-600 dark:text-gray-400">Reg/Doc Fees</span>
                      <span className="font-mono">{formatCurrency(results.driveOffCosts.registrationFees)}</span>
                    </div>
                    {results.driveOffCosts.msdTotal > 0 && (
                      <div className="flex justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <span className="text-green-700 dark:text-green-400">MSDs (refundable)</span>
                        <span className="font-mono text-green-700 dark:text-green-400">{formatCurrency(results.driveOffCosts.msdTotal)}</span>
                      </div>
                    )}
                    {results.driveOffCosts.upfrontTax > 0 && (
                      <div className="flex justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <span className="text-gray-600 dark:text-gray-400">Upfront Tax</span>
                        <span className="font-mono">{formatCurrency(results.driveOffCosts.upfrontTax)}</span>
                      </div>
                    )}
                    <div className="flex justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-900 col-span-2 md:col-span-1">
                      <span className="text-blue-700 dark:text-blue-300 font-semibold">Total Drive-Off</span>
                      <span className="font-mono font-bold text-blue-700 dark:text-blue-300">{formatCurrency(results.driveOffCosts.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Quote Save / Load — no-print */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 no-print">
                  <div className="flex justify-between items-center mb-3">
                    <SectionHeader title="Save &amp; Share Quote" icon="📤" />
                    <button
                      onClick={() => setShowLoadQuote(s => !s)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showLoadQuote ? 'Hide' : 'Load'} quote
                    </button>
                  </div>

                  <button
                    onClick={() => { setSavedQuoteId(null); setShowQuoteSaveModal(true); }}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors mb-3"
                  >
                    💾 Save this quote
                  </button>

                  {savedQuoteId && (
                    <QuoteSuccessPanel quoteId={savedQuoteId} onClose={() => setSavedQuoteId(null)} />
                  )}

                  {showLoadQuote && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Load a saved quote by ID</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Enter Quote ID (e.g. LZ4K9RMX)"
                          value={loadQuoteId}
                          onChange={e => { setLoadQuoteId(e.target.value.toUpperCase().slice(0, 8)); setLoadQuoteError(''); }}
                          onKeyDown={e => { if (e.key === 'Enter') handleLoadQuote(); }}
                          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest uppercase"
                          maxLength={8}
                        />
                        <button
                          onClick={handleLoadQuote}
                          disabled={isLoadingQuote || loadQuoteId.length < 8}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {isLoadingQuote ? '…' : 'Load'}
                        </button>
                      </div>
                      {loadQuoteError && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">{loadQuoteError}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Mileage Overage Calculator */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                  <SectionHeader title="Mileage Overage Calculator" icon="🛣️" />
                  <div className="flex flex-wrap gap-4 items-end">
                    <InputField
                      label="Your actual miles/year"
                      value={rawActualMiles}
                      onChange={setRawActualMiles}
                      inputMode="numeric"
                      className="flex-1 min-w-40"
                    />
                    <div className="flex-1 min-w-40 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Overage Cost at Lease End</p>
                      <p className={`text-2xl font-bold font-mono mt-1 ${mileageOverage > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                        {mileageOverage > 0 ? formatCurrency(mileageOverage) : 'No overage ✓'}
                      </p>
                      {mileageOverage > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          Over by {((safeActualMiles - inputs.annualMileage) * (inputs.termMonths / 12)).toLocaleString()} miles
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lease vs Buy Comparison */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 no-print">
                  <div className="flex justify-between items-center mb-3">
                    <SectionHeader title="Lease vs Buy vs PCP" icon="⚖️" />
                    <button
                      onClick={() => {
                        setShowComparison(s => !s);
                        if (!showComparison) {
                          const loanAPR = parseFloat(rawLoanAPR);
                          const pcpAPR = parseFloat(rawPcpAPR);
                          if (isFinite(loanAPR) && isFinite(pcpAPR)) {
                            setComparison(compareLeaseVsBuy(inputs, loanAPR, pcpAPR));
                          }
                        }
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showComparison ? 'Hide' : 'Show'} comparison
                    </button>
                  </div>

                  {showComparison && (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <InputField
                          label="Loan APR (Buy)"
                          value={rawLoanAPR}
                          onChange={setRawLoanAPR}
                          suffix="%"
                          tooltip="Interest rate for a conventional auto loan to purchase the vehicle."
                        />
                        <InputField
                          label="PCP APR"
                          value={rawPcpAPR}
                          onChange={setRawPcpAPR}
                          suffix="%"
                          tooltip="Personal Contract Purchase rate — financing only the depreciation portion with a balloon payment at the end."
                        />
                      </div>

                      {comparison && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">Metric</th>
                                <th className="text-right py-2 text-blue-600 dark:text-blue-400 font-medium">Lease</th>
                                <th className="text-right py-2 text-green-600 dark:text-green-400 font-medium">Buy</th>
                                <th className="text-right py-2 text-purple-600 dark:text-purple-400 font-medium">PCP</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 text-gray-600 dark:text-gray-400">Monthly Payment</td>
                                <td className="py-2 text-right font-mono text-blue-700 dark:text-blue-300">{formatCurrency(comparison.lease.monthlyPayment)}</td>
                                <td className="py-2 text-right font-mono text-green-700 dark:text-green-300">{formatCurrency(comparison.buy.monthlyPayment)}</td>
                                <td className="py-2 text-right font-mono text-purple-700 dark:text-purple-300">{formatCurrency(comparison.pcp.monthlyPayment)}</td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 text-gray-600 dark:text-gray-400">Total Cost</td>
                                <td className="py-2 text-right font-mono text-blue-700 dark:text-blue-300">{formatCurrency(comparison.lease.totalCost)}</td>
                                <td className="py-2 text-right font-mono text-green-700 dark:text-green-300">{formatCurrency(comparison.buy.totalCost)}</td>
                                <td className="py-2 text-right font-mono text-purple-700 dark:text-purple-300">{formatCurrency(comparison.pcp.totalCost)}</td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-800">
                                <td className="py-2 text-gray-600 dark:text-gray-400">Equity / Residual</td>
                                <td className="py-2 text-right font-mono text-blue-700 dark:text-blue-300">{formatCurrency(comparison.lease.residualEquity)} (none)</td>
                                <td className="py-2 text-right font-mono text-green-700 dark:text-green-300">{formatCurrency(comparison.buy.equity)}</td>
                                <td className="py-2 text-right font-mono text-purple-700 dark:text-purple-300">{formatCurrency(comparison.pcp.balloonPayment)} balloon</td>
                              </tr>
                            </tbody>
                          </table>
                          {comparison.breakEvenMonths !== null && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                              ⚡ Break-even: Lease becomes cheaper than buying after approximately {comparison.breakEvenMonths} months.
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Amortization Schedule */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 no-print">
                  <div className="flex justify-between items-center mb-3">
                    <SectionHeader title="Amortization Schedule" icon="📅" />
                    <button
                      onClick={() => setShowAmortization(s => !s)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showAmortization ? 'Hide' : 'Show'} schedule
                    </button>
                  </div>

                  {showAmortization && amortization.length > 0 && (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white dark:bg-gray-900">
                          <tr className="border-b border-gray-200 dark:border-gray-700">
                            <th className="py-2 text-left text-gray-500">Mo</th>
                            <th className="py-2 text-right text-gray-500">Balance</th>
                            <th className="py-2 text-right text-gray-500">Depreciation</th>
                            <th className="py-2 text-right text-gray-500">Finance</th>
                            <th className="py-2 text-right text-gray-500">Tax</th>
                            <th className="py-2 text-right text-gray-500">Payment</th>
                            <th className="py-2 text-right text-gray-500">End Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amortization.map((row) => (
                            <tr key={row.month} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="py-1.5 text-gray-600 dark:text-gray-400">{row.month}</td>
                              <td className="py-1.5 text-right font-mono">{formatCurrency(row.startingBalance)}</td>
                              <td className="py-1.5 text-right font-mono text-orange-600 dark:text-orange-400">{formatCurrency(row.depreciation)}</td>
                              <td className="py-1.5 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(row.financeCharge)}</td>
                              <td className="py-1.5 text-right font-mono text-gray-600 dark:text-gray-400">{formatCurrency(row.tax)}</td>
                              <td className="py-1.5 text-right font-mono font-semibold">{formatCurrency(row.totalPayment)}</td>
                              <td className="py-1.5 text-right font-mono text-gray-500">{formatCurrency(row.endingBalance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Scenario Manager */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 no-print">
                  <div className="flex justify-between items-center mb-3">
                    <SectionHeader title="Saved Scenarios" icon="💾" />
                    <button
                      onClick={() => setShowScenarios(s => !s)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {showScenarios ? 'Hide' : 'Show'} scenarios ({scenarios.length}/3)
                    </button>
                  </div>

                  {showScenarios && (
                    <>
                      <div className="flex gap-2 mb-3">
                        <input
                          type="text"
                          placeholder="Scenario name (e.g. BMW 3 Series)"
                          value={scenarioName}
                          onChange={(e) => setScenarioName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveScenario()}
                          className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={handleSaveScenario}
                          disabled={scenarios.length >= 3 || !scenarioName.trim()}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Save
                        </button>
                      </div>

                      {scenarios.length > 0 && (
                        <div className="space-y-2">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700">
                                  <th className="text-left py-2 text-gray-500 font-medium">Name</th>
                                  <th className="text-right py-2 text-gray-500 font-medium">MSRP</th>
                                  <th className="text-right py-2 text-gray-500 font-medium">Monthly</th>
                                  <th className="text-right py-2 text-gray-500 font-medium">MF</th>
                                  <th className="text-right py-2 text-gray-500 font-medium">Term</th>
                                  <th className="py-2"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {scenarios.map((sc) => {
                                  const scResults = calculateLease(sc.inputs);
                                  return (
                                    <tr key={sc.id} className="border-b border-gray-100 dark:border-gray-800">
                                      <td className="py-2 font-medium">{sc.name}</td>
                                      <td className="py-2 text-right font-mono text-xs">{formatCurrency(sc.inputs.msrp)}</td>
                                      <td className="py-2 text-right font-mono text-blue-600 dark:text-blue-400">{formatCurrency(scResults.monthlyPayment)}</td>
                                      <td className="py-2 text-right font-mono text-xs">{sc.inputs.moneyFactor.toFixed(5)}</td>
                                      <td className="py-2 text-right text-xs">{sc.inputs.termMonths}mo</td>
                                      <td className="py-2 flex gap-1 justify-end">
                                        <button
                                          onClick={() => handleLoadScenario(sc)}
                                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                        >
                                          Load
                                        </button>
                                        <button
                                          onClick={() => handleDeleteScenario(sc.id)}
                                          className="text-xs text-red-500 dark:text-red-400 hover:underline ml-1"
                                        >
                                          Del
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {scenarios.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                          Save up to 3 scenarios to compare side by side
                        </p>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 py-4 border-t border-gray-200 dark:border-gray-800 text-center text-xs text-gray-400 dark:text-gray-600 no-print">
        <p>Car Lease Calculator · All calculations are estimates. Consult your dealer for exact figures.</p>
        <p className="mt-1">Monthly payment formula: M = Depreciation + Finance Charge + Tax</p>
      </footer>
    </div>
  );
}
