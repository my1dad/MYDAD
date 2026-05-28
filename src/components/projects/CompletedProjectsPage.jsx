import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, FolderKanban } from "lucide-react";
import {
  filterCompletedProjects,
  isProjectComplete,
  normalizeProject,
  orderProjectsForColorGrid,
} from "../../lib/projectUtils";
import ProjectDetail from "./ProjectDetail";
import { ProjectCard } from "./ProjectsPage";

export default function CompletedProjectsPage({
  projects,
  onBack,
  onUpdateProject,
  onEditProject,
  onDeleteProject,
  onProjectReactivated,
}) {
  const [selectedId, setSelectedId] = useState(null);

  const completedProjects = useMemo(() => filterCompletedProjects(projects), [projects]);
  const selectedProject = completedProjects.find((p) => p.id === selectedId);

  const displayProjects = useMemo(
    () => orderProjectsForColorGrid(completedProjects, 3),
    [completedProjects]
  );

  const handleDelete = (projectId) => {
    onDeleteProject?.(projectId);
    if (selectedId === projectId) setSelectedId(null);
  };

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        onBack={() => setSelectedId(null)}
        onUpdate={(updated) => {
          const normalized = normalizeProject(updated);
          onUpdateProject?.(normalized);
          if (!isProjectComplete(normalized)) {
            setSelectedId(null);
            onProjectReactivated?.();
          }
        }}
        onEdit={onEditProject}
        onDelete={handleDelete}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[1600px]">
      <button
        type="button"
        onClick={onBack}
        className="mb-5 flex items-center gap-1.5 text-sm font-medium text-slate-600 transition hover:text-indigo-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </button>

      <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-white via-white to-emerald-50/50 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-base font-bold text-emerald-700 ring-1 ring-emerald-500/15">
              <CheckCircle2 className="h-5 w-5" />
              Completed Projects
            </div>
            <p className="max-w-xl text-sm font-semibold text-slate-600">
              Finished projects are archived here. Reopen a task to move a project back to the active list.
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white/80 px-4 py-3 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
              Finished
            </p>
            <p className="text-3xl font-bold tabular-nums text-emerald-700">
              {completedProjects.length}
            </p>
          </div>
        </div>
      </div>

      {completedProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-gradient-to-b from-white to-slate-50/80 px-6 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/15">
            <FolderKanban className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No completed projects yet</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
            When every task in a project is finished, it moves here automatically.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {displayProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => setSelectedId(project.id)}
              onEdit={onEditProject}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
