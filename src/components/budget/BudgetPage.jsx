import { useMemo } from "react";
import { Wallet } from "lucide-react";
import { formatUsdBudget } from "../../lib/formatCurrency";
import { filterActiveProjects } from "../../lib/projectUtils";

function formatBudgetValue(value) {
  if (!value) return "—";
  return formatUsdBudget(value) || value;
}

export default function BudgetPage({ projects = [] }) {
  const rows = useMemo(() => {
    return filterActiveProjects(projects).map((project) => ({
      id: project.id,
      name: project.projectName ?? project.name ?? "Untitled project",
      estimated: project.team?.estimatedBudget ?? "",
      revenueGoal: project.kpis?.revenueGoal ?? "",
    }));
  }, [projects]);

  return (
    <div className="mx-auto max-w-[1600px]">
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 p-6 shadow-sm">
        <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 text-base font-bold text-emerald-800 ring-1 ring-emerald-500/15">
          <Wallet className="h-5 w-5" />
          Budget
        </div>
        <p className="mt-3 max-w-xl text-sm font-semibold text-slate-600">
          Estimated budgets and revenue goals from your active projects.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-sm font-medium text-slate-500">
          No active projects with budget data yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Estimated budget</th>
                <th className="px-4 py-3">Revenue goal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {formatBudgetValue(row.estimated)}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {formatBudgetValue(row.revenueGoal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
