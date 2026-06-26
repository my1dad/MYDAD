import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronDown, FileText, Mail, Scale, Shield } from "lucide-react";
import { DOLLARADAY_LOGO_URL } from "@/lib/assetUrl";
import { getTermsOfServiceContent } from "../content/termsOfService";
import MobileShell from "../components/layout/MobileShell.jsx";
import LanguageToggle from "../components/layout/LanguageToggle.jsx";
import { useLocale } from "../i18n/LocaleContext.jsx";

const STICKY_OFFSET = 72;

function scrollToSection(targetId, scrollContainer) {
  const target = document.getElementById(targetId);
  if (!target || !scrollContainer) return;

  const containerTop = scrollContainer.getBoundingClientRect().top;
  const targetTop = target.getBoundingClientRect().top;

  scrollContainer.scrollTo({
    top: scrollContainer.scrollTop + targetTop - containerTop - STICKY_OFFSET,
    behavior: "smooth",
  });
}

function TermsSection({ index, title, body }) {
  return (
    <article className="dda-terms-section" id={`terms-section-${index}`}>
      <div className="dda-terms-section__index" aria-hidden="true">
        {index}
      </div>
      <div className="dda-terms-section__body">
        <h2 className="dda-terms-section__title">{title}</h2>
        <p className="dda-terms-section__text">{body}</p>
      </div>
    </article>
  );
}

export default function TermsOfServicePage() {
  const { locale, t } = useLocale();
  const content = getTermsOfServiceContent(locale);
  const mainRef = useRef(null);
  const [readProgress, setReadProgress] = useState(0);
  const [tocOpen, setTocOpen] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(min-width: 640px)").matches : false,
  );

  const goBack = () => {
    window.location.hash = "";
  };

  const handleJump = useCallback((targetId) => {
    scrollToSection(targetId, mainRef.current);
  }, []);

  useEffect(() => {
    const container = mainRef.current;
    if (!container) return undefined;

    const updateProgress = () => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) {
        setReadProgress(0);
        return;
      }
      setReadProgress(Math.min(100, Math.round((container.scrollTop / maxScroll) * 100)));
    };

    updateProgress();
    container.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      container.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash.startsWith("terms-")) return undefined;

    const timer = window.setTimeout(() => {
      handleJump(hash);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [handleJump]);

  return (
    <MobileShell
      variant="login"
      mainRef={mainRef}
      shellClassName="dda-mobile-shell--terms"
      mainClassName="dda-mobile-shell__main--terms px-0 py-0"
      contentClassName="dda-terms-page mx-auto w-full max-w-3xl"
    >
      <div className="dda-terms-sticky-bar">
        <div
          className="dda-terms-progress"
          role="progressbar"
          aria-valuenow={readProgress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("pages.terms.readingProgress")}
        >
          <span className="dda-terms-progress__fill" style={{ width: `${readProgress}%` }} />
        </div>

        <div className="dda-terms-sticky-bar__inner">
          <button type="button" onClick={goBack} className="dda-terms-back-btn">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t("pages.terms.backToSignIn")}</span>
            <span className="sm:hidden">{t("common.back")}</span>
          </button>

          <p className="dda-terms-sticky-bar__title">{content.title}</p>

          <LanguageToggle className="shrink-0" />
        </div>
      </div>

      <div className="dda-terms-page__body">
        <header className="dda-terms-hero">
          <div className="dda-accent-bar" />
          <div className="dda-terms-hero__inner">
            <div className="dda-terms-hero__brand">
              <img
                src={DOLLARADAY_LOGO_URL}
                alt=""
                className="dda-terms-hero__logo"
                draggable={false}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="dda-text-kicker">{t("brand.name")}</p>
                  <span className="dda-terms-draft-badge">{content.draftLabel}</span>
                </div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {content.title}
                </h1>
                <p className="mt-2 text-sm text-gray-400">
                  {content.effectiveDateLabel}:{" "}
                  <span className="font-medium text-gray-300">{content.effectiveDate}</span>
                </p>
              </div>
            </div>

            <div className="dda-terms-hero__meta">
              <div className="dda-terms-meta-card">
                <Shield className="h-4 w-4 text-dda-green-light" aria-hidden="true" />
                <span>{t("pages.terms.metaBinding")}</span>
              </div>
              <div className="dda-terms-meta-card">
                <Scale className="h-4 w-4 text-dda-green-light" aria-hidden="true" />
                <span>{t("pages.terms.metaGovernance")}</span>
              </div>
              <div className="dda-terms-meta-card">
                <FileText className="h-4 w-4 text-dda-green-light" aria-hidden="true" />
                <span>
                  {content.sections.length} {t("pages.terms.metaSections")}
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className="dda-terms-toc">
          <button
            type="button"
            className="dda-terms-toc__toggle"
            onClick={() => setTocOpen((open) => !open)}
            aria-expanded={tocOpen}
          >
            <span className="dda-terms-toc__label">{t("pages.terms.tocLabel")}</span>
            <ChevronDown className={tocOpen ? "dda-terms-toc__chevron--open" : "dda-terms-toc__chevron"} aria-hidden="true" />
          </button>

          {tocOpen ? (
            <ol className="dda-terms-toc__list">
              <li>
                <button type="button" className="dda-terms-toc__link" onClick={() => handleJump("terms-welcome")}>
                  {content.welcomeTitle}
                </button>
              </li>
              {content.sections.map((section, index) => (
                <li key={section.id}>
                  <button
                    type="button"
                    className="dda-terms-toc__link"
                    onClick={() => handleJump(`terms-section-${index + 1}`)}
                  >
                    {index + 1}. {section.title}
                  </button>
                </li>
              ))}
            </ol>
          ) : null}
        </section>

        <div className="dda-brand-card dda-terms-document">
          <div className="dda-terms-document__inner">
            <section id="terms-welcome" className="dda-terms-intro">
              <h2 className="dda-terms-intro__title">{content.welcomeTitle}</h2>
              <p className="dda-terms-intro__text">{content.welcomeBody}</p>
            </section>

            <div className="dda-terms-sections">
              {content.sections.map((section, index) => (
                <TermsSection
                  key={section.id}
                  index={index + 1}
                  title={section.title}
                  body={section.body}
                />
              ))}
            </div>

            <aside className="dda-terms-notice">
              <p className="dda-terms-notice__title">{content.legalNoticeTitle}</p>
              <p className="dda-terms-notice__text">{content.legalNoticeBody}</p>
            </aside>

            <footer className="dda-terms-contact">
              <p className="dda-terms-contact__title">{content.contactTitle}</p>
              <div className="dda-terms-contact__links">
                <a href={`mailto:${content.contactEmail}`} className="dda-terms-contact__link">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  {content.contactEmail}
                </a>
                <a
                  href={`https://${content.contactWebsite}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dda-terms-contact__link"
                >
                  {content.contactWebsite}
                </a>
              </div>
            </footer>
          </div>
        </div>

        <div className="dda-terms-page__footer">
          <button type="button" onClick={goBack} className="dda-btn-primary w-full py-2.5 sm:w-auto sm:px-8">
            {t("pages.terms.backToSignIn")}
          </button>
        </div>
      </div>
    </MobileShell>
  );
}
