/**
 * Dark Queen — site configuration
 */

export interface NavItem {
  label: string;
  href: string;
}

export interface SocialLink {
  /** Shown as the link text, so keep it short. */
  label: string;
  href: string;
}

export const SITE = {
  /** Absolute origin of the deployed site. No trailing slash. */
  url: process.env.SITE_ORIGIN || "http://localhost:4321",
  title: "Dark Queen",
  /** Optional short mark used for the vertical rail and loading screen. */
  titleMark: "DARK QUEEN",
  tagline: "Game QA & 3D Environment Art",
  description:
    "Dark Queen is the creative identity of Sofía Arauz, focused on Game QA and 3D Environment Art.",
  /** BCP 47 language tag, written to <html lang>. */
  lang: "en",
  /** Used for og:locale. */
  locale: "en_US",
  /** Fallback OG image, relative to public/. Used for pages without one. */
  defaultOgImage: "/og-default.png",
} as const;

export const AUTHOR = {
  name: "Sofía Arauz",
  url: "mailto:sofia1arauz0@gmail.com",
  /** One or two sentences. Shown on /about and in structured data. */
  bio: "Sofía Arauz works in Game QA and 3D Environment Art.",
} as const;

export const NAV: NavItem[] = [
  { label: "Blog", href: "/blog" },
  { label: "Tags", href: "/tags" },
  { label: "About", href: "/about" },
];

export const SOCIAL: SocialLink[] = [];

export const BLOG = {
  /**
   * Posts per page on /blog and the tag archives. Deliberately low so that the
   * bundled sample posts spill onto a second page; 8–12 suits a real archive.
   */
  postsPerPage: 4,
  /** Latest posts shown on the home page. */
  postsOnHome: 4,
  /** Estimated reading speed used for the "N min read" label. */
  wordsPerMinute: 220,
  showReadingTime: true,
  /** Render the table of contents on article pages. */
  showTableOfContents: true,
  /** Minimum number of headings before the table of contents appears. */
  tocMinHeadings: 3,
} as const;

/**
 * The WebGL ink simulation.
 *
 * It only ever loads on the home page, is skipped entirely when the visitor
 * prefers reduced motion or the browser lacks WebGL2, and pauses when scrolled
 * out of view. Turn both flags off for a completely JavaScript-free site.
 */
export const INK = {
  /** Full-bleed ink behind the hero. */
  hero: true,
  /** Narrow ink band used as a section transition. */
  divider: true,
  /** Density of each ink splat. Sensible range is 0.3 – 2.5. */
  strength: 1,
  /** Let the ink drift on its own instead of only reacting to the cursor. */
  autoFlow: true,
} as const;

/** Generate a per-article OG image at build time with satori. */
export const OG = {
  enabled: true,
  width: 1200,
  height: 630,
} as const;
