import { getDailyYieldPercent, roundYieldCurrency } from "./allocationInstruments";

/** Deterministic 0–1 float from a string seed (stable across sessions). */
export function seededUnitRandom(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export interface SimulatedDailyReturn {
  /** Signed daily return as a percent of principal (e.g. 0.012 = +0.012%). */
  returnPct: number;
  /** Dollar P/L on principal for the day. */
  amount: number;
  /** Principal after compounding. */
  principalAfter: number;
  isGain: boolean;
}

/**
 * Simulate a single day's return for treasury / bond positions.
 * Centered on the contract's ACT/365 daily rate with realistic noise;
 * ~68% of days are gains, losses are smaller on average.
 */
export function simulateFixedIncomeDailyReturn(
  principal: number,
  annualYieldPct: number,
  positionId: string,
  dayYmd: string,
): SimulatedDailyReturn {
  if (!Number.isFinite(principal) || principal <= 0) {
    return { returnPct: 0, amount: 0, principalAfter: principal, isGain: true };
  }

  const expectedDailyPct = getDailyYieldPercent(annualYieldPct);
  const winRoll = seededUnitRandom(`${positionId}:${dayYmd}:win`);
  const magnitudeRoll = seededUnitRandom(`${positionId}:${dayYmd}:mag`);

  let returnPct: number;

  if (winRoll < 0.68) {
    // Gain day: 0.4×–2.8× expected, skewed toward modest wins
    const multiplier = 0.4 + magnitudeRoll * 2.4;
    returnPct = expectedDailyPct * multiplier;
  } else {
    // Loss day: 0.15×–1.25× expected (smaller than typical wins)
    const multiplier = 0.15 + magnitudeRoll * 1.1;
    returnPct = -expectedDailyPct * multiplier;
  }

  returnPct = roundYieldCurrency(returnPct * 10000) / 10000;
  const amount = roundYieldCurrency(principal * (returnPct / 100));
  const principalAfter = roundYieldCurrency(Math.max(0.01, principal + amount));

  return {
    returnPct,
    amount,
    principalAfter,
    isGain: amount >= 0,
  };
}
