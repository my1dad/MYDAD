import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Layers,
  Rocket,
  Save,
  Target,
  Users,
  X,
} from "lucide-react";
import Input from "../ui/Input";
import Select from "../ui/Select";
import StageColorSelect from "../ui/StageColorSelect";
import Textarea from "../ui/Textarea";
import TagInput from "../ui/TagInput";
import PhaseCard from "./PhaseCard";
import PhaseThumbnailCard from "./PhaseThumbnailCard";
import OnboardingReviewStep from "./OnboardingReviewStep";
import TeamMembersMultiSelect from "./TeamMembersMultiSelect";
import UiUxTemplateForm from "./UiUxTemplateForm";
import {
  clearOnboardingDraft,
} from "../../lib/projectStorage";
import {
  emptyPhase,
  getNextProjectId,
  getDefaultPhaseTitle,
  generateProjectStageColor,
  getProjectStageColor,
  normalizePhase,
  PHASE_DEFS,
  PROJECT_STAGE_COLORS,
  projectToForm,
  resolvePhaseForDisplay,
  syncTeamFromPhaseAssignees,
} from "../../lib/projectUtils";
import {
  buildDescriptionFromUiUxTemplate,
  buildPhasesFromUiUxTemplate,
} from "../../lib/uiUxTemplateGenerator";
import {
  addTemplateStep,
  cloneUiUxTemplate,
  countFilledTemplateSteps,
  removeTemplateStep,
  updateTemplateStepText,
} from "../../lib/uiUxTemplateEditor";
import {
  PROJECT_TEMPLATE_MODES,
} from "../../data/uiUxRoadmapTemplate";
import { useTeam } from "../../context/TeamContext";
import { useSyncedTeamWorkload } from "../../hooks/useSyncedTeamWorkload";
import { parseUsdBudgetInput } from "../../lib/formatCurrency";
import { onboardingFieldVariant, onboardingShell } from "./onboardingTheme";

const FIELD = onboardingFieldVariant;

const STEPS = [
  { id: 1, label: "Project Foundation", icon: Rocket },
  { id: 2, label: "Roadmap Phases", icon: Layers },
  { id: 3, label: "Team & Timeline", icon: Users },
  { id: 4, label: "KPIs & Success Metrics", icon: Target },
  { id: 5, label: "Review & Create", icon: CheckCircle2 },
];

const PROJECT_TYPE_LABELS = {
  web_app: "Web Application",
  web_slash_app: "Web/App",
  mobile_app: "Mobile App",
  integration: "Integration",
  platform: "Platform",
  internal_tool: "Internal Tool",
};

const emptyPhaseData = () => emptyPhase();

const initialForm = () => ({
  foundation: {
    projectId: "",
    projectName: "",
    projectType: "web_app",
    clientType: "internal",
    description: "",
    priority: "medium",
    targetLaunchDate: "",
    stageColor: PROJECT_STAGE_COLORS[0],
  },
  phases: {
    foundation: emptyPhaseData(),
    core: emptyPhaseData(),
    integrations: emptyPhaseData(),
    scale: emptyPhaseData(),
  },
  team: {
    projectOwner: "",
    teamMembers: [],
    sprintLength: "2_weeks",
    timelineType: "agile",
    estimatedBudget: "",
  },
  kpis: {
    successMetrics: [],
    revenueGoal: "",
    riskLevel: "medium",
    expectedUserVolume: "1k_10k",
    notes: "",
  },
});

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function migrateFormDraft(form) {
  const phases = {};
  for (const id of Object.keys(form.phases ?? {})) {
    phases[id] = normalizePhase(form.phases[id]);
  }
  return {
    ...form,
    phases,
    foundation: {
      ...form.foundation,
      stageColor:
        form.foundation?.stageColor ??
        PROJECT_STAGE_COLORS[0],
    },
  };
}

