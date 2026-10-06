/**
 * Source of truth for the approved CV wayfinding in the 3D portfolio.
 */
export interface CvLandmarkContent {
  id: 'experience' | 'education' | 'skills' | 'contact'
  title: string
  content: string
  roadPosition: Readonly<{ x: number; z: number }>
  side: 'left' | 'right'
}

export const cvLandmarks: readonly CvLandmarkContent[] = [
  {
    id: 'experience',
    title: 'Experience',
    content: 'Game QA + 3D Environment Art\nGame Tester Intern · Vates / EPAM · 2024–2025',
    roadPosition: { x: -6, z: -18 },
    side: 'left',
  },
  {
    id: 'education',
    title: 'Projects',
    content: 'Thesis serious game\nIndependent psychological-horror game',
    roadPosition: { x: 6, z: -6 },
    side: 'right',
  },
  {
    id: 'skills',
    title: 'Skills',
    content: 'Unity · Unreal Engine · JIRA\n3ds Max · Blender',
    roadPosition: { x: -6, z: 6 },
    side: 'left',
  },
  {
    id: 'contact',
    title: 'Contact',
    content: 'Sofía Arauz\nsofia1arauz0@gmail.com',
    roadPosition: { x: 6, z: 18 },
    side: 'right',
  },
]
