import { useEffect, useState } from "react";
import { lazy, Suspense } from "react";
import { useDadAuth } from "../../context/DadAuthContext";
import { resolveMemberProfileId } from "../../lib/memberAccounts";
import { reconcileMemberEscrowFromContributions } from "../../lib/poolEscrowReconcile";
import { processRecurringCashflows } from "../../lib/recurringCashflow";
import PlatformEquityCard from "../home/PlatformEquityCard";

const AccountsOverviewInfographic = lazy(() => import("./AccountsOverviewInfographic"));
const AccountsLiquidityWidget = lazy(() => import("./AccountsLiquidityWidget"));
const AdminLiquidityTransferModal = lazy(() => import("./AdminLiquidityTransferModal"));
const RecurringCashflowPanel = lazy(() => import("./RecurringCashflowPanel"));
const WalletFundingTabs = lazy(() => import("./WalletFundingTabs"));
const RedemptionsCard = lazy(() => import("./RedemptionsCard"));
const WalletAccountOverlay = lazy(() => import("./WalletAccountOverlay"));

function PanelSlot({ className = "min-h-[120px]" }) {
  return <div className={`dda-glass animate-pulse rounded-2xl ${className}`} aria-hidden="true" />;
}

export default function AccountHubView({ onNavigate }) {
  const { isAdmin } = useDadAuth();
  const profileId = resolveMemberProfileId();
  const [walletOverlayOpen, setWalletOverlayOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferDirection, setTransferDirection] = useState("to-liquidity");

  useEffect(() => {
    // After paint — never block Accounts hub open with ledger rebuild.
    const idle = window.requestIdleCallback
      ? (cb) => window.requestIdleCallback(cb, { timeout: 4000 })
      : (cb) => window.setTimeout(cb, 1500);
    const cancel = window.cancelIdleCallback
      ? (id) => window.cancelIdleCallback(id)
      : (id) => window.clearTimeout(id);
    const id = idle(() => {
      reconcileMemberEscrowFromContributions();
      processRecurringCashflows();
    });
    return () => cancel(id);
  }, [profileId]);

  const openTransfer = (direction = "to-liquidity") => {
    setTransferDirection(direction);
    setTransferOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Same equity card as Home — keeps Donations / wallet totals in sync. */}
      <PlatformEquityCard
        wallet
        onClick={isAdmin ? undefined : () => setWalletOverlayOpen(true)}
        onTransferClick={isAdmin ? () => openTransfer("to-liquidity") : undefined}
      />

      {isAdmin ? (
        <Suspense fallback={<PanelSlot className="min-h-[160px]" />}>
          <AccountsLiquidityWidget
            onNavigate={onNavigate}
            onTransferClick={() => openTransfer("to-admin")}
          />
        </Suspense>
      ) : null}

      <Suspense fallback={<PanelSlot className="min-h-[200px]" />}>
        <AccountsOverviewInfographic />
      </Suspense>
      {isAdmin ? (
        <Suspense fallback={<PanelSlot />}>
          <RedemptionsCard />
        </Suspense>
      ) : null}
      <Suspense fallback={<PanelSlot className="min-h-[160px]" />}>
        <RecurringCashflowPanel />
      </Suspense>
      <Suspense fallback={<PanelSlot />}>
        <WalletFundingTabs />
      </Suspense>

      {!isAdmin && walletOverlayOpen ? (
        <Suspense fallback={null}>
          <WalletAccountOverlay
            open={walletOverlayOpen}
            accountId="checking"
            onClose={() => setWalletOverlayOpen(false)}
          />
        </Suspense>
      ) : null}

      {isAdmin && transferOpen ? (
        <Suspense fallback={null}>
          <AdminLiquidityTransferModal
            open={transferOpen}
            initialDirection={transferDirection}
            onClose={() => setTransferOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
