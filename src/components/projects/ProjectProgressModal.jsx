import { X } from "lucide-react";
import {
  calcProgress,
  countProjectTasks,
  getProjectStageColor,
  projectUsesTaskProgress,
} from "../../lib/projectUtils";
import ProjectTaskChecklist from "./ProjectTaskChecklist";

export default function ProjectProgressModal({ project, onClose, onUpdate }) {
  if (!project) return null;

  const color = getProjectStageColor(project);
  const progress = project.progress ?? calcProgress(project.phases);
  const taskDriven = projectUsesTaskProgress(project);
  const { done: tasksDone, total: tasksTotal } = countProjectTasks(project);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[94vh] min-h-[min(720px,94vh)] w-full max-w-[min(1600px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-100 p-6 sm:p-8">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {project.projectName}
              </h2>
              <p className="mt-1.5 text-base text-slate-500">
                {progress}% overall progress
                {taskDriven && (
                  <span className="ml-1 font-semibold text-slate-600">
                    · {tasksDone}/{tasksTotal} tasks
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
              }}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-4 sm:px-8 sm:pb-8 sm:pt-5">
          <ProjectTaskChecklist
            project={project}
            embedded
            onUpdate={(updated) => {
              onUpdate?.(updated);
            }}
          />
        </div>
      </div>
    </div>
  );
}
