/**
 * Scenario persistence via localStorage.
 * Allows saving up to 3 named scenarios and comparing them side by side.
 */
import type { LeaseInputs } from './lease-calculator';

export interface SavedScenario {
  id: string;
  name: string;
  savedAt: string;
  inputs: LeaseInputs;
}

const STORAGE_KEY = 'car-lease-calculator-scenarios';
const MAX_SCENARIOS = 3;

export function loadScenarios(): SavedScenario[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedScenario[];
  } catch {
    return [];
  }
}

export function saveScenario(
  name: string,
  inputs: LeaseInputs
): SavedScenario[] {
  const scenarios = loadScenarios();
  const newScenario: SavedScenario = {
    id: Date.now().toString(),
    name,
    savedAt: new Date().toISOString(),
    inputs,
  };

  const updated = [newScenario, ...scenarios].slice(0, MAX_SCENARIOS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteScenario(id: string): SavedScenario[] {
  const scenarios = loadScenarios().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  return scenarios;
}

export function clearScenarios(): void {
  localStorage.removeItem(STORAGE_KEY);
}
