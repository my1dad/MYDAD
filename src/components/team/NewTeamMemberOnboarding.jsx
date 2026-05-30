import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  Mail,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Textarea from "../ui/Textarea";
import { onboardingFieldVariant, onboardingShell } from "../onboarding/onboardingTheme";
import {
  TEAM_DEPARTMENT_OPTIONS,
  TEAM_STATUS_OPTIONS,
  TEAM_STATUS_STYLES,
  buildMemberEmail,
  buildMemberInitials,
  getDepartmentLabel,
  pickMemberColor,
} from "../../data/teamData";
import { useTeam } from "../../context/TeamContext";

const FIELD = onboardingFieldVariant;

const STEPS = [
  { id: 1, label: "Profile", icon: User },
  { id: 2, label: "Role", icon: Briefcase },
  { id: 3, label: "Availability", icon: Users },
  { id: 4, label: "Review & Add", icon: CheckCircle2 },
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

const initialForm = () => ({
  profile: {
    name: "",
    email: "",
  },
  role: {
    title: "",
    department: "engineering",
  },
  availability: {
    status: "available",
    notes: "",
  },
});

function ReviewSection({ title, children }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <h4 className="mb-3 text-xs font-bold uppercase tracking-wide text-emerald-800">{title}</h4>
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

export default function NewTeamMemberOnboarding({ open, onClose, onAdded }) {
  const { members, addMember } = useTeam();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (!open) {
      setForm(initialForm());
      setStep(1);
    }
  }, [open]);

  const previewMember = useMemo(() => {
    const name = form.profile.name.trim() || "New Member";
    return {
      name,
      email: buildMemberEmail(name, form.profile.email),
      role: form.role.title.trim() || "Role not set",
      department: form.role.department,
      initials: buildMemberInitials(name),
      color: pickMemberColor(members),
      status: form.availability.status,
    };
  }, [form, members]);

  const canGoNext =
    step === 1
      ? form.profile.name.trim().length > 0
      : step === 2
        ? form.role.title.trim().length > 0 && Boolean(form.role.department)
        : true;

  if (!open) return null;

  const updateProfile = (field, value) =>
    setForm((current) => ({ ...current, profile: { ...current.profile, [field]: value } }));

  const updateRole = (field, value) =>
    setForm((current) => ({ ...current, role: { ...current.role, [field]: value } }));

  const updateAvailability = (field, value) =>
    setForm((current) => ({
      ...current,
      availability: { ...current.availability, [field]: value },
    }));

  const handleClose = () => onClose?.();

  const handleSubmit = () => {
    const member = addMember({
      name: form.profile.name,
      email: form.profile.email,
      role: form.role.title,
      department: form.role.department,
      status: form.availability.status,
      notes: form.availability.notes,
    });
    onAdded?.(member);
    setForm(initialForm());
    setStep(1);
    onClose?.();
  };

  const next = () => setStep((current) => Math.min(current + 1, 4));
  const back = () => setStep((current) => Math.max(current - 1, 1));

  const statusStyle = TEAM_STATUS_STYLES[previewMember.status];

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
          "relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border",
          onboardingShell.panel
        )}
      >
        <div className={cn("px-6 py-5", onboardingShell.header)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                Over Drive OS
              </p>
              <h2 className="mt-0.5 text-lg font-bold text-white">Add Team Member</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-300">
                Onboard someone to your dashboard in 4 simple steps
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

          <div className="mt-5 flex items-center gap-1">
            {STEPS.map((item, index) => {
              const done = step > item.id;
              const active = step === item.id;
              return (
                <div key={item.id} className="flex flex-1 items-center gap-1">
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold transition",
                        done
                          ? "bg-emerald-500 text-white"
                          : active
                            ? "bg-emerald-500 text-white ring-4 ring-emerald-400/40"
                            : "bg-slate-700 text-slate-300 ring-1 ring-slate-600"
                      )}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : item.id}
                    </div>
                    <span
                      className={cn(
                        "hidden text-[9px] font-semibold sm:block",
                        active ? "text-emerald-300" : "text-slate-400"
                      )}
                    >
                      {item.label.split(" ")[0]}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "mb-4 h-px flex-1",
                        step > item.id ? "bg-emerald-400" : "bg-slate-600"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn("flex-1 overflow-y-auto px-6 py-5", onboardingShell.body)}>
          {step === 1 && (
            <div className="space-y-4">
              <Input
                variant={FIELD}
                label="Full name"
                id="memberName"
                placeholder="e.g. Alex Rivera"
                value={form.profile.name}
                onChange={(e) => updateProfile("name", e.target.value)}
              />
              <Input
                variant={FIELD}
                label="Email"
                id="memberEmail"
                type="email"
                placeholder="alex.rivera@overdrive.os"
                value={form.profile.email}
                onChange={(e) => updateProfile("email", e.target.value)}
              />
              <p className="text-xs text-slate-600">
                Leave email blank to auto-generate one from their name.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Input
                variant={FIELD}
                label="Job title"
                id="memberRole"
                placeholder="e.g. Frontend Engineer"
                value={form.role.title}
                onChange={(e) => updateRole("title", e.target.value)}
              />
              <Select
                variant={FIELD}
                label="Department"
                id="memberDepartment"
                value={form.role.department}
                onChange={(e) => updateRole("department", e.target.value)}
              >
                {TEAM_DEPARTMENT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-900">Status</span>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TEAM_STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updateAvailability("status", option.id)}
                      className={cn(
                        "rounded-xl border py-2.5 text-sm font-semibold transition",
                        form.availability.status === option.id
                          ? "border-emerald-700 bg-emerald-100 text-emerald-950"
                          : "border-slate-400 bg-white text-slate-800 hover:bg-slate-50"
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <Textarea
                variant={FIELD}
                label="Notes (optional)"
                id="memberNotes"
                placeholder="Skills, timezone, focus areas..."
                value={form.availability.notes}
                onChange={(e) => updateAvailability("notes", e.target.value)}
              />
              <p className="text-xs text-slate-600">
                New members start with 0% workload until they are assigned to projects.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ring-2 ring-white"
                    style={{ backgroundColor: previewMember.color }}
                  >
                    {previewMember.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{previewMember.name}</h3>
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                          statusStyle.className
                        )}
                      >
                        {statusStyle.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{previewMember.role}</p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <Mail className="h-3.5 w-3.5" />
                      {previewMember.email}
                    </p>
                  </div>
                </div>
              </div>

              <ReviewSection title="Profile">
                <ReviewRow label="Name" value={form.profile.name} />
                <ReviewRow label="Email" value={previewMember.email} />
              </ReviewSection>

              <ReviewSection title="Role">
                <ReviewRow label="Title" value={form.role.title} />
                <ReviewRow label="Department" value={getDepartmentLabel(form.role.department)} />
              </ReviewSection>

              <ReviewSection title="Availability">
                <ReviewRow label="Status" value={statusStyle.label} />
                <ReviewRow label="Starting workload" value="0%" />
                <ReviewRow label="Notes" value={form.availability.notes} />
              </ReviewSection>
            </div>
          )}
        </div>

        <div className={cn("flex items-center justify-between px-6 py-4", onboardingShell.footer)}>
          <button
            type="button"
            onClick={step === 1 ? handleClose : back}
            className="flex items-center gap-1.5 rounded-xl border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 4 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canGoNext}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-800 hover:to-emerald-700 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 disabled:opacity-70 disabled:shadow-none"
            >
              Next
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-800 hover:to-emerald-700"
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
