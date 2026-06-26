import { roundYieldCurrency } from "./allocationInstruments";
import {
  getTrailingAnnualizedApy,
  getYtdCompoundReturnPct,
} from "./allocationYieldLog";
import { readDataBin } from "./internalDatabase";
import { setPoolApy, setPoolYtdGrowthFromYield, syncPoolCapitalFromLedger } from "./poolState";

const ALLOCATION_POSITIONS_ID = "allocation-positions";

interface StoredAllocationPosition {
  principal: number;
  annualYieldPct: number;
  matured: boolean;
  sleeveKey?: string;
}

function readActivePositions(): StoredAllocationPosition[] {
  const settings = readDataBin("settings");
  const record = settings.records.find((item) => item.id === ALLOCATION_POSITIONS_ID);
  const payload = record?.payload as { positions?: StoredAllocationPosition[] } | undefined;
  const positions = Array.isArray(payload?.positions) ? payload.positions : [];
  return positions.filter((position) => !position.matured);
}

export function getBlendedContractApy(): number {
  const active = readActivePositions().filter((position) => position.sleeveKey !== "stocks");
  if (!active.length) return 0;

  const totalPrincipal = active.reduce((sum, position) => sum + position.principal, 0);
  if (totalPrincipal <= 0) return 0;

  const weighted = active.reduce(
    (sum, position) => sum + position.principal * position.annualYieldPct,
    0,
  );

  return roundYieldCurrency(weighted / totalPrincipal);
}

export function getEffectivePoolApy(): number {
  const trailing = getTrailingAnnualizedApy(30);
  if (trailing != null && trailing > 0) return trailing;
  return getBlendedContractApy();
}

export function syncAllocationPoolMetrics(): void {
  const effectiveApy = getEffectivePoolApy();
  const ytdGrowth = getYtdCompoundReturnPct();
  setPoolApy(effectiveApy);
  setPoolYtdGrowthFromYield(ytdGrowth !== 0 ? ytdGrowth : effectiveApy);
  syncPoolCapitalFromLedger();
}
