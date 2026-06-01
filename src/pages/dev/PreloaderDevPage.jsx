import { useMemo, useState } from "react";
import AppPreloader, { AppPreloaderOverlay } from "../../components/ui/AppPreloader";

const DEFAULTS = {
  label: "Loading OverDrive",
  spinDuration: 750,
  pulseDuration: 1200,
  size: 112,
  logoSize: 80,
  trackColor: "#e2e8f0",
  spinTop: "#4f46e5",
  spinRight: "#818cf8",
  labelColor: "#64748b",
  kickerColor: "#94a3b8",
};

function toCssVars(values) {
  return {
    "--preloader-spin-duration": `${values.spinDuration}ms`,
    "--preloader-pulse-duration": `${values.pulseDuration}ms`,
    "--preloader-size": `${values.size}px`,
    "--preloader-logo-size": `${values.logoSize}px`,
    "--preloader-track-color": values.trackColor,
    "--preloader-spin-top": values.spinTop,
    "--preloader-spin-right": values.spinRight,
    "--preloader-label-color": values.labelColor,
    "--preloader-kicker-color": values.kickerColor,
  };
}

function Field({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

export default function PreloaderDevPage() {
  const [values, setValues] = useState(DEFAULTS);
  const [showOverlay, setShowOverlay] = useState(true);

  const cssVars = useMemo(() => toCssVars(values), [values]);

  const update = (key, next) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  const reset = () => setValues(DEFAULTS);

  return (
    <div className="min-h-dvh bg-slate-100">
      <div className="mx-auto grid min-h-dvh max-w-6xl gap-0 lg:grid-cols-[320px_1fr]">
        <aside className="border-b border-slate-200 bg-white p-5 lg:border-b-0 lg:border-r">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600">
            Dev only
          </p>
          <h1 className="mt-1 text-lg font-bold text-slate-900">Preloader lab</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            Live-tweak the animated loader. Edit source in{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">
              src/components/ui/AppPreloader.jsx
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">src/index.css</code>.
          </p>

          <div className="mt-5 space-y-4">
            <Field label="Label">
              <input
                type="text"
                value={values.label}
                onChange={(event) => update("label", event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/20"
              />
            </Field>

            <Field label={`Spin duration (${values.spinDuration}ms)`}>
              <input
                type="range"
                min={200}
                max={2000}
                step={50}
                value={values.spinDuration}
                onChange={(event) => update("spinDuration", Number(event.target.value))}
                className="w-full"
              />
            </Field>

            <Field label={`Logo pulse duration (${values.pulseDuration}ms)`}>
              <input
                type="range"
                min={400}
                max={3000}
                step={50}
                value={values.pulseDuration}
                onChange={(event) => update("pulseDuration", Number(event.target.value))}
                className="w-full"
              />
            </Field>

            <Field label={`Ring size (${values.size}px)`}>
              <input
                type="range"
                min={80}
                max={160}
                step={1}
                value={values.size}
                onChange={(event) => update("size", Number(event.target.value))}
                className="w-full"
              />
            </Field>

            <Field label={`Logo size (${values.logoSize}px)`}>
              <input
                type="range"
                min={32}
                max={96}
                step={1}
                value={values.logoSize}
                onChange={(event) => update("logoSize", Number(event.target.value))}
                className="w-full"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Track">
                <input
                  type="color"
                  value={values.trackColor}
                  onChange={(event) => update("trackColor", event.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white"
                />
              </Field>
              <Field label="Kicker">
                <input
                  type="color"
                  value={values.kickerColor}
                  onChange={(event) => update("kickerColor", event.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white"
                />
              </Field>
              <Field label="Fallback label">
                <input
                  type="color"
                  value={values.labelColor}
                  onChange={(event) => update("labelColor", event.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white"
                />
              </Field>
              <Field label="Spin top">
                <input
                  type="color"
                  value={values.spinTop}
                  onChange={(event) => update("spinTop", event.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white"
                />
              </Field>
              <Field label="Spin right">
                <input
                  type="color"
                  value={values.spinRight}
                  onChange={(event) => update("spinRight", event.target.value)}
                  className="h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={showOverlay}
                onChange={(event) => setShowOverlay(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
              />
              Show full-screen overlay
            </label>

            <button
              type="button"
              onClick={reset}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Reset defaults
            </button>
          </div>
        </aside>

        <section className="relative min-h-[420px] overflow-hidden bg-slate-50 lg:min-h-dvh">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.08),transparent_55%)]" />
          <div className="relative flex h-full min-h-[420px] flex-col items-center justify-center p-8 lg:min-h-dvh">
            <div className="app-preloader-panel relative" style={cssVars}>
              <span className="app-preloader-panel-shine" aria-hidden="true" />
              <AppPreloader label={values.label} />
            </div>
            <p className="mt-6 max-w-md text-center text-xs text-slate-500">
              Panel preview above. Toggle overlay to preview the full-screen loading state.
            </p>
          </div>

          {showOverlay ? (
            <div style={cssVars}>
              <AppPreloaderOverlay label={values.label} />
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
