import type { MemberAccountTransaction } from "./memberAccounts";
import {
  easternDateAt,
  easternNow,
  formatEasternIsoDate,
  formatEasternMonthDay,
  formatEasternMonthShort,
  formatEasternNowLabel,
  formatEasternTimeWithZone,
  formatEasternTodayLabel,
  formatEasternWeekdayShort,
  getEasternYmd,
  subtractDays,
  type DdaLocale,
} from "./dateTime";
import { getAllocationYieldLogEntries } from "./allocationYieldLog";
import { readDataBin, subscribeInternalDatabase } from "./internalDatabase";

const MEMBER_ACCOUNTS_PREFIX = "member-accounts-";

export type PoolBalanceEventKind =
  | "escrow_in"
  | "escrow_out"
  | "allocation"
  | "contribution"
  | "yield";

export interface PoolBalanceEvent {
  id: string;
  occurredAt: string;
  amount: number;
  balanceDelta: number;
  kind: PoolBalanceEventKind;
  label: string;
}

export interface PoolBalanceChartEvent {
  id: string;
  kind: PoolBalanceEventKind;
  amount: number;
  label: string;
}

export interface PoolBalanceChartPoint {
  label: string;
  balance: number;
  iso: string;
  events: PoolBalanceChartEvent[];
}

interface ChartBucket {
  label: string;
  endIso: string;
}

function formatEasternHourLabel(hour: number, locale: DdaLocale = "en"): string {
  const { year, month, day } = getEasternYmd(easternNow());
  return formatEasternTimeWithZone(easternDateAt(year, month, day, hour), locale);
}

function collectMemberEscrowEvents(): PoolBalanceEvent[] {
  const events: PoolBalanceEvent[] = [];

  readDataBin("settings")
    .records.filter((record) => record.id.startsWith(MEMBER_ACCOUNTS_PREFIX))
    .forEach((record) => {
      const transactions = Array.isArray(record.payload?.transactions)
        ? (record.payload.transactions as MemberAccountTransaction[])
        : [];

      transactions.forEach((transaction) => {
        if (transaction.accountId !== "escrow" || !transaction.createdAt) return;
        const amount = Number(transaction.amount);
        if (!Number.isFinite(amount) || amount <= 0) return;

        const memo = transaction.memo?.trim() || "";

        if (transaction.direction === "credit") {
          events.push({
            id: transaction.id,
            occurredAt: transaction.createdAt,
            amount,
            balanceDelta: amount,
            kind: "escrow_in",
            label:
              memo ||
              (transaction.type === "transfer" ? "Transfer to escrow" : "Escrow deposit"),
          });
          return;
        }

        if (transaction.type === "transfer") {
          events.push({
            id: transaction.id,
            occurredAt: transaction.createdAt,
            amount,
            balanceDelta: -amount,
            kind: "escrow_out",
            label: memo || "Transfer from escrow",
          });
          return;
        }

        if (transaction.type === "spend") {
          events.push({
            id: transaction.id,
            occurredAt: transaction.createdAt,
            amount,
            balanceDelta: 0,
            kind: "allocation",
            label: memo || "Pool allocation",
          });
        }
      });
    });

  return events;
}

function collectYieldEvents(): PoolBalanceEvent[] {
  return getAllocationYieldLogEntries(400).flatMap((entry) => {
    if (!entry.createdAt || !Number.isFinite(entry.amount) || entry.amount === 0) return [];

    const sign = entry.amount >= 0 ? "+" : "";
    return [
      {
        id: entry.id,
        occurredAt: entry.createdAt,
        amount: Math.abs(entry.amount),
        balanceDelta: entry.amount,
        kind: "yield" as const,
        label: `${entry.contractLabel} · ${sign}${entry.returnPct.toFixed(3)}% daily`,
      },
    ];
  });
}

export function collectPoolBalanceEvents(): PoolBalanceEvent[] {
  return [...collectMemberEscrowEvents(), ...collectYieldEvents()]
    .filter((event) => event.occurredAt)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
}

