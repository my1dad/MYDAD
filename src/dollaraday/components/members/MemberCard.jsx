import { cn } from "@/lib/utils";
import { Badge, ProgressBar } from "../layout/DashboardCard";
import { getMemberInitials } from "../../lib/memberDetails";
import { useLocale } from "../../i18n/LocaleContext";
import { useLocalizedData } from "../../i18n/localizedData";

const tierAccent = {
  Founder: "from-amber-400/30 to-amber-600/10 text-amber-300 ring-amber-400/30 shadow-[0_0_12px_rgba(251,191,36,0.12)]",
  Builder: "from-emerald-400/25 to-emerald-600/10 text-emerald-300 ring-emerald-400/30 shadow-[0_0_12px_rgba(52,211,153,0.15)]",
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
        "group relative w-full rounded-xl p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
        modern
          ? "dda-member-card dda-glass-btn hover:border-emerald-400/25"
          : "dda-panel hover:border-emerald-400/30 hover:bg-white/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-bold ring-1",
              modern ? accent : "bg-emerald-400/15 text-emerald-400 ring-emerald-400/25"
            )}
          >
            {getMemberInitials(member.name)}
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-white transition group-hover:text-emerald-50">
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
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs text-gray-400">{t("memberCard.equityValue")}</p>
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              modern
                ? "bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent"
                : "text-emerald-400"
            )}
          >
            ${member.equity.toLocaleString()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{t("common.score")}</p>
          <p className="text-lg font-bold text-white">{member.score}</p>
        </div>
      </div>
      <div className={cn("mt-3", modern && "relative")}>
        {modern ? (
          <div className="absolute -inset-x-1 -bottom-1 top-1/2 rounded-full bg-emerald-400/5 blur-md" />
        ) : null}
        <ProgressBar value={member.score} className={modern ? "relative" : undefined} />
      </div>
    </button>
  );
}
