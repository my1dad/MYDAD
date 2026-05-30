export const PROJECT_TEMPLATE_MODES = [
  { id: "blank", label: "Blank" },
  { id: "ui_ux", label: "UI/UX Template" },
];

/**
 * OverDrive OS 4-Phase Development Roadmap — question bank from
 * new project template/OverDrive_OS_4_Phase_Development_Roadmap.pdf
 */
export const UI_UX_ROADMAP_TEMPLATE = [
  {
    phaseId: "foundation",
    phaseLabel: "Phase 1 — Foundation",
    phaseSummary: "Project discovery, AI setup, branding, dev environment, architecture, and storage.",
    sections: [
      {
        id: "discovery",
        title: "Project Discovery & Strategic Planning",
        questions: [
          { id: "p1-discovery-1", text: "Define business objective, target user, and revenue model." },
          { id: "p1-discovery-2", text: "Identify operational pain points the system solves." },
          { id: "p1-discovery-3", text: "Define project scope, MVP requirements, and feature priorities." },
          {
            id: "p1-discovery-4",
            text: "Create a competitor benchmark document to compare UI/UX, pricing, and workflows from competing platforms.",
            suggestion: true,
          },
        ],
      },
      {
        id: "ai-agent",
        title: "AI Agent Initialization",
        questions: [
          { id: "p1-ai-1", text: "Create master Idea.txt / Prompt.txt file for AI development agents." },
          {
            id: "p1-ai-2",
            text: "Write complete system prompt covering architecture, tone, branding, UI/UX standards, folder structure, and deployment goals.",
          },
          { id: "p1-ai-3", text: "Document coding standards and component naming conventions." },
          {
            id: "p1-ai-4",
            text: "Build reusable AI prompt templates for future projects to accelerate onboarding.",
            suggestion: true,
          },
        ],
      },
      {
        id: "branding",
        title: "Branding & Naming",
        questions: [
          { id: "p1-brand-1", text: "Research domain availability." },
          { id: "p1-brand-2", text: "Research trademark availability." },
          { id: "p1-brand-3", text: "Reserve social handles." },
          { id: "p1-brand-4", text: "Design logo system, typography, iconography, and color palette." },
          { id: "p1-brand-5", text: "Create favicon and app icon set." },
          {
            id: "p1-brand-6",
            text: "Create a lightweight branding guideline PDF for internal consistency.",
            suggestion: true,
          },
        ],
      },
      {
        id: "dev-env",
        title: "Development Environment Setup",
        questions: [
          { id: "p1-dev-1", text: "Initialize GitHub repository." },
          { id: "p1-dev-2", text: "Create root folder structure." },
          { id: "p1-dev-3", text: "Configure environment variables." },
          { id: "p1-dev-4", text: "Connect Vercel deployment pipeline." },
          { id: "p1-dev-5", text: "Set up staging and production environments." },
          {
            id: "p1-dev-6",
            text: "Create reusable boilerplate repositories for future deployments.",
            suggestion: true,
          },
        ],
      },
      {
        id: "architecture",
        title: "Architecture & Navigation",
        questions: [
          { id: "p1-arch-1", text: "Define navigation hierarchy and page relationships." },
          { id: "p1-arch-2", text: "Create wireframes for desktop and mobile." },
          { id: "p1-arch-3", text: "Develop Home Dashboard functionality." },
          { id: "p1-arch-4", text: "Create modular layout architecture." },
          {
            id: "p1-arch-5",
            text: "Build a universal sidebar/navigation component reusable across all systems.",
            suggestion: true,
          },
        ],
      },
      {
        id: "storage",
        title: "Storage & Data Systems",
        questions: [
          { id: "p1-storage-1", text: "Install local storage systems and memory bins." },
          { id: "p1-storage-2", text: "Set up file upload architecture." },
          { id: "p1-storage-3", text: "Create local cache handling." },
          { id: "p1-storage-4", text: "Build temporary object storage system." },
          {
            id: "p1-storage-5",
            text: "Create structured JSON schemas for all future modules and data inputs.",
            suggestion: true,
          },
        ],
      },
    ],
  },
  {
    phaseId: "core",
    phaseLabel: "Phase 2 — Core Features",
    phaseSummary: "Page specs, module development, frontend integration, and QA.",
    sections: [
      {
        id: "page-spec",
        title: "Page Specification & UI/UX",
        questions: [
          { id: "p2-spec-1", text: "Spec out every page with detailed component structure." },
          { id: "p2-spec-2", text: "Define dashboard widgets, cards, forms, and metrics." },
          { id: "p2-spec-3", text: "Design responsive layouts for desktop, tablet, and mobile." },
          {
            id: "p2-spec-4",
            text: "Create UI state maps for loading, errors, empty states, and success confirmations.",
            suggestion: true,
          },
        ],
      },
      {
        id: "modules",
        title: "Module Development",
        questions: [
          { id: "p2-mod-1", text: "Develop operational modules and submission systems." },
          { id: "p2-mod-2", text: "Create CRUD operations for all major workflows." },
          { id: "p2-mod-3", text: "Implement reusable modal systems and popups." },
          { id: "p2-mod-4", text: "Develop search, filters, and sorting systems." },
          {
            id: "p2-mod-5",
            text: "Build a permissions matrix for future admin/user role control.",
            suggestion: true,
          },
        ],
      },
      {
        id: "frontend",
        title: "Frontend System Integration",
        questions: [
          { id: "p2-fe-1", text: "Implement responsive web versions." },
          { id: "p2-fe-2", text: "Optimize animations and transitions." },
          { id: "p2-fe-3", text: "Create dark/light mode architecture." },
          {
            id: "p2-fe-4",
            text: "Develop a shared design-system library for buttons, forms, tables, and cards.",
            suggestion: true,
          },
        ],
      },
      {
        id: "testing",
        title: "Testing & Version Control",
        questions: [
          { id: "p2-test-1", text: "Push updates to GitHub." },
          { id: "p2-test-2", text: "Deploy preview builds to Vercel." },
          { id: "p2-test-3", text: "Conduct browser compatibility testing." },
          { id: "p2-test-4", text: "Track bugs and UI inconsistencies." },
          {
            id: "p2-test-5",
            text: "Create a dedicated QA checklist before every deployment.",
            suggestion: true,
          },
        ],
      },
    ],
  },
  {
    phaseId: "integrations",
    phaseLabel: "Phase 3 — Integrations",
    phaseSummary: "Auth, third-party APIs, search, and infrastructure monitoring.",
    sections: [
      {
        id: "auth",
        title: "Authentication & Security",
        questions: [
          { id: "p3-auth-1", text: "Implement login and admin systems." },
          { id: "p3-auth-2", text: "Configure session handling and token authentication." },
          { id: "p3-auth-3", text: "Create password reset and recovery systems." },
          {
            id: "p3-auth-4",
            text: "Add role-based access control (RBAC) for internal teams and clients.",
            suggestion: true,
          },
        ],
      },
      {
        id: "apis",
        title: "Third-Party APIs",
        questions: [
          { id: "p3-api-1", text: "Integrate Google APIs." },
          { id: "p3-api-2", text: "Integrate Apple authentication." },
          { id: "p3-api-3", text: "Configure email systems." },
          { id: "p3-api-4", text: "Connect external CRM/ERP systems if needed." },
          {
            id: "p3-api-5",
            text: "Build a centralized API management dashboard to monitor usage and failures.",
            suggestion: true,
          },
        ],
      },
      {
        id: "search",
        title: "Search & Internal Indexing",
        questions: [
          { id: "p3-search-1", text: "Build local search engine bins." },
          { id: "p3-search-2", text: "Index uploaded files and records." },
          { id: "p3-search-3", text: "Optimize query performance." },
          {
            id: "p3-search-4",
            text: "Add semantic search support for AI-powered retrieval.",
            suggestion: true,
          },
        ],
      },
      {
        id: "infra",
        title: "Infrastructure & Monitoring",
        questions: [
          { id: "p3-infra-1", text: "Deploy production infrastructure." },
          { id: "p3-infra-2", text: "Implement logging and monitoring." },
          { id: "p3-infra-3", text: "Create deployment rollback systems." },
          {
            id: "p3-infra-4",
            text: "Add uptime monitoring and automated alerts.",
            suggestion: true,
          },
        ],
      },
    ],
  },
  {
    phaseId: "scale",
    phaseLabel: "Phase 4 — Scale & Optimize",
    phaseSummary: "Audit, deployment QA, portfolio marketing, and scaling infrastructure.",
    sections: [
      {
        id: "audit",
        title: "Audit & Optimization",
        questions: [
          { id: "p4-audit-1", text: "Audit web and app versions for bugs and inconsistencies." },
          { id: "p4-audit-2", text: "Optimize loading performance." },
          { id: "p4-audit-3", text: "Refactor duplicated code." },
          { id: "p4-audit-4", text: "Improve accessibility and SEO." },
          {
            id: "p4-audit-5",
            text: "Run Lighthouse audits and performance benchmarks monthly.",
            suggestion: true,
          },
        ],
      },
      {
        id: "deployment",
        title: "Final Deployment & QA",
        questions: [
          { id: "p4-deploy-1", text: "Conduct full deployment tests." },
          { id: "p4-deploy-2", text: "Validate production API keys and services." },
          { id: "p4-deploy-3", text: "Verify mobile responsiveness." },
          { id: "p4-deploy-4", text: "Test edge cases and fail states." },
          {
            id: "p4-deploy-5",
            text: "Create automated backup and disaster recovery procedures.",
            suggestion: true,
          },
        ],
      },
      {
        id: "portfolio",
        title: "Portfolio & Marketing",
        questions: [
          { id: "p4-portfolio-1", text: "Add project to OverDrive OS portfolio." },
          { id: "p4-portfolio-2", text: "Create branding look sheet." },
          {
            id: "p4-portfolio-3",
            text: "Prepare logo spreads, typography references, and color palettes.",
          },
          { id: "p4-portfolio-4", text: "Create launch screenshots and presentation assets." },
          {
            id: "p4-portfolio-5",
            text: "Develop a case-study template for client acquisition and investor presentations.",
            suggestion: true,
          },
        ],
      },
      {
        id: "scaling",
        title: "Scaling Infrastructure",
        questions: [
          { id: "p4-scale-1", text: "Prepare infrastructure for larger user volumes." },
          { id: "p4-scale-2", text: "Optimize database queries and caching." },
          { id: "p4-scale-3", text: "Prepare SaaS subscription architecture if needed." },
          {
            id: "p4-scale-4",
            text: "Create internal analytics dashboards to track usage, retention, and system health.",
            suggestion: true,
          },
        ],
      },
    ],
  },
];

export function getUiUxTemplateQuestionIds() {
  return UI_UX_ROADMAP_TEMPLATE.flatMap((phase) =>
    phase.sections.flatMap((section) => section.questions.map((q) => q.id))
  );
}

export function emptyUiUxTemplateAnswers() {
  return Object.fromEntries(getUiUxTemplateQuestionIds().map((id) => [id, ""]));
}
