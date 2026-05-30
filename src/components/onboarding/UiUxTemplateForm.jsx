import { Sparkles } from "lucide-react";
import Textarea from "../ui/Textarea";
import { UI_UX_ROADMAP_TEMPLATE } from "../../data/uiUxRoadmapTemplate";
import { onboardingFieldVariant } from "./onboardingTheme";

const FIELD = onboardingFieldVariant;

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default function UiUxTemplateForm({
  answers,
  onAnswerChange,
  activePhaseId,
  onPhaseChange,
  onGenerate,
  generateError,
  isGenerating,
}) {
  const activePhase =
    UI_UX_ROADMAP_TEMPLATE.find((phase) => phase.phaseId === activePhaseId) ??
    UI_UX_ROADMAP_TEMPLATE[0];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 px-4 py-3">
        <p className="text-xs font-semibold text-indigo-900">
          OverDrive OS — 4 Phase Development Roadmap
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-indigo-800/80">
          Answer the questions below for each phase. Click Generate to build your project roadmap
          with tasks pre-filled across all four phases.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {UI_UX_ROADMAP_TEMPLATE.map((phase) => {
          const active = phase.phaseId === activePhase.phaseId;
          const answered = phase.sections.reduce(
            (sum, section) =>
              sum +
              section.questions.filter((q) => answers[q.id]?.trim()).length,
            0
          );
          const total = phase.sections.reduce((sum, section) => sum + section.questions.length, 0);

          return (
            <button
              key={phase.phaseId}
              type="button"
              onClick={() => onPhaseChange(phase.phaseId)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left transition",
                active
                  ? "border-indigo-700 bg-indigo-100 text-indigo-950"
                  : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/40"
              )}
            >
              <p className="text-[11px] font-bold">{phase.phaseLabel}</p>
              <p className="text-[10px] text-slate-500">
                {answered}/{total} answered
              </p>
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">{activePhase.phaseLabel}</h4>
          <p className="mt-0.5 text-xs text-slate-600">{activePhase.phaseSummary}</p>
        </div>

        {activePhase.sections.map((section) => (
          <div
            key={section.id}
            className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"
          >
            <h5 className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-800">
              {section.title}
            </h5>
            <div className="space-y-4">
              {section.questions.map((question, index) => (
                <div key={question.id} className="space-y-1.5">
                  <label
                    htmlFor={question.id}
                    className="block text-xs font-semibold leading-snug text-slate-800"
                  >
                    {index + 1}. {question.text}
                    {question.suggestion ? (
                      <span className="ml-1.5 font-medium text-violet-600">(Suggested)</span>
                    ) : null}
                  </label>
                  <Textarea
                    variant={FIELD}
                    id={question.id}
                    value={answers[question.id] ?? ""}
                    onChange={(e) => onAnswerChange(question.id, e.target.value)}
                    placeholder="Your answer…"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {generateError ? (
        <p className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {generateError}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onGenerate}
        disabled={isGenerating}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-900/20 transition hover:from-violet-800 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" />
        Generate project from template
      </button>
    </div>
  );
}
