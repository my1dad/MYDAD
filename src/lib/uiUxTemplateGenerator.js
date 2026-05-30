import { UI_UX_ROADMAP_TEMPLATE } from "../data/uiUxRoadmapTemplate";
import { emptyPhase, emptyTask, normalizePhase } from "./projectUtils";

export function buildPhasesFromUiUxTemplate(answers) {
  const phases = {};

  for (const phaseDef of UI_UX_ROADMAP_TEMPLATE) {
    const tasks = [];

    for (const section of phaseDef.sections) {
      for (const question of section.questions) {
        const answer = answers[question.id]?.trim() ?? "";
        tasks.push({
          ...emptyTask(),
          title: question.text,
          details: answer
            ? `${answer}${question.suggestion ? "\n\n(Suggested enhancement)" : ""}`
            : question.suggestion
              ? "Suggested enhancement — add your plan here."
              : "",
        });
      }
    }

    phases[phaseDef.phaseId] = normalizePhase({
      ...emptyPhase(),
      objective: phaseDef.phaseSummary,
      status: "not_started",
      tasks,
    });
  }

  return phases;
}

export function buildDescriptionFromUiUxTemplate(answers, projectName) {
  const filled = UI_UX_ROADMAP_TEMPLATE.flatMap((phase) =>
    phase.sections.flatMap((section) =>
      section.questions
        .map((q) => ({ question: q.text, answer: answers[q.id]?.trim() ?? "" }))
        .filter((entry) => entry.answer)
    )
  );

  if (!filled.length) {
    return `${projectName || "Project"} — generated from the OverDrive OS UI/UX 4-Phase Development Roadmap template.`;
  }

  const preview = filled
    .slice(0, 3)
    .map((entry) => entry.answer)
    .join(" · ");

  return `${projectName || "Project"} — UI/UX roadmap template. ${preview}${filled.length > 3 ? "…" : ""}`;
}

export function countFilledUiUxAnswers(answers) {
  return Object.values(answers).filter((value) => String(value ?? "").trim()).length;
}
