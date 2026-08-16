import { useMemo, useState, useSyncExternalStore } from "react";
import { Banknote, Check, Gift, Loader2, X } from "lucide-react";
import {
  approveExternalPaymentRequest,
  denyExternalPaymentRequest,
  getPendingExternalPaymentRequests,
} from "../../lib/externalPaymentRequests";
import {
  denyMemberRedemptionRequest,
  fulfillMemberRedemptionRequest,
  getPendingMemberRedemptionRequests,
} from "../../lib/memberRedemptionRequests";
import {
  getDatabaseRevision,
  subscribeInternalDatabase,
} from "../../lib/internalDatabase";
import { useLocale } from "../../i18n/LocaleContext";
import { formatPoolCurrency } from "../../data/mockData";

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function AdminPaymentRequestsCard() {
  const { t } = useLocale();
  const dbRevision = useSyncExternalStore(
    subscribeInternalDatabase,
    getDatabaseRevision,
    () => 0,
  );
  const depositRequests = useMemo(() => {
    void dbRevision;
    return getPendingExternalPaymentRequests();
  }, [dbRevision]);
  const redemptionRequests = useMemo(() => {
    void dbRevision;
    return getPendingMemberRedemptionRequests();
  }, [dbRevision]);

  const pendingCount = depositRequests.length + redemptionRequests.length;

  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const handleApproveDeposit = async (requestId) => {
    setError("");
    setMessage("");
    const pending = depositRequests.find((item) => item.id === requestId);
    setBusyId(requestId);
    try {
      const result = await approveExternalPaymentRequest(requestId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        t("pages.admin.paymentRequestCredited", {
          amount: formatPoolCurrency(pending?.amount ?? 0),
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.admin.paymentRequestFailed"));
    } finally {
      setBusyId("");
    }
  };

  const handleDenyDeposit = async (requestId) => {
    setError("");
    setMessage("");
    setBusyId(requestId);
    try {
      const result = await denyExternalPaymentRequest(requestId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(t("pages.admin.paymentRequestDenied"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pages.admin.paymentRequestFailed"));
    } finally {
      setBusyId("");
    }
  };

  const handleFulfillRedemption = (requestId) => {
    setError("");
    setMessage("");
    const pending = redemptionRequests.find((item) => item.id === requestId);
    setBusyId(requestId);
    const result = fulfillMemberRedemptionRequest(requestId);
    setBusyId("");
    if (!result.ok) {
      setError(result.error || t("pages.admin.redemptionRequestFailed"));
      return;
    }
    setMessage(
      t("pages.admin.redemptionRequestFulfilled", {
        amount: formatPoolCurrency(pending?.amount ?? 0),
        name: pending?.memberName ?? t("notifications.redemptionMember"),
      }),
    );
  };

  const handleDenyRedemption = (requestId) => {
    setError("");
    setMessage("");
    setBusyId(requestId);
    const result = denyMemberRedemptionRequest(requestId);
    setBusyId("");
    if (!result.ok) {
      setError(result.error || t("pages.admin.redemptionRequestFailed"));
      return;
    }
    setMessage(t("pages.admin.redemptionRequestDenied"));
  };

  return (
    <section className="dda-brand-card overflow-hidden">
      <div className="dda-accent-bar" />
      <div className="border-b border-white/10 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <Banknote className="h-4 w-4 text-dda-green-light" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-white">
            {t("pages.admin.paymentRequestsTitle")}
          </h2>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-gray-300">
            {pendingCount}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400">{t("pages.admin.paymentRequestsSub")}</p>
      </div>

      {(error || message) && (
        <div className="border-b border-white/10 px-4 py-2.5 sm:px-5">
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : (
            <p className="text-sm text-dda-green-light">{message}</p>
          )}
        </div>
      )}

      {!pendingCount ? (
        <p className="px-4 py-6 text-sm text-gray-500 sm:px-5">
          {t("pages.admin.paymentRequestsEmpty")}
        </p>
      ) : (
        <ul className="divide-y divide-white/10">
          {redemptionRequests.map((request) => {
            const busy = busyId === request.id;
            return (
              <li key={`redemption-${request.id}`} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{request.memberName}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {request.handle}
                      {request.username ? ` · @${request.username}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-gray-300">
                      <span className="font-semibold tabular-nums text-dda-green-light">
                        {formatPoolCurrency(request.amount)}
                      </span>
                      <span className="text-gray-500">
                        {" "}
                        · {t("pages.admin.redemptionRequestKind")}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {formatWhen(request.contributedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleFulfillRedemption(request.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-dda-green/20 px-3 py-1.5 text-xs font-semibold text-dda-green-light ring-1 ring-dda-green/30 transition hover:bg-dda-green/30 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Gift className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t("pages.admin.redemptionRequestFulfill")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDenyRedemption(request.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("pages.admin.redemptionRequestDeny")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}

          {depositRequests.map((request) => {
            const busy = busyId === request.id;
            const methodLabel =
              request.method === "apple-pay"
                ? t("pages.admin.paymentMethodApplePay")
                : t("pages.admin.paymentMethodZelle");
            return (
              <li key={request.id} className="px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{request.memberName}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {request.handle}
                      {request.username ? ` · @${request.username}` : ""}
                    </p>
                    <p className="mt-2 text-sm text-gray-300">
                      <span className="font-semibold tabular-nums text-dda-green-light">
                        {formatPoolCurrency(request.amount)}
                      </span>
                      <span className="text-gray-500"> · {methodLabel}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {formatWhen(request.contributedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleApproveDeposit(request.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-dda-green/20 px-3 py-1.5 text-xs font-semibold text-dda-green-light ring-1 ring-dda-green/30 transition hover:bg-dda-green/30 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {t("pages.admin.paymentRequestApprove")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDenyDeposit(request.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 ring-1 ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("pages.admin.paymentRequestDeny")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
