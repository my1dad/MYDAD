export type AllocationSleeveKey = "treasury" | "bonds" | "stocks";
export type AllocationPayoutFrequency = "daily" | "monthly";

export interface AllocationContractTerm {
  id: string;
  labelKey: string;
  sleeveKey: AllocationSleeveKey;
  weeks: number;
  /** Stated annual yield for this contract term (percent). */
  annualYieldPct: number;
  referencePrice: number;
  payoutFrequency: AllocationPayoutFrequency;
}

export const TREASURY_CONTRACT_TERMS: AllocationContractTerm[] = [
  { id: "w4", labelKey: "contract4Week", sleeveKey: "treasury", weeks: 4, annualYieldPct: 3.69, referencePrice: 99.92, payoutFrequency: "daily" },
  { id: "w8", labelKey: "contract8Week", sleeveKey: "treasury", weeks: 8, annualYieldPct: 3.7, referencePrice: 99.84, payoutFrequency: "daily" },
  { id: "w13", labelKey: "contract13Week", sleeveKey: "treasury", weeks: 13, annualYieldPct: 3.78, referencePrice: 99.75, payoutFrequency: "daily" },
  { id: "w17", labelKey: "contract17Week", sleeveKey: "treasury", weeks: 17, annualYieldPct: 3.79, referencePrice: 99.68, payoutFrequency: "daily" },
  { id: "w26", labelKey: "contract26Week", sleeveKey: "treasury", weeks: 26, annualYieldPct: 3.82, referencePrice: 99.52, payoutFrequency: "daily" },
  { id: "w52", labelKey: "contract52Week", sleeveKey: "treasury", weeks: 52, annualYieldPct: 3.86, referencePrice: 98.95, payoutFrequency: "daily" },
];

export const BOND_CONTRACT_TERMS: AllocationContractTerm[] = [
  { id: "bond-mbs", labelKey: "contractAgencyMbs", sleeveKey: "bonds", weeks: 52, annualYieldPct: 4.8, referencePrice: 100, payoutFrequency: "daily" },
  { id: "bond-cmbs", labelKey: "contractCmbs", sleeveKey: "bonds", weeks: 52, annualYieldPct: 5.5, referencePrice: 100, payoutFrequency: "daily" },
  { id: "bond-abs", labelKey: "contractAbs", sleeveKey: "bonds", weeks: 52, annualYieldPct: 5.0, referencePrice: 100, payoutFrequency: "daily" },
];

export const ALLOCATION_CONTRACT_TERMS: AllocationContractTerm[] = [
  ...TREASURY_CONTRACT_TERMS,
  ...BOND_CONTRACT_TERMS,
];

const DAYS_PER_YEAR = 365;
const MONTHS_PER_YEAR = 12;

export function getContractTermsForSleeve(sleeveKey: AllocationSleeveKey): AllocationContractTerm[] {
  return ALLOCATION_CONTRACT_TERMS.filter((term) => term.sleeveKey === sleeveKey);
}

export function findAllocationContractTerm(contractId: string): AllocationContractTerm | undefined {
  return ALLOCATION_CONTRACT_TERMS.find((term) => term.id === contractId);
}

/** Daily yield fraction equivalent to the stated annual contract rate (ACT/365). */
export function getDailyYieldFraction(annualYieldPct: number): number {
  if (!Number.isFinite(annualYieldPct) || annualYieldPct <= 0) return 0;
  return annualYieldPct / 100 / DAYS_PER_YEAR;
}

/** Daily yield percent equivalent (annual rate ÷ 365). */
export function getDailyYieldPercent(annualYieldPct: number): number {
  return getDailyYieldFraction(annualYieldPct) * 100;
}

export function roundYieldCurrency(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function computeDailyYieldAmount(principal: number, annualYieldPct: number): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  return roundYieldCurrency(principal * getDailyYieldFraction(annualYieldPct));
}

/** Monthly coupon equivalent to the stated annual contract rate. */
export function computeMonthlyYieldAmount(principal: number, annualYieldPct: number): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  return roundYieldCurrency((principal * annualYieldPct) / 100 / MONTHS_PER_YEAR);
}

export function getMonthlyYieldPercent(annualYieldPct: number): number {
  if (!Number.isFinite(annualYieldPct) || annualYieldPct <= 0) return 0;
  return roundYieldCurrency(annualYieldPct / MONTHS_PER_YEAR);
}

export function getContractTermDays(term: AllocationContractTerm): number {
  return term.weeks * 7;
}

/** Total yield earned over the full contract term (ACT/365, matches daily accrual sum). */
export function computeTermYieldAmount(principal: number, term: AllocationContractTerm): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  const termDays = getContractTermDays(term);
  return roundYieldCurrency(principal * getDailyYieldFraction(term.annualYieldPct) * termDays);
}

/** Term yield as a percent of principal over the contract holding period. */
export function computeTermYieldPercent(term: AllocationContractTerm): number {
  const termDays = getContractTermDays(term);
  return roundYieldCurrency((term.annualYieldPct * termDays) / DAYS_PER_YEAR);
}
