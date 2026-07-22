import { cn } from "@/lib/utils";
import { Badge, ProgressBar } from "../layout/DashboardCard";
import { getMemberInitials } from "../../lib/memberDetails";
import { useLocale } from "../../i18n/LocaleContext";
import { useLocalizedData } from "../../i18n/localizedData";

const tierAccent = {
  Founder: "from-dda-gold-light/30 to-dda-gold-deep/10 text-dda-gold-soft ring-dda-gold-light/30 shadow-[0_0_12px_rgba(251,191,36,0.12)]",
  Builder: "from-dda-green-light/25 to-dda-green/10 text-dda-green-soft ring-dda-green-light/30 shadow-[0_0_12px_rgba(52,211,153,0.15)]",
  Member: "from-sky-400/20 to-sky-600/10 text-sky-300 ring-sky-400/25 shadow-[0_0_12px_rgba(56,189,248,0.1)]",
};

export default function MemberCard({ member, onClick, modern = false }) {
  const { t } = useLocale();
  const { translateStatus } = useLocalizedData();
  const accent = tierAccent[member.tier] ?? tierAccent.Member;

  return (
    <button
      type="button"
      onClick={() => onClick?.(member)}
      className={cn(
        "group relative w-full rounded-xl p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-dda-green/40",
        modern
          ? "dda-member-card dda-glass-btn hover:border-dda-green-light/25"
          : "dda-panel hover:border-dda-green-light/30 hover:bg-white/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold ring-1",
              modern ? accent : "bg-dda-green-light/15 text-dda-green-light ring-dda-green-light/25"
            )}
          >
            {getMemberInitials(member.name)}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-white transition group-hover:text-dda-green-soft">
              {member.name}
            </h3>
            <p className="text-sm text-gray-400">{member.handle}</p>
          </div>
        </div>
        <Badge variant={member.status === "active" ? "success" : "warning"}>
          {translateStatus(member.status)}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-gray-400">
        {t("memberCard.daysActive", {
          days: member.days,
          amount: member.contributed.toLocaleString(),
        })}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("memberModal.contributed")}</p>
          <p className="text-sm font-semibold tabular-nums text-white">
            ${member.contributed.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("memberModal.equity")}</p>
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              modern
                ? "bg-gradient-to-r from-dda-green-soft to-dda-green bg-clip-text text-transparent"
                : "text-dda-green-light"
            )}
          >
            ${member.equity.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("memberModal.streak")}</p>
          <p className="text-sm font-semibold tabular-nums text-white">{member.streak}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-gray-500">{t("memberModal.avgDaily")}</p>
          <p className="text-sm font-semibold tabular-nums text-white">
            ${member.days ? (member.contributed / member.days).toFixed(2) : "0.00"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div className="text-right sm:ml-auto">
          <p className="text-xs text-gray-400">{t("common.score")}</p>
          <p className="text-lg font-bold text-white">{member.score}</p>
        </div>
      </div>
      <div className={cn("mt-3", modern && "relative")}>
        {modern ? (
          <div className="absolute -inset-x-1 -bottom-1 top-1/2 rounded-full bg-dda-green-light/5 blur-md" />
        ) : null}
        <ProgressBar value={member.score} className={modern ? "relative" : undefined} />
      </div>
    </button>
  );
}
