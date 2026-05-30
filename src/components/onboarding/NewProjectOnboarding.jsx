import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Layers,
  Rocket,
  Target,
  Users,
  X,
} from "lucide-react";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import TagInput from "../ui/TagInput";
import PhaseCard from "./PhaseCard";
import PhaseThumbnailCard from "./PhaseThumbnailCard";
import UiUxTemplateForm from "./UiUxTemplateForm";
import {
  clearOnboardingDraft,
} from "../../lib/projectStorage";
import { emptyPhase, getNextProjectId, normalizePhase, projectToForm } from "../../lib/projectUtils";
import {
  buildDescriptionFromUiUxTemplate,
  buildPhasesFromUiUxTemplate,
} from "../../lib/uiUxTemplateGenerator";
import {
  emptyUiUxTemplateAnswers,
  PROJECT_TEMPLATE_MODES,
} from "../../data/uiUxRoadmapTemplate";
import { useTeam } from "../../context/TeamContext";
import { onboardingFieldVariant, onboardingShell } from "./onboardingTheme";

const FIELD = onboardingFieldVariant;

const STEPS = [
  { id: 1, label: "Project Foundation", icon: Rocket },
  { id: 2, label: "Roadmap Phases", icon: Layers },
  { id: 3, label: "Team & Timeline", icon: Users },
  { id: 4, label: "KPIs & Success Metrics", icon: Target },
  { id: 5, label: "Review & Create", icon: CheckCircle2 },
];

const PHASE_DEFS = [
  { id: "foundation", title: "Foundation" },
  { id: "core", title: "Core Features" },
  { id: "integrations", title: "Integrations" },
  { id: "scale", title: "Scale & Optimization" },
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
  return { ...form, phases };
}

function ReviewSection({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-800">{title}</h4>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-200 py-2 last:border-0">
      <span className="text-xs font-semibold text-slate-700">{label}</span>
      <span className="text-right text-xs font-bold text-slate-950">{value || "—"}</span>
    </div>
  );
}

