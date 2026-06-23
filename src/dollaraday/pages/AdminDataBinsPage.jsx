import { ArrowLeft, Database } from "lucide-react";
import PageHeader from "../components/layout/PageHeader";
import AdminDataBinsPanel from "../components/admin/AdminDataBinsPanel";
import { useLocale } from "../i18n/LocaleContext";

export default function AdminDataBinsPage({ onNavigate }) {
  const { t } = useLocale();

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title={t("pages.adminBins.title")}
        description={t("pages.adminBins.description")}
        action={
          <button
            type="button"
            onClick={() => onNavigate?.("admin")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t("pages.adminBins.back")}
          </button>
        }
      />

      <div className="dda-glass flex items-center gap-3 rounded-2xl px-4 py-3 sm:px-5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-dda-green/15 text-dda-green-light ring-1 ring-dda-green/25">
          <Database className="h-5 w-5" strokeWidth={2.25} />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">{t("pages.adminBins.internalStorage")}</p>
          <p className="text-xs text-gray-500">{t("pages.adminBins.intro")}</p>
        </div>
      </div>

      <AdminDataBinsPanel />
    </div>
  );
}
