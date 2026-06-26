import { useMemo } from "react";
import {
  allocationComparisons,
  communityChannels,
  communityPosts,
  escrowLedger,
  featureCards,
  investmentFunnel,
  investmentHighlights,
  investments,
  loanEligibilityFactors,
  loans,
  poolBalanceIntervals,
  poolComposition,
} from "../data/mockData";
import { useLocale } from "./LocaleContext";
import { useEasternLiveTime } from "../context/EasternTimeContext";
import { formatRelativeTimeFromNow } from "../lib/dateTime";

const escrowKeys = ["e1", "e2", "e3", "e4"];
const loanPurposeKeys = ["purpose1", "purpose2", "purpose3"];
const factorKeys = ["factorStreak", "factorEquity", "factorStanding", "factorRepayment"];
const comparisonKeys = ["yesterday", "lastWeek", "lastMonth", "milestone"];
const highlightKeys = ["highlightDeployed", "highlightApy", "highlightIncome", "highlightSleeves"];
const highlightCaptions = ["captionLastMonth", "captionLastQuarter", "captionPayout", "captionBuckets"];
const postKeys = ["post1", "post2", "post3"];

export function useLocalizedData() {
  const { t, locale } = useLocale();
  const { longDate, relativeTick } = useEasternLiveTime();

  return useMemo(() => {
    const localizedPoolComposition = poolComposition.map((segment) => ({
      ...segment,
      name: t(`pool.${segment.key}`),
    }));

    const localizedInvestmentFunnel = investmentFunnel.map((item) => ({
      ...item,
      name: t(`investments.${item.key}.name`),
      description: t(`investments.${item.key}.desc`),
      riskKey: item.risk,
      liquidityKey: item.liquidity,
      risk: t(`risk.${item.risk}`),
      liquidity: t(`liquidity.${item.liquidity}`),
    }));

    const localizedInvestments = investments.map((item) => ({
      ...item,
      name: t(`investments.${item.key}.name`),
      description: t(`investments.${item.key}.desc`),
      category: t("pages.investments.fixedIncome"),
      riskKey: item.risk,
      liquidityKey: item.liquidity,
      risk: t(`risk.${item.risk}`),
      liquidity: t(`liquidity.${item.liquidity}`),
      status: t("status.active"),
    }));

    const localizedFeatureCards = featureCards.map((card) => ({
      ...card,
      title: t(`features.${card.id}.title`),
      desc: t(`features.${card.id}.desc`),
    }));

    const localizedChannels = communityChannels.map((channel) => ({
      ...channel,
      label: t(`channels.${channel.id}.label`),
      desc: t(`channels.${channel.id}.desc`),
    }));

    const localizedPosts = communityPosts.map((post, index) => ({
      ...post,
      body: t(`pages.community.${postKeys[index]}`),
    }));

    const localizedEscrow = escrowLedger.map((entry, index) => ({
      ...entry,
      label: t(`escrow.${escrowKeys[index]}`),
    }));

    const localizedLoans = loans.map((loan, index) => ({
      ...loan,
      purpose: t(`pages.loans.${loanPurposeKeys[index]}`),
    }));

    const localizedFactors = loanEligibilityFactors.map((factor, index) => ({
      ...factor,
      label: t(`pages.loans.${factorKeys[index]}`),
    }));

    const localizedComparisons = allocationComparisons.map((item, index) => ({
      ...item,
      label: t(`pages.allocations.${comparisonKeys[index]}`),
      caption: t(`pages.allocations.${comparisonKeys[index]}Caption`),
    }));

    const localizedHighlights = investmentHighlights.map((item, index) => ({
      ...item,
      label: t(`pages.investments.${highlightKeys[index]}`),
      caption: t(`pages.investments.${highlightCaptions[index]}`),
    }));

    const localizedIntervals = poolBalanceIntervals.map((interval) => ({
      ...interval,
      label: t(`pool.interval${interval.id}`),
    }));

    const dashboardStatsLabels = {
      escrow: t("stats.escrowBalance"),
      daily: t("stats.dailyContributions"),
      apy: t("stats.poolApy"),
    };

    const statHints = {
      escrow: t("stats.segregatedReserve"),
      daily: t("stats.memberInflowToday"),
      apy: t("stats.annualPoolYield"),
    };

    return {
      locale,
      poolComposition: localizedPoolComposition,
      investmentFunnel: localizedInvestmentFunnel,
      investments: localizedInvestments,
      featureCards: localizedFeatureCards,
      communityChannels: localizedChannels,
      communityPosts: localizedPosts,
      escrowLedger: localizedEscrow,
      loans: localizedLoans,
      loanEligibilityFactors: localizedFactors,
      allocationComparisons: localizedComparisons,
      investmentHighlights: localizedHighlights,
      poolBalanceIntervals: localizedIntervals,
      dashboardStatsLabels,
      statHints,
      allocationSummary: {
        dateLabel: longDate,
        lastUpdated: formatRelativeTimeFromNow(new Date(), t, locale),
      },
      translateTier: (tier) => t(`tier.${tier}`),
      translateStatus: (status) => t(`status.${status}`),
      translateRisk: (risk) => t(`risk.${risk}`),
      translateLiquidity: (liquidity) => t(`liquidity.${liquidity}`),
      translatePoolSegment: (key) => t(`pool.${key}`),
    };
  }, [t, locale, longDate, relativeTick]);
}