export default function NewProjectOnboarding({ open, onClose, onSubmit, editingProject, projects = [] }) {
  const isEditing = Boolean(editingProject);
  const { members } = useTeam();
  const optionalTeamMembers = useMemo(
    () => members.filter((member) => member.id !== "enis"),
    [members]
  );
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [selectedPhaseId, setSelectedPhaseId] = useState("foundation");
  const [templateMode, setTemplateMode] = useState("blank");
  const [templateAnswers, setTemplateAnswers] = useState(emptyUiUxTemplateAnswers);
  const [activeTemplatePhaseId, setActiveTemplatePhaseId] = useState("foundation");
  const [generateError, setGenerateError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(initialForm());
      setStep(1);
      setSelectedPhaseId("foundation");
      setTemplateMode("blank");
      setTemplateAnswers(emptyUiUxTemplateAnswers());
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
    setForm({
      ...initialForm(),
      foundation: {
        ...initialForm().foundation,
        projectId: getNextProjectId("internal", projects),
      },
    });
    setStep(1);
    setSelectedPhaseId("foundation");
  }, [open, editingProject, projects]);

  const { foundation, phases, team, kpis } = form;

  const selectedPhase = PHASE_DEFS.find((p) => p.id === selectedPhaseId) ?? PHASE_DEFS[0];
  const selectedPhaseHasTask = (phases[selectedPhaseId]?.tasks?.length ?? 0) > 0;

  const phasesMissingTasks = useMemo(
    () => PHASE_DEFS.filter((phase) => !(phases[phase.id]?.tasks?.length > 0)),
    [phases]
  );

  const allPhasesHaveTasks = phasesMissingTasks.length === 0;

  const templateGenerated = allPhasesHaveTasks;

  const canGoNext =
    (step !== 2 || selectedPhaseHasTask) &&
    (step !== 1 || templateMode === "blank" || templateGenerated);

  const nextStepHint =
    step === 1 && templateMode === "ui_ux" && !templateGenerated
      ? "Fill out the template and click Generate, or switch back to Blank"
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

  const updateTeam = (field, value) =>
    setForm((f) => ({ ...f, team: { ...f.team, [field]: value } }));

  const toggleMember = (id) => {
    setForm((f) => {
      const members = f.team.teamMembers.includes(id)
        ? f.team.teamMembers.filter((m) => m !== id)
        : [...f.team.teamMembers, id];
      return { ...f, team: { ...f.team, teamMembers: members } };
    });
  };

  const updateKpis = (field, value) =>
    setForm((f) => ({ ...f, kpis: { ...f.kpis, [field]: value } }));

  const handleClose = () => {
    if (!isEditing) clearOnboardingDraft();
    onClose();
  };

  const handleSubmit = () => {
    const foundationFields = { ...form.foundation };
    delete foundationFields.projectId;
    const id = isEditing
      ? editingProject.id
      : getNextProjectId(foundation.clientType, projects);

    const project = {
      id,
      ...foundationFields,
      phases: form.phases,
      team: {
        ...form.team,
        teamMembers: form.team.teamMembers.map(
          (id) => members.find((m) => m.id === id)
        ),
      },
      kpis: form.kpis,
      color: isEditing ? editingProject.color : undefined,
      createdAt: isEditing ? editingProject.createdAt : new Date().toISOString(),
    };
    onSubmit?.(project, { isEditing });
    if (!isEditing) clearOnboardingDraft();
    setStep(1);
    setForm(initialForm());
    onClose();
  };

  const next = () => {
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
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const handleTemplateModeChange = (mode) => {
    setTemplateMode(mode);
    setGenerateError("");

    if (mode === "blank") {
      setTemplateAnswers(emptyUiUxTemplateAnswers());
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
    setTemplateAnswers(emptyUiUxTemplateAnswers());
  };

  const handleTemplateAnswerChange = (questionId, value) => {
    setTemplateAnswers((prev) => ({ ...prev, [questionId]: value }));
    setGenerateError("");
  };

  const handleGenerateFromTemplate = () => {
    if (!foundation.projectName.trim()) {
      setGenerateError("Enter a project name before generating.");
      return;
    }

    setIsGenerating(true);
    setGenerateError("");

    const generatedPhases = buildPhasesFromUiUxTemplate(templateAnswers);
    const description = buildDescriptionFromUiUxTemplate(
      templateAnswers,
      foundation.projectName
    );

    setForm((f) => ({
      ...f,
      foundation: {
        ...f.foundation,
        description: description || f.foundation.description,
      },
      phases: generatedPhases,
    }));
    setSelectedPhaseId("foundation");
    setStep(2);
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
          step === 1 && templateMode === "ui_ux" ? "max-w-5xl" : "max-w-4xl",
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
            {STEPS.map((s, i) => {
              const done = step > s.id;
              const active = step === s.id;
              return (
                <div key={s.id} className="flex flex-1 items-center gap-1">
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
                      {done ? <Check className="h-3.5 w-3.5" /> : s.id}
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
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "mb-4 h-px flex-1",
                        step > s.id ? "bg-indigo-400" : "bg-slate-600"
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

              <div className="grid grid-cols-2 gap-4">
                <Input
                  variant={FIELD}
                  label="Project ID"
                  id="projectId"
                  placeholder="e.g. N-0001"
                  value={foundation.projectId}
                  readOnly
                  className="opacity-80"
                />
                <Select
                  variant={FIELD}
                  label="Project Type"
                  id="projectType"
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
                    answers={templateAnswers}
                    onAnswerChange={handleTemplateAnswerChange}
                    activePhaseId={activeTemplatePhaseId}
                    onPhaseChange={setActiveTemplatePhaseId}
                    onGenerate={handleGenerateFromTemplate}
                    generateError={generateError}
                    isGenerating={isGenerating}
                  />
                </>
              )}
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm font-medium text-slate-800">
                Select a phase to configure. Break each roadmap phase into scheduled tasks
                with titles, details, and dates.
              </p>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {PHASE_DEFS.map((phase) => (
                  <PhaseThumbnailCard
                    key={phase.id}
                    phase={phase}
                    data={phases[phase.id]}
                    selected={selectedPhaseId === phase.id}
                    incomplete={!(phases[phase.id]?.tasks?.length > 0)}
                    onSelect={() => setSelectedPhaseId(phase.id)}
                  />
                ))}
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
                phase={PHASE_DEFS.find((p) => p.id === selectedPhaseId) ?? PHASE_DEFS[0]}
                data={phases[selectedPhaseId]}
                onChange={(data) => updatePhase(selectedPhaseId, data)}
                projectName={foundation.projectName || "New project"}
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

              {optionalTeamMembers.length > 0 && (
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-900">Team Members</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {optionalTeamMembers.map((member) => (
                    <label
                      key={member.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
                        team.teamMembers.includes(member.id)
                          ? "border-indigo-700 bg-indigo-100"
                          : "border-slate-400 bg-white hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={team.teamMembers.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                        className="h-4 w-4 rounded accent-indigo-700"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                        <p className="text-[10px] font-medium text-slate-600">{member.role}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              )}

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
                placeholder="e.g. $50,000"
                value={team.estimatedBudget}
                onChange={(e) => updateTeam("estimatedBudget", e.target.value)}
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
                placeholder="e.g. $100,000 ARR"
                value={kpis.revenueGoal}
                onChange={(e) => updateKpis("revenueGoal", e.target.value)}
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
            <div className="space-y-4">
              <ReviewSection title="Project Foundation">
                <ReviewRow label="Project ID" value={foundation.projectId} />
                <ReviewRow label="Name" value={foundation.projectName} />
                <ReviewRow
                  label="Type"
                  value={PROJECT_TYPE_LABELS[foundation.projectType] ?? foundation.projectType}
                />
                <ReviewRow label="Category" value={foundation.clientType} />
                <ReviewRow label="Priority" value={foundation.priority} />
                <ReviewRow label="Launch Date" value={foundation.targetLaunchDate} />
                <ReviewRow label="Description" value={foundation.description} />
              </ReviewSection>

              <ReviewSection title="Roadmap Phases">
                {PHASE_DEFS.map((p) => {
                  const phase = phases[p.id];
                  const tasks = phase.tasks ?? [];
                  const attachmentCount = phase.attachments?.length ?? 0;
                  return (
                    <div key={p.id} className="border-b border-slate-200 py-2 last:border-0">
                      <div className="flex justify-between gap-4">
                        <span className="text-xs font-bold text-slate-900">{p.title}</span>
                        <span className="text-xs font-semibold text-slate-700">
                          {tasks.length} task{tasks.length !== 1 ? "s" : ""} ·{" "}
                          {attachmentCount} attachment{attachmentCount !== 1 ? "s" : ""} ·{" "}
                          {phase.status.replace("_", " ")}
                        </span>
                      </div>
                      {tasks.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {tasks.map((task) => (
                            <li
                              key={task.id}
                              className="flex justify-between gap-3 text-[11px] font-medium text-slate-700"
                            >
                              <span className="truncate">{task.title || "Untitled task"}</span>
                              <span className="shrink-0 text-right">
                                {task.endDate ? `due ${task.endDate}` : "—"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </ReviewSection>

              <ReviewSection title="Team & Timeline">
                <ReviewRow label="Owner" value={team.projectOwner} />
                <ReviewRow
                  label="Team"
                  value={`${team.teamMembers.length} member(s) selected`}
                />
                <ReviewRow label="Sprint" value={team.sprintLength.replace("_", " ")} />
                <ReviewRow label="Timeline" value={team.timelineType} />
                <ReviewRow label="Budget" value={team.estimatedBudget} />
              </ReviewSection>

              <ReviewSection title="KPIs">
                <ReviewRow
                  label="Metrics"
                  value={kpis.successMetrics.join(", ") || "None"}
                />
                <ReviewRow label="Revenue Goal" value={kpis.revenueGoal} />
                <ReviewRow label="Risk" value={kpis.riskLevel} />
                <ReviewRow label="User Volume" value={kpis.expectedUserVolume.replace("_", " ")} />
              </ReviewSection>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn("flex items-center justify-between px-6 py-4", onboardingShell.footer)}>
          <button
            type="button"
            onClick={step === 1 ? handleClose : back}
            className="flex items-center gap-1.5 rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 5 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canGoNext}
              title={nextStepHint ?? undefined}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-900/30 hover:from-indigo-800 hover:to-indigo-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:opacity-70 disabled:shadow-none"
            >
              {nextButtonLabel}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-700 to-indigo-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-indigo-900/30 hover:from-indigo-800 hover:to-indigo-700"
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