export default function NewProjectOnboarding({
  open,
  onClose,
  onSubmit,
  editingProject,
  projects = [],
  initialTemplateMode = "blank",
}) {
  const isEditing = Boolean(editingProject);
  const { members } = useTeam();
  const workload = useSyncedTeamWorkload(projects);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [selectedPhaseId, setSelectedPhaseId] = useState("foundation");
  const [templateMode, setTemplateMode] = useState("blank");
  const [templateDraft, setTemplateDraft] = useState(cloneUiUxTemplate);
  const [activeTemplatePhaseId, setActiveTemplatePhaseId] = useState("foundation");
  const [generateError, setGenerateError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(initialForm());
      setStep(1);
      setSelectedPhaseId("foundation");
      setTemplateMode("blank");
      setTemplateDraft(cloneUiUxTemplate());
      setActiveTemplatePhaseId("foundation");
      setGenerateError("");
      setIsGenerating(false);
      return;
    }

    if (editingProject) {
      setForm(migrateFormDraft(projectToForm(editingProject)));
      setStep(1);
      setSelectedPhaseId("foundation");
      return;
    }

    clearOnboardingDraft();
    const templateMode = initialTemplateMode === "ui_ux" ? "ui_ux" : "blank";
    setTemplateMode(templateMode);
    if (templateMode === "ui_ux") {
      setTemplateDraft(cloneUiUxTemplate());
      setActiveTemplatePhaseId("foundation");
    }
    setForm({
      ...initialForm(),
      foundation: {
        ...initialForm().foundation,
        projectId: getNextProjectId("internal", projects),
        stageColor: generateProjectStageColor(projects.map((p) => p.color)),
      },
    });
    setStep(1);
    setSelectedPhaseId("foundation");
  }, [open, editingProject, projects, initialTemplateMode]);

  const { foundation, phases, team, kpis } = form;

  const phaseAssignees = useMemo(
    () =>
      Object.fromEntries(
        PHASE_DEFS.map((phase) => [phase.id, phases[phase.id]?.assignedMemberId ?? ""])
      ),
    [phases]
  );

  const syncedTeamPreview = useMemo(
    () => syncTeamFromPhaseAssignees(phases, members, team),
    [phases, members, team]
  );

  const selectedPhase =
    resolvePhaseForDisplay(selectedPhaseId, phases) ??
    resolvePhaseForDisplay(PHASE_DEFS[0].id, phases);
  const selectedPhaseHasTask = (phases[selectedPhaseId]?.tasks?.length ?? 0) > 0;

  const phasesMissingTasks = useMemo(
    () => PHASE_DEFS.filter((phase) => !(phases[phase.id]?.tasks?.length > 0)),
    [phases]
  );

  const allPhasesHaveTasks = phasesMissingTasks.length === 0;

  const skipsRoadmapStep = templateMode === "ui_ux" && !isEditing;

  const activeSteps = useMemo(() => {
    if (skipsRoadmapStep) {
      return [STEPS[0], STEPS[2], STEPS[3], STEPS[4]].map((entry, index) => ({
        ...entry,
        displayId: index + 1,
        internalStep: entry.id,
      }));
    }
    return STEPS.map((entry) => ({
      ...entry,
      displayId: entry.id,
      internalStep: entry.id,
    }));
  }, [skipsRoadmapStep]);

  const templateGenerated = allPhasesHaveTasks;

  useEffect(() => {
    if (skipsRoadmapStep && step === 2) {
      setStep(3);
    }
  }, [skipsRoadmapStep, step]);

  const canGoNext =
    (step !== 2 || selectedPhaseHasTask) &&
    (step !== 1 || templateMode === "blank" || templateGenerated);

  const nextStepHint =
    step === 1 && templateMode === "ui_ux" && !templateGenerated
      ? "Click Generate to build the roadmap, or switch back to Blank"
      : step === 2 && !selectedPhaseHasTask
        ? `Add at least one task to ${selectedPhase.title} to continue`
        : null;

  const nextButtonLabel =
    step === 2 && selectedPhaseHasTask && !allPhasesHaveTasks ? "Next Phase" : "Next";

  if (!open) return null;

  const updateFoundation = (field, value) =>
    setForm((f) => ({ ...f, foundation: { ...f.foundation, [field]: value } }));

  const updateClientType = (clientType) => {
    setForm((f) => ({
      ...f,
      foundation: {
        ...f.foundation,
        clientType,
        ...(isEditing ? {} : { projectId: getNextProjectId(clientType, projects) }),
      },
    }));
  };

  const updatePhase = (phaseId, data) =>
    setForm((f) => ({
      ...f,
      phases: { ...f.phases, [phaseId]: normalizePhase(data) },
    }));

  const updatePhaseAssignee = (phaseId, memberId) => {
    updatePhase(phaseId, { ...phases[phaseId], assignedMemberId: memberId });
  };

  const updateTeam = (field, value) =>
    setForm((f) => ({ ...f, team: { ...f.team, [field]: value } }));

  const handleBudgetChange = (value) => {
    updateTeam("estimatedBudget", parseUsdBudgetInput(value));
  };

  const updateKpis = (field, value) =>
    setForm((f) => ({ ...f, kpis: { ...f.kpis, [field]: value } }));

  const handleRevenueGoalChange = (value) => {
    updateKpis("revenueGoal", parseUsdBudgetInput(value));
  };

  const handleClose = () => {
    if (!isEditing) clearOnboardingDraft();
    onClose();
  };

  const buildProjectFromForm = () => {
    const foundationFields = { ...form.foundation };
    const stageColor =
      foundationFields.stageColor ??
      (isEditing ? getProjectStageColor(editingProject) : PROJECT_STAGE_COLORS[0]);
    delete foundationFields.projectId;
    delete foundationFields.stageColor;
    const id = isEditing
      ? editingProject.id
      : getNextProjectId(foundation.clientType, projects);
    const syncedTeam = syncTeamFromPhaseAssignees(form.phases, members, form.team);
    return {
      id,
      ...foundationFields,
      phases: form.phases,
      team: syncedTeam,
      kpis: form.kpis,
      color: stageColor,
      createdAt: isEditing ? editingProject.createdAt : new Date().toISOString(),
    };
  };

  const handleQuickUpdate = () => {
    if (!isEditing) return;
    handleSubmit();
  };

  const handleSubmit = () => {
    onSubmit?.(buildProjectFromForm(), { isEditing });
    if (!isEditing) clearOnboardingDraft();
    setStep(1);
    setForm(initialForm());
    onClose();
  };

  const next = () => {
    if (step === 1 && skipsRoadmapStep) {
      if (!templateGenerated) return;
      setStep(3);
      return;
    }

    if (step === 2) {
      if (!selectedPhaseHasTask) return;

      if (allPhasesHaveTasks) {
        setStep(3);
        return;
      }

      const currentIndex = PHASE_DEFS.findIndex((p) => p.id === selectedPhaseId);
      for (let i = currentIndex + 1; i < PHASE_DEFS.length; i++) {
        if (!(phases[PHASE_DEFS[i].id]?.tasks?.length > 0)) {
          setSelectedPhaseId(PHASE_DEFS[i].id);
          return;
        }
      }
      for (let i = 0; i < currentIndex; i++) {
        if (!(phases[PHASE_DEFS[i].id]?.tasks?.length > 0)) {
          setSelectedPhaseId(PHASE_DEFS[i].id);
          return;
        }
      }

      setStep(3);
      return;
    }

    setStep((s) => Math.min(s + 1, 5));
  };

  const back = () => {
    if (step === 3 && skipsRoadmapStep) {
      setStep(1);
      return;
    }
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleTemplateModeChange = (mode) => {
    setTemplateMode(mode);
    setGenerateError("");

    if (mode === "blank") {
      setForm((f) => ({
        ...f,
        phases: {
          foundation: emptyPhaseData(),
          core: emptyPhaseData(),
          integrations: emptyPhaseData(),
          scale: emptyPhaseData(),
        },
      }));
      return;
    }

    setActiveTemplatePhaseId("foundation");
    setTemplateDraft(cloneUiUxTemplate());
    if (step === 2) setStep(1);
  };

  const handleAddTemplateStep = (phaseId, sectionId) => {
    setTemplateDraft((current) => addTemplateStep(current, phaseId, sectionId));
    setGenerateError("");
  };

  const handleRemoveTemplateStep = (phaseId, sectionId, questionId) => {
    setTemplateDraft((current) => removeTemplateStep(current, phaseId, sectionId, questionId));
    setGenerateError("");
  };

  const handleUpdateTemplateStepText = (phaseId, sectionId, questionId, text) => {
    setTemplateDraft((current) =>
      updateTemplateStepText(current, phaseId, sectionId, questionId, text)
    );
    setGenerateError("");
  };

  const handleGenerateFromTemplate = () => {
    if (!foundation.projectName.trim()) {
      setGenerateError("Enter a project name before generating.");
      return;
    }

    if (countFilledTemplateSteps(templateDraft) === 0) {
      setGenerateError("Add at least one step with a title before generating.");
      return;
    }

    setIsGenerating(true);
    setGenerateError("");

    const generatedPhases = buildPhasesFromUiUxTemplate(templateDraft);
    const description = buildDescriptionFromUiUxTemplate(foundation.projectName);

    setForm((f) => ({
      ...f,
      foundation: {
        ...f.foundation,
        description: description || f.foundation.description,
      },
      phases: Object.fromEntries(
        Object.entries(generatedPhases).map(([phaseId, phase]) => [
          phaseId,
          {
            ...phase,
            assignedMemberId: f.phases[phaseId]?.assignedMemberId ?? "",
          },
        ])
      ),
    }));
    setSelectedPhaseId("foundation");
    setStep(3);
    setIsGenerating(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal backdrop"
        className={cn("absolute inset-0", onboardingShell.backdrop)}
        onClick={handleClose}
      />

      <div
        className={cn(
          "relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl border",
          step === 5 || (step === 1 && templateMode === "ui_ux") ? "max-w-5xl" : "max-w-4xl",
          onboardingShell.panel
        )}
      >
        {/* Header */}
        <div className={cn("px-6 py-5", onboardingShell.header)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">
                Over Drive OS
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-white">
                {isEditing ? "Edit Project" : "New Project Onboarding"}
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-300">
                {isEditing
                  ? "Update your project details across 5 steps"
                  : skipsRoadmapStep
                    ? "Set up your project in 4 simple steps"
                    : "Set up your project in 5 simple steps"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="mt-5 flex items-center gap-1">
            {activeSteps.map((s, i) => {
              const done = step > s.internalStep;
              const active = step === s.internalStep;
              return (
                <div key={s.internalStep} className="flex flex-1 items-center gap-1">
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition",
                        done
                          ? "bg-indigo-500 text-white"
                          : active
                            ? "bg-indigo-500 text-white ring-4 ring-indigo-400/40"
                            : "bg-slate-700 text-slate-300 ring-1 ring-slate-600"
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : s.displayId}
                    </div>
                    <span
                      className={cn(
                        "hidden text-[9px] font-semibold sm:block",
                        active ? "text-indigo-300" : "text-slate-400"
                      )}
                    >
                      {s.label.split(" ")[0]}
                    </span>
                  </div>
                  {i < activeSteps.length - 1 && (
                    <div
                      className={cn(
                        "mb-4 h-px flex-1",
                        step > s.internalStep ? "bg-indigo-400" : "bg-slate-600"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className={cn("flex-1 overflow-y-auto px-6 py-5", onboardingShell.body)}>
          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className={cn("grid gap-4", !isEditing ? "grid-cols-2" : "grid-cols-1")}>
                <Input
                  variant={FIELD}
                  label="Project Name"
                  id="projectName"
                  placeholder="e.g. CRM System"
                  value={foundation.projectName}
                  onChange={(e) => updateFoundation("projectName", e.target.value)}
                />

                {!isEditing && (
                  <Select
                    variant={FIELD}
                    label="Project Template"
                    id="projectTemplate"
                    value={templateMode}
                    onChange={(e) => handleTemplateModeChange(e.target.value)}
                  >
                    {PROJECT_TEMPLATE_MODES.map((mode) => (
                      <option key={mode.id} value={mode.id}>
                        {mode.label}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-900">Client / Internal</span>
                <div className="flex gap-2">
                  {["client", "internal"].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateClientType(type)}
                      className={cn(
                        "flex-1 rounded-xl border py-2.5 text-sm font-semibold capitalize transition",
                        foundation.clientType === type
                          ? "border-indigo-700 bg-indigo-100 text-indigo-950"
                          : "border-slate-400 bg-white text-slate-800 hover:bg-slate-50"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Input
                  variant={FIELD}
                  label="Project ID"
                  id="projectId"
                  placeholder="e.g. N-0001"
                  value={foundation.projectId}
                  readOnly
                  className="min-w-0 opacity-80"
                />
                <Select
                  variant={FIELD}
                  label="Project Type"
                  id="projectType"
                  className="min-w-0"
                  value={foundation.projectType}
                  onChange={(e) => updateFoundation("projectType", e.target.value)}
                >
                  <option value="web_app">Web Application</option>
                  <option value="web_slash_app">Web/App</option>
                  <option value="mobile_app">Mobile App</option>
                  <option value="integration">Integration</option>
                  <option value="platform">Platform</option>
                  <option value="internal_tool">Internal Tool</option>
                </Select>
                <StageColorSelect
                  variant={FIELD}
                  label="Stage color"
                  id="stageColor"
                  className="min-w-0"
                  value={foundation.stageColor}
                  onChange={(color) => updateFoundation("stageColor", color)}
                />
              </div>

              {templateMode === "blank" ? (
                <>
                  <Textarea
                    variant={FIELD}
                    label="Description"
                    id="description"
                    placeholder="Brief overview of the project goals..."
                    value={foundation.description}
                    onChange={(e) => updateFoundation("description", e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      variant={FIELD}
                      label="Priority"
                      id="priority"
                      value={foundation.priority}
                      onChange={(e) => updateFoundation("priority", e.target.value)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </Select>
                    <Input
                      variant={FIELD}
                      label="Target Launch Date"
                      id="targetLaunchDate"
                      type="date"
                      value={foundation.targetLaunchDate}
                      onChange={(e) => updateFoundation("targetLaunchDate", e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      variant={FIELD}
                      label="Priority"
                      id="priority"
                      value={foundation.priority}
                      onChange={(e) => updateFoundation("priority", e.target.value)}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </Select>
                    <Input
                      variant={FIELD}
                      label="Target Launch Date"
                      id="targetLaunchDate"
                      type="date"
                      value={foundation.targetLaunchDate}
                      onChange={(e) => updateFoundation("targetLaunchDate", e.target.value)}
                    />
                  </div>

                  {nextStepHint && (
                    <p className="rounded-xl border border-amber-400 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-950">
                      {nextStepHint}
                    </p>
                  )}

                  <UiUxTemplateForm
                    template={templateDraft}
                    activePhaseId={activeTemplatePhaseId}
                    onPhaseChange={setActiveTemplatePhaseId}
                    onAddStep={handleAddTemplateStep}
                    onRemoveStep={handleRemoveTemplateStep}
                    onUpdateStepText={handleUpdateTemplateStepText}
                    onGenerate={handleGenerateFromTemplate}
                    generateError={generateError}
                    isGenerating={isGenerating}
                    members={members}
                    phaseAssignees={phaseAssignees}
                    onPhaseAssigneeChange={updatePhaseAssignee}
                    workloadByMemberId={workload.workloadByMemberId}
                  />
                </>
              )}
            </div>
          )}

          {/* Step 2 — blank template only */}
          {step === 2 && !skipsRoadmapStep && (
            <div className="space-y-5">
              <p className="text-sm font-medium text-slate-800">
                Select a phase to configure. Break each roadmap phase into scheduled tasks
                with titles, details, and dates.
              </p>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {PHASE_DEFS.map((phaseDef) => {
                  const displayPhase = resolvePhaseForDisplay(phaseDef.id, phases);
                  return (
                    <PhaseThumbnailCard
                      key={phaseDef.id}
                      phase={displayPhase}
                      data={phases[phaseDef.id]}
                      selected={selectedPhaseId === phaseDef.id}
                      incomplete={!(phases[phaseDef.id]?.tasks?.length > 0)}
                      onSelect={() => setSelectedPhaseId(phaseDef.id)}
                      defaultTitle={getDefaultPhaseTitle(phaseDef.id)}
                      onTitleChange={(title) =>
                        updatePhase(phaseDef.id, { ...phases[phaseDef.id], title })
                      }
                    />
                  );
                })}
              </div>

              {nextStepHint && (
                <p className="rounded-xl border border-amber-400 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-950">
                  {nextStepHint}
                </p>
              )}

              {!nextStepHint && !allPhasesHaveTasks && selectedPhaseHasTask && (
                <p className="rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900">
                  {phasesMissingTasks.length} phase{phasesMissingTasks.length !== 1 ? "s" : ""}{" "}
                  remaining — click Next Phase to continue.
                </p>
              )}

              <PhaseCard
                phase={selectedPhase}
                data={phases[selectedPhaseId]}
                onChange={(data) => updatePhase(selectedPhaseId, data)}
                projectName={foundation.projectName || "New project"}
                members={members}
                workloadByMemberId={workload.workloadByMemberId}
              />
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <Input
                variant={FIELD}
                label="Project Owner"
                id="projectOwner"
                placeholder="Full name"
                value={team.projectOwner}
                onChange={(e) => updateTeam("projectOwner", e.target.value)}
              />

              <TeamMembersMultiSelect
                variant={FIELD}
                id="teamMembers"
                members={members}
                value={team.teamMembers}
                onChange={(memberIds) => updateTeam("teamMembers", memberIds)}
                workloadByMemberId={workload.workloadByMemberId}
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  variant={FIELD}
                  label="Sprint Length"
                  id="sprintLength"
                  value={team.sprintLength}
                  onChange={(e) => updateTeam("sprintLength", e.target.value)}
                >
                  <option value="1_week">1 Week</option>
                  <option value="2_weeks">2 Weeks</option>
                  <option value="3_weeks">3 Weeks</option>
                  <option value="4_weeks">4 Weeks</option>
                </Select>
                <Select
                  variant={FIELD}
                  label="Timeline Type"
                  id="timelineType"
                  value={team.timelineType}
                  onChange={(e) => updateTeam("timelineType", e.target.value)}
                >
                  <option value="agile">Agile</option>
                  <option value="waterfall">Waterfall</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="kanban">Kanban</option>
                </Select>
              </div>

              <Input
                variant={FIELD}
                label="Estimated Budget"
                id="estimatedBudget"
                placeholder="e.g. $20,000"
                inputMode="numeric"
                value={team.estimatedBudget}
                onChange={(e) => handleBudgetChange(e.target.value)}
              />
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="space-y-4">
              <TagInput
                variant={FIELD}
                label="Success Metrics"
                tags={kpis.successMetrics}
                onChange={(tags) => updateKpis("successMetrics", tags)}
                placeholder="e.g. User retention, NPS..."
              />
              <Input
                variant={FIELD}
                label="Revenue Goal"
                id="revenueGoal"
                placeholder="e.g. $20,000"
                inputMode="numeric"
                value={kpis.revenueGoal}
                onChange={(e) => handleRevenueGoalChange(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-4">
                <Select
                  variant={FIELD}
                  label="Risk Level"
                  id="riskLevel"
                  value={kpis.riskLevel}
                  onChange={(e) => updateKpis("riskLevel", e.target.value)}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </Select>
                <Select
                  variant={FIELD}
                  label="Expected User Volume"
                  id="expectedUserVolume"
                  value={kpis.expectedUserVolume}
                  onChange={(e) => updateKpis("expectedUserVolume", e.target.value)}
                >
                  <option value="under_1k">Under 1,000</option>
                  <option value="1k_10k">1,000 – 10,000</option>
                  <option value="10k_100k">10,000 – 100,000</option>
                  <option value="100k_plus">100,000+</option>
                </Select>
              </div>
              <Textarea
                variant={FIELD}
                label="Notes"
                id="notes"
                placeholder="Additional context, dependencies, or risks..."
                value={kpis.notes}
                onChange={(e) => updateKpis("notes", e.target.value)}
                rows={4}
              />
            </div>
          )}

          {/* Step 5 — Review */}
          {step === 5 && (
            <OnboardingReviewStep
              foundation={foundation}
              phases={phases}
              team={team}
              kpis={kpis}
              members={members}
              syncedTeamPreview={syncedTeamPreview}
              projectTypeLabels={PROJECT_TYPE_LABELS}
              isEditing={isEditing}
              onUpdatePhase={updatePhase}
              projectName={foundation.projectName || "New project"}
              workloadByMemberId={workload.workloadByMemberId}
            />
          )}
        </div>

        {/* Footer */}
        <div
          className={cn(
            "grid items-center gap-3 px-6 py-4",
            isEditing ? "grid-cols-3" : "grid-cols-2",
            onboardingShell.footer
          )}
        >
          <button
            type="button"
            onClick={step === 1 ? handleClose : back}
            className="flex items-center justify-self-start gap-1.5 rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {isEditing && (
            <button
              type="button"
              onClick={handleQuickUpdate}
              className="flex items-center justify-center gap-1.5 justify-self-center rounded-xl border border-indigo-300 bg-indigo-50 px-5 py-2 text-sm font-bold text-indigo-800 transition hover:bg-indigo-100"
            >
              <Save className="h-4 w-4" />
              Update
            </button>
          )}

          {step < 5 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canGoNext}
              title={nextStepHint ?? undefined}
              className="flex items-center justify-self-end gap-1.5 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-900/30 hover:from-indigo-800 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:opacity-70 disabled:shadow-none"
            >
              {nextButtonLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center justify-self-end gap-1.5 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-900/30 hover:from-indigo-800 hover:to-indigo-700"
            >
              <Rocket className="h-4 w-4" />
              {isEditing ? "Save Changes" : "Create Project"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
