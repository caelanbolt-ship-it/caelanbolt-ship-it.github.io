export const site = {
  name: 'Caelan Hartley',
  role: 'Software Engineering @ Western University',
  statement: 'I build agentic AI systems.',
  description:
    'Caelan Hartley, Software Engineering at Western University, builds agentic AI systems. Walkthrough videos of five projects: my-crm, Hush, Golf Event Planner, Assessly and an AI-generated face detector.',
  url: 'https://caelanbolt-ship-it.github.io',
  resume: '/Caelan-Hartley-Resume.pdf',
  email: 'caelanhartley@icloud.com',
  github: 'https://github.com/caelanbolt-ship-it',
  linkedin: 'https://www.linkedin.com/in/chartle22',
} as const;

// Oldest to newest, as dated on the résumé. One line each, no internal details.
export const experience = [
  { company: 'BlackBerry', role: 'Site Reliability Engineering Intern', team: 'Data Operations', start: '2024-05', end: '2024-08' },
  { company: 'Kyndryl', role: 'Application Modernization and Cloud Intern', team: 'Cloud, Data & AI', start: '2025-05', end: '2026-08' },
  { company: 'CIBC', role: 'Application Developer Co-op', team: 'Private Wealth Management Technology', start: '2026-09', end: '2026-12', current: true },
] as const;
