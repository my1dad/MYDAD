import { emptyPhase, emptyTask, normalizePhase } from "./projectUtils";

export function buildPhasesFromUiUxTemplate(template) {
  const phases = {};

  for (const phaseDef of template) {
    const tasks = [];

    for (const section of phaseDef.sections) {
      for (const question of section.questions) {
        const text = question.text?.trim();
        if (!text) continue;

        tasks.push({
          ...emptyTask(),
          title: text,
          details: question.suggestion ? "Suggested enhancement" : "",
        });
      }
    }

    const templateTitle = phaseDef.phaseLabel?.replace(/^Phase \d+\s*[—-]\s*/i, "").trim();

    phases[phaseDef.phaseId] = normalizePhase({
      ...emptyPhase(),
      ...(templateTitle ? { title: templateTitle } : {}),
      objective: phaseDef.phaseSummary,
      status: "not_started",
      tasks,
    });

  }

  return phases;
}

export function buildDescriptionFromUiUxTemplate(projectName) {
  return `${projectName || "Project"} — generated from the OverDrive OS UI/UX 4-Phase Development Roadmap template.`;
}
