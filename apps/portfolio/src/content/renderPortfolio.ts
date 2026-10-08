import {
  education,
  experience,
  languages,
  profile,
  projects,
  sectionTitles,
  skillGroups,
  type SectionId,
} from './portfolio'

export interface PortfolioLink {
  label: string
  href: string
}

export interface RenderPortfolioOptions {
  /** CV PDFs that exist for this build; missing ones are simply not linked. */
  cvLinks?: readonly PortfolioLink[]
  blogOrigin?: string
}

const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ESCAPES[character] ?? character)
}

const list = (items: readonly string[], className: string) =>
  items.length === 0
    ? ''
    : `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`

const externalLink = ({ label, href }: PortfolioLink) =>
  `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`

function renderProjects(): string {
  return projects
    .map(
      (project) => `
        <article class="project">
          <h3>${escapeHtml(project.title)}</h3>
          <p class="meta">${escapeHtml(project.meta)}</p>
          <p>${escapeHtml(project.description)}</p>
          <p class="role"><strong>My role:</strong> ${escapeHtml(project.role)}</p>
          ${list(project.tags, 'tags')}
        </article>`,
    )
    .join('')
}

function renderExperience(): string {
  return experience
    .map(
      (entry) => `
        <article class="entry">
          <h3>${escapeHtml(entry.title)} <span class="organization">· ${escapeHtml(entry.organization)}</span></h3>
          <p class="meta">${escapeHtml(entry.period)}</p>
          ${list(entry.highlights, 'highlights')}
        </article>`,
    )
    .join('')
}

function renderSkills(): string {
  return `<dl class="skill-groups">${skillGroups
    .map((group) => `<div><dt>${escapeHtml(group.name)}</dt><dd>${list(group.items, 'tags')}</dd></div>`)
    .join('')}</dl>`
}

function renderEducation(): string {
  return `
    <article class="entry">
      <h3>${escapeHtml(education.degree)} <span class="organization">· ${escapeHtml(education.school)}</span></h3>
      <p class="meta">${escapeHtml(education.status)}</p>
    </article>
    <h3 class="subheading">Languages</h3>
    <dl class="languages">${languages
      .map((language) => `<div><dt>${escapeHtml(language.name)}</dt><dd>${escapeHtml(language.level)}</dd></div>`)
      .join('')}</dl>`
}

function renderContact({ cvLinks = [], blogOrigin }: RenderPortfolioOptions): string {
  const downloads = cvLinks
    .map(({ label, href }) => `<a class="button" href="${escapeHtml(href)}" download>${escapeHtml(label)} (PDF)</a>`)
    .join('')
  return `
    <p>${escapeHtml(profile.availability)}</p>
    <div class="actions">
      <a class="button primary" href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>
      ${downloads}
    </div>
    <p class="meta">${escapeHtml(profile.location)}${blogOrigin ? ` · ${externalLink({ label: 'Blog', href: blogOrigin })}` : ''}</p>`
}

const sectionBodies: Readonly<Record<SectionId, (options: RenderPortfolioOptions) => string>> = {
  projects: renderProjects,
  experience: renderExperience,
  skills: renderSkills,
  education: renderEducation,
  contact: renderContact,
}

const sectionOrder: readonly SectionId[] = ['projects', 'experience', 'skills', 'education', 'contact']

/**
 * Renders the complete, crawlable page body at build time. The 3D ride is an
 * enhancement layered on the hero; every fact is also present as plain HTML.
 */
export function renderPortfolio(options: RenderPortfolioOptions = {}): string {
  const nav = [
    ...sectionOrder
      .filter((id) => id !== 'education')
      .map((id) => `<a href="#${id}">${escapeHtml(sectionTitles[id])}</a>`),
    ...(options.blogOrigin ? [externalLink({ label: 'Blog', href: options.blogOrigin })] : []),
  ].join('')

  const sections = sectionOrder
    .map(
      (id) => `
      <section class="page-section" id="${id}" aria-labelledby="${id}-title">
        <h2 id="${id}-title">${escapeHtml(sectionTitles[id])}</h2>
        <div class="section-body" data-section="${id}">${sectionBodies[id](options)}</div>
      </section>`,
    )
    .join('')

  return `
    <a class="skip-link" href="#main">Skip to portfolio content</a>
    <header class="hero" id="top">
      <canvas id="portfolio-canvas" aria-label="Interactive ride: a motorcycle on a road lined with portfolio signs"></canvas>
      <div class="hero-top">
        <div class="hero-intro">
          <h1>${escapeHtml(profile.name)}</h1>
          <p class="hero-role">${escapeHtml(profile.role)}</p>
          <p class="hero-summary">${escapeHtml(profile.summary)}</p>
          <div class="actions">
            <a class="button primary" href="#projects">See projects</a>
            <a class="button" href="mailto:${escapeHtml(profile.email)}">Email me</a>
          </div>
        </div>
        <nav class="site-nav" aria-label="Primary">${nav}</nav>
      </div>
      <p class="ride-hint" aria-hidden="true">
        <span class="hint-keys">Ride the road: W / ↑ forward · S / ↓ back · Space stops</span>
        <span class="hint-touch">Hold ▲ / ▼ to ride the road</span>
      </p>
      <a class="scroll-cue" href="#main">Full portfolio ↓</a>
    </header>
    <main id="main" tabindex="-1">${sections}
    </main>
    <footer class="site-footer">
      <p>${escapeHtml(profile.name)} · ${escapeHtml(profile.role)}</p>
      <a href="#top">Back to the ride ↑</a>
    </footer>`
}
