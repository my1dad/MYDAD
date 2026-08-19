import { useEffect, useState } from "react";
import PageHeader from "../components/layout/PageHeader";
import AnalyticsInfographic from "../components/admin/AnalyticsInfographic";
import { useDadAuth } from "../context/DadAuthContext";
import { useLocale } from "../i18n/LocaleContext";
import { cn } from "@/lib/utils";

const RANGES = ["24h", "7d", "30d"];

export default function AnalyticsPage() {
  const { t } = useLocale();
  const { isAdmin } = useDadAuth();
  const [range, setRange] = useState("7d");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`/api/admin-analytics?range=${range}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || t("pages.analytics.loadError"));
        setData(body);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setData(null);
        setError(err.message || t("pages.analytics.loadError"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isAdmin, range, t]);

  if (!isAdmin) {
    return (
      <div className="dda-glass rounded-2xl p-6 text-sm text-gray-400">
        {t("pages.admin.masterOnly")}
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.analytics.title")}
        description={t("pages.analytics.description")}
        action={
          <div className="flex flex-wrap gap-1.5">
            {RANGES.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setRange(id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  range === id
                    ? "bg-dda-green/20 text-dda-green-light ring-1 ring-dda-green/40"
                    : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white",
                )}
              >
                {t(`pages.analytics.range.${id}`)}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <div className="dda-glass rounded-2xl px-4 py-3 text-sm text-amber-200">{error}</div>
      ) : null}

      <AnalyticsInfographic data={data} range={range} loading={loading} />

      <p className="px-1 text-xs text-gray-500">{t("pages.analytics.footer")}</p>
    </div>
  );
}