function buildChartBuckets(interval: string, locale: DdaLocale): ChartBucket[] {
  const now = easternNow();
  const { year, month, day } = getEasternYmd(now);

  if (interval === "1d") {
    return Array.from({ length: 13 }, (_, index) => {
      const hour = index * 2;
      const bucketEnd = easternDateAt(year, month, day, Math.min(hour, 23), 59);
      return {
        label:
          index === 12 ? formatEasternNowLabel(locale) : formatEasternHourLabel(hour, locale),
        endIso: bucketEnd.toISOString(),
      };
    });
  }

  if (interval === "1w") {
    return Array.from({ length: 7 }, (_, index) => {
      const offset = 6 - index;
      const date = subtractDays(now, offset);
      const { year: y, month: m, day: d } = getEasternYmd(date);
      return {
        label:
          offset === 0
            ? formatEasternTodayLabel(locale)
            : formatEasternWeekdayShort(date, locale),
        endIso: easternDateAt(y, m, d, 23, 59).toISOString(),
      };
    });
  }

  if (interval === "1m") {
    return Array.from({ length: 11 }, (_, index) => {
      const offset = 10 - index;
      const date = subtractDays(now, offset * 3);
      return {
        label:
          offset === 0
            ? formatEasternMonthDay(now, locale)
            : formatEasternMonthDay(date, locale),
        endIso: easternDateAt(
          getEasternYmd(date).year,
          getEasternYmd(date).month,
          getEasternYmd(date).day,
          23,
          59,
        ).toISOString(),
      };
    });
  }

  return Array.from({ length: 12 }, (_, index) => {
    const monthOffset = 11 - index;
    const date = new Date(year, month - 1 - monthOffset, 1);
    const { year: y, month: m } = getEasternYmd(date);
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return {
      label: formatEasternMonthShort(date, locale),
      endIso: easternDateAt(y, m, lastDay, 23, 59).toISOString(),
    };
  });
}

function fallbackSeries(currentBalance: number, locale: DdaLocale): PoolBalanceChartPoint[] {
  const now = easternNow();
  return [
    {
      label: formatEasternMonthDay(subtractDays(now, 30), locale),
      balance: 0,
      iso: subtractDays(now, 30).toISOString(),
      events: [],
    },
    {
      label: formatEasternNowLabel(locale),
      balance: currentBalance,
      iso: now.toISOString(),
      events: [],
    },
  ];
}

export function buildPoolBalanceChartSeries(
  interval: string,
  locale: DdaLocale,
  currentBalance: number,
): PoolBalanceChartPoint[] {
  const events = collectPoolBalanceEvents();
  const buckets = buildChartBuckets(interval, locale);

  if (!buckets.length) {
    return [{ label: formatEasternNowLabel(locale), balance: currentBalance, iso: easternNow().toISOString(), events: [] }];
  }

  if (!events.length) {
    if (currentBalance <= 0) {
      return buckets.map((bucket, index) => ({
        label: bucket.label,
        balance: 0,
        iso: bucket.endIso,
        events: [],
        ...(index === buckets.length - 1 ? { label: bucket.label } : {}),
      }));
    }
    return fallbackSeries(currentBalance, locale);
  }

  let running = 0;
  let eventIndex = 0;

  const points = buckets.map((bucket) => {
    const bucketEvents: PoolBalanceChartEvent[] = [];

    while (eventIndex < events.length && events[eventIndex].occurredAt <= bucket.endIso) {
      const event = events[eventIndex];
      running += event.balanceDelta;
      bucketEvents.push({
        id: event.id,
        kind: event.kind,
        amount: event.amount,
        label: event.label,
      });
      eventIndex += 1;
    }

    return {
      label: bucket.label,
      balance: Math.max(0, Math.round(running * 100) / 100),
      iso: bucket.endIso,
      events: bucketEvents,
    };
  });

  if (points.length) {
    points[points.length - 1] = {
      ...points[points.length - 1],
      balance: currentBalance,
    };
  }

  return points;
}

export function getPoolBalanceHistoryRevision(): string {
  const settings = readDataBin("settings");
  const eventCount = collectPoolBalanceEvents().length;
  return `${settings.updatedAt}|${eventCount}|${formatEasternIsoDate()}`;
}

export function subscribePoolBalanceHistory(listener: () => void): () => void {
  return subscribeInternalDatabase(listener);
}
