import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import { MEMBER_BANK_ACCOUNTS } from "./bankAccounts";

export function usesWalletBranding(accountId, isAdmin) {
  return !isAdmin && accountId === "checking";
}

export function getAccountLogoMeta(accountId, isAdmin) {
  if (usesWalletBranding(accountId, isAdmin)) {
    return { logoSrc: DOLLARADAY_LOGO_URL, logoAlt: "My Dollar A Day", isBrandLogo: true };
  }

  const meta = MEMBER_BANK_ACCOUNTS[accountId];
  if (!meta) return null;
  return { logoSrc: meta.logoSrc, logoAlt: meta.logoAlt, isBrandLogo: false };
}

export function getAccountDisplay(accountId, isAdmin, t) {
  if (usesWalletBranding(accountId, isAdmin)) {
    return {
      title: t("pages.wallet.accountTitle"),
      type: t("pages.wallet.accountType"),
      bank: t("pages.wallet.accountProvider"),
      overviewLabel: t("pages.wallet.overviewLabel"),
    };
  }

  const meta = MEMBER_BANK_ACCOUNTS[accountId];
  if (!meta) return null;

  return {
    title: t(`pages.accounts.${meta.labelKey}`),
    type: t(`pages.accounts.${meta.typeKey}`),
    bank: t(`pages.accounts.${meta.bankKey}`),
    overviewLabel: t(
      `pages.accounts.${accountId === "checking" ? "overviewChecking" : "overviewEscrow"}`,
    ),
  };
}
