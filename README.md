# Over Drive OS — Roadmap Dashboard

A premium SaaS-style project roadmap dashboard built with React, Tailwind CSS, Lucide icons, and Recharts.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- lucide-react
- recharts

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview production build

## Structure

```
src/
  components/
    layout/     Sidebar, Header
    roadmap/    Gantt-style chart
    widgets/    Donut, summary, workload, milestones
    tasks/      Filterable task list
    calendar/   Month view calendar
    ui/         Card, Badge
  data/         Mock data
```

All data is mocked — no backend required.
