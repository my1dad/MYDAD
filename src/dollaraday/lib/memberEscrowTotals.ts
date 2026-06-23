import { readDataBin } from "./internalDatabase";

const MEMBER_ACCOUNTS_RECORD_PREFIX = "member-accounts-";

/** Sum escrow balances across all member account ledgers in settings. */
export function getTotalMemberEscrowBalance(): number {
  return readDataBin("settings").records
    .filter((record) => record.id.startsWith(MEMBER_ACCOUNTS_RECORD_PREFIX))
    .reduce((sum, record) => sum + (Number(record.payload?.escrowBalance) || 0), 0);
}
