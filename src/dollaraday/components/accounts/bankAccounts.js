/** Member-linked bank accounts — logos sourced from official bank sites. */
export const MEMBER_BANK_ACCOUNTS = {
  checking: {
    id: "checking",
    labelKey: "checkingTab",
    typeKey: "checkingType",
    bankKey: "checkingBank",
    logoSrc: "/banks/bank-of-america-icon.svg",
    logoAlt: "Bank of America",
    accent: "var(--color-dda-green-light)",
  },
  escrow: {
    id: "escrow",
    labelKey: "escrowTab",
    typeKey: "escrowType",
    bankKey: "escrowBank",
    logoSrc: "/banks/chase-icon.svg",
    logoAlt: "Chase",
    accent: "#38bdf8",
  },
};

export const MEMBER_BANK_ACCOUNT_LIST = Object.values(MEMBER_BANK_ACCOUNTS);

export function getVisibleBankAccounts(includeEscrow = true) {
  if (includeEscrow) return MEMBER_BANK_ACCOUNT_LIST;
  return MEMBER_BANK_ACCOUNT_LIST.filter((account) => account.id !== "escrow");
}
