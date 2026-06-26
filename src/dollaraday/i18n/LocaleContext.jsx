import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { formatRelativeTimeFromIso } from "../lib/dateTime";
import en from "./translations/en";
import es from "./translations/es";

const STORAGE_KEY = "dda-locale";
const translations = { en, es };

function getNested(obj, path) {
  return path.split(".").reduce((current, key) => current?.[key], obj);
}

function interpolate(template, vars = {}) {
  if (typeof template !== "string") return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    vars[key] !== undefined ? String(vars[key]) : `{{${key}}}`
  );
}

function resolveTranslation(locale, key) {
  const dict = translations[locale] ?? translations.en;
  const value = getNested(dict, key);
  if (value !== undefined) return value;
  return getNested(translations.en, key) ?? key;
}

const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    if (typeof window === "undefined") return "en";
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "es" ? "es" : "en";
  });

  const setLocale = useCallback((next) => {
    const value = next === "es" ? "es" : "en";
    setLocaleState(value);
    localStorage.setItem(STORAGE_KEY, value);
    document.documentElement.lang = value;
    queueMicrotask(() => {
      void import("../lib/supabase/cloudSync").then(({ touchCloudKv }) => touchCloudKv(STORAGE_KEY));
    });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key, vars) => {
      const raw = resolveTranslation(locale, key);
      if (Array.isArray(raw)) return raw.map((item) => interpolate(item, vars));
      return interpolate(raw, vars);
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

export function formatRelativeTime(iso, t, locale = "en") {
  return formatRelativeTimeFromIso(iso, t, locale);
}
