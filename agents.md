# agents.md

## Project purpose

This repository is the professional presence for **Sofía Aráuz**, focused on getting paid work in the videogame industry. The two primary positioning tracks are:

1. **Game QA / Game Testing**
2. **3D Environment Art for games**

Secondary strengths may support those tracks when relevant: Unity, Unreal Engine 5, C#, gameplay implementation, documentation/GDD work, visual design/branding, gaming editorial writing, and independent game development.

The immediate objective is to make the profile easier to hire for and credible for remote/international work. Do not dilute the positioning by presenting every skill with equal weight.

## Repository structure

```text
blog/       Blog site/content
cv/         LaTeX CV sources and generated PDFs
portfolio/  Main portfolio website
```

Keep responsibilities separated between these directories. Avoid duplicating the same source content in several places when a shared source or small data file would be sufficient.

## Source-of-truth rules

Do not invent experience, metrics, clients, job titles, tools, shipped games, responsibilities, or proficiency levels.

Known professional facts that may be used when relevant:

- Game Tester Intern at Vates / EPAM, 2024–2025.
- Functional and exploratory testing on game builds.
- Bug/usability reporting with JIRA.
- Gameplay/player-experience evaluation and collaboration with QA/development teams.
- 3D environment and prop work for indie/collaborative game projects.
- Experience with Unity and Unreal Engine 5.
- 3D tools include 3ds Max and Blender.
- Development experience includes C#.
- Current projects include a thesis serious game and an independent psychological-horror game.
- English is usable for reading/written professional work; spoken English is an active improvement area. Never imply native/fluent spoken English unless that becomes true.

If a claim is uncertain, leave a TODO or ask for confirmation instead of guessing.

## Positioning

### Game QA track

Prefer wording and ordering around:

- Game QA Tester
- Functional Testing
- Exploratory Testing
- Gameplay Testing
- Regression Testing, only when supported by real experience
- Bug Reporting
- JIRA
- Unity / Unreal Engine
- C# as supporting technical context

The QA CV and QA-facing portfolio content should make testing experience obvious within the first few seconds.

### 3D Environment Art track

Prefer wording and ordering around:

- 3D Environment Artist
- Real-time game environments
- Unity / Unreal Engine
- 3ds Max / Blender
- Environment and prop creation
- Scene assembly, lighting, optimization, materials, UVs, LODs, collisions, etc. only when supported by actual work

The art CV and portfolio should emphasize finished visual work and in-engine results rather than long skill lists.

## CV requirements

Maintain **two separate CVs in LaTeX**:

```text
cv/game-qa/
cv/environment-art/
```

Preferred output names:

```text
Sofia_Arauz_Game_QA.pdf
Sofia_Arauz_3D_Environment_Artist.pdf
```

Requirements for both:

- One page whenever practical.
- English-first for international applications.
- ATS-friendly layout.
- No decorative skill bars, star ratings, profile-photo dependency, or multi-column layouts that damage parsing.
- Links must be clickable in the PDF.
- Strongest relevant experience and projects above secondary material.
- Use concise accomplishment/responsibility bullets.
- Do not add fake metrics to make bullets sound stronger.
- Keep typography professional and readable at 100% zoom.
- Build without LaTeX warnings that indicate broken references, overflow, missing fonts, or missing assets.

When changing a CV, compile it and inspect the final PDF, not only the `.tex` source.

## Portfolio requirements

The portfolio should quickly answer:

- What role is Sofía seeking?
- What can she make/test?
- What are her strongest projects?
- What did she personally contribute?
- How can someone contact her?

Primary navigation should make 3D work, game projects, QA/testing, and contact easy to reach.

For project case studies, prefer:

1. Strong final visuals/video.
2. Short project context.
3. Exact responsibilities.
4. Tools/engine.
5. Process or technical breakdown when useful.
6. Clear distinction between personal work and team work.

Do not hide the strongest work behind several clicks. Mobile performance matters. Compress large images/video responsibly and avoid shipping unnecessarily large assets.

## Domain and identity

Use a personal custom domain once purchased. Do not expose a `*.netlify.app` address as the public-facing canonical URL once the custom domain is configured.

Preferred patterns:

```text
https://<personal-domain>/
https://<personal-domain>/blog/
```

A subdomain such as `blog.<personal-domain>` is also acceptable if the deployment architecture makes it materially simpler.

Keep canonical URLs, Open Graph metadata, favicon, sitemap, robots configuration, and redirects consistent with the chosen domain.

## Blog requirements

The blog should support professional credibility rather than become a separate content project with no connection to hiring.

Good topics include:

- Environment-art breakdowns.
- Unity / Unreal implementation notes.
- Lighting and atmosphere studies.
- Game QA workflows.
- Bug-reporting examples using non-confidential/demo projects.
- Development notes from the thesis or personal game when appropriate.

Prefer fewer strong posts over a high posting cadence. Never publish confidential information from previous employers, clients, or collaborators.

## English practice support

When adding interview-prep material to the repo, prioritize spoken professional English for game-industry interviews rather than generic grammar drills.

Useful practice areas:

- 30–60 second self-introduction.
- Explaining a portfolio project.
- Describing a bug and how it was reproduced.
- Discussing collaboration with developers/artists.
- Answering behavioral interview questions.
- Asking clarifying questions naturally.

Favor clear, simple phrasing that is easy to say aloud. Do not optimize scripts for sophisticated vocabulary at the expense of fluency.

## Engineering workflow

Before modifying code:

1. Inspect the local package/build configuration for the relevant directory.
2. Follow the existing framework and formatting conventions.
3. Avoid unnecessary rewrites or dependency additions.
4. Keep credentials, API keys, analytics secrets, and deployment tokens out of the repository.

After modifying code:

1. Run the relevant formatter/linter if configured.
2. Run the relevant build/test command.
3. Check for broken links and asset paths.
4. For visual changes, inspect desktop and mobile layouts.
5. For LaTeX changes, compile and inspect the generated PDF.

## Definition of done

A task is not complete merely because source files were changed. It is complete when the resulting public page or generated document works, is internally consistent, and supports one of the two target professional tracks without overstating experience.
