/**
 * Source of truth for every piece of portfolio copy: the HTML page, the
 * proximity cards and the in-world road boards all read from here.
 *
 * Facts come from the two LaTeX CVs in `cv/`. Bracketed CV placeholders such
 * as "[50] build test cycles" are unconfirmed and intentionally omitted.
 */

export type SectionId = 'projects' | 'experience' | 'skills' | 'education' | 'contact'

export interface Project {
  title: string
  /** Short context line: project kind, engine and status. */
  meta: string
  description: string
  /** Sofía's own contribution, stated separately from the team's work. */
  role: string
  tags: readonly string[]
}

export interface ExperienceEntry {
  title: string
  organization: string
  period: string
  highlights: readonly string[]
}

export interface SkillGroup {
  name: string
  items: readonly string[]
}

export interface Language {
  name: string
  level: string
}

export interface CvDownload {
  label: string
  /** PDF path relative to the repository `cv/` directory (a build output). */
  source: string
}

export interface RoadLandmark {
  id: SectionId
  title: string
  /** Short copy painted on the in-world board; the card shows full details. */
  board: string
  /** Route Z plus signed lateral offset from the road centre. */
  roadPosition: Readonly<{ x: number; z: number }>
}

export const profile = {
  name: 'Sofía Arauz',
  role: '3D Environment Artist · Game QA Tester',
  summary:
    'I create 3D environments and props for games, and test game builds to find and report functional, gameplay and usability issues.',
  location: 'Villa Carlos Paz, Córdoba, Argentina',
  // TODO: confirm with Sofía; taken from the project goal in agents.md.
  availability: 'Open to remote and international roles in 3D environment art and game QA.',
  email: 'sofia1arauz0@gmail.com',
  // TODO: add LinkedIn and GitHub profile URLs once supplied; the CVs only
  // carry placeholder labels for them.
} as const

// TODO: add in-engine screenshots or video for each project when available.
export const projects: readonly Project[] = [
  {
    title: 'Custom Rock MC 1%',
    meta: 'Thesis · Serious game · Unity · In development',
    description:
      'Educational serious game based on a real motorcycle club, exploring narrative, realism and cultural representation.',
    role: 'Environment, interaction, gameplay, 3D, UI/UX and programming work.',
    tags: ['Unity', 'Environment art', 'Gameplay', 'UI/UX'],
  },
  {
    title: 'Psychological-horror game',
    meta: 'Solo project · Unity · In development',
    description:
      'Independent psychological-horror game focused on atmosphere, lighting and environmental storytelling.',
    role: 'Game design, environment creation and implementation.',
    tags: ['Unity', 'Environment art', 'Game design'],
  },
  {
    // TODO: replace with the game's real title; the CVs only call it
    // "Indie Game Project".
    title: 'Indie team game',
    meta: 'Team project · Academic · Submitted to EVA',
    description: 'Collaborative academic game submitted to EVA.',
    role:
      '3D environments and props modeled in 3ds Max, plus the title, original concept, visual identity, cover art, loading screens and trailer/promotional materials.',
    tags: ['3ds Max', 'Unity', 'Environment art', 'Props', 'Visual identity'],
  },
]

export const experience: readonly ExperienceEntry[] = [
  {
    title: 'Game Tester Intern',
    organization: 'Vates / EPAM',
    period: '2024–2025',
    highlights: [
      'Functional and exploratory testing on game builds.',
      'Gameplay and player-experience evaluation.',
      'Bug and usability reports in JIRA and testing tools for QA and development follow-up.',
    ],
  },
  {
    title: 'Playtesting',
    organization: 'EPAM',
    period: 'July–August',
    highlights: [],
  },
  {
    title: '3D Environment Artist',
    organization: 'Indie and collaborative projects',
    period: '2023–2025',
    highlights: [
      'Created 3D environments and props for indie and collaborative game projects.',
      'Modeled environments and props in 3ds Max for a team game submitted to EVA.',
      'Built Unity environments for a thesis serious game and a solo psychological-horror game.',
    ],
  },
]

export const skillGroups: readonly SkillGroup[] = [
  { name: '3D art', items: ['3ds Max', 'Blender', 'Environment and prop creation'] },
  { name: 'Game engines', items: ['Unity', 'Unreal Engine 5'] },
  {
    name: 'Game QA',
    items: [
      'Functional testing',
      'Exploratory testing',
      'Gameplay testing',
      'Bug and usability reporting',
      'Player-experience evaluation',
    ],
  },
  { name: 'Workflow', items: ['JIRA', 'Testing tools', 'QA–development collaboration'] },
  { name: 'Development', items: ['C#'] },
  {
    name: 'Visual design',
    items: ['Adobe Photoshop', 'Adobe Illustrator', 'Visual identity', 'Cover art', 'Loading screens'],
  },
]

export const education = {
  degree: 'Tec. en Desarrollo de Videojuegos',
  school: 'IES 21',
  status: 'Coursework completed; thesis in progress',
} as const

export const languages: readonly Language[] = [
  { name: 'Spanish', level: 'Native' },
  { name: 'English', level: 'Upper-intermediate (B2)' },
  { name: 'German', level: 'Basic' },
]

export const cvDownloads: readonly CvDownload[] = [
  { label: '3D Environment Art CV', source: 'environment-art/Sofia_Arauz_Environment_Artist_Game_Developer.pdf' },
  { label: 'Game QA CV', source: 'game-qa/Sofia_Arauz_Game_QA.pdf' },
]

export const sectionTitles: Readonly<Record<SectionId, string>> = {
  projects: 'Projects',
  experience: 'Experience',
  skills: 'Skills',
  education: 'Education',
  contact: 'Contact',
}

/** Strongest work first; contact waits at the end of the road. */
export const roadLandmarks: readonly RoadLandmark[] = [
  {
    id: 'projects',
    title: 'Projects',
    board: 'Custom Rock MC 1% · thesis\nPsychological-horror game · solo\nIndie team game · EVA',
    roadPosition: { x: -7, z: -24 },
  },
  {
    id: 'experience',
    title: 'Experience',
    board: 'Game Tester Intern · Vates / EPAM\n3D Environment Artist · indie projects',
    roadPosition: { x: 7, z: -12 },
  },
  {
    id: 'skills',
    title: 'Skills',
    board: '3ds Max · Blender · Unity · Unreal Engine 5\nFunctional & exploratory testing · JIRA',
    roadPosition: { x: -7, z: 0 },
  },
  {
    id: 'education',
    title: 'Education',
    board: 'Video game development · IES 21\nSpanish · English (B2) · German',
    roadPosition: { x: 7, z: 12 },
  },
  {
    id: 'contact',
    title: 'Contact',
    board: `${profile.email}\nCVs and details below`,
    roadPosition: { x: -7, z: 26 },
  },
]
