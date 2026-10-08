import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { getExternalOrigin } from './src/config'
import { cvDownloads } from './src/content/portfolio'
import { renderPortfolio } from './src/content/renderPortfolio'

const APP_ROOT = fileURLToPath(new URL('.', import.meta.url))
const CV_ROOT = resolve(APP_ROOT, '../../cv')
const CONTENT_PLACEHOLDER = '<!-- portfolio:content -->'
// cv/CONTENT_NOTES.md: bracketed numbers such as "[50]" are unverified drafting
// prompts and must never be published.
const UNVERIFIED_PLACEHOLDER = /\[\d+\]/

interface AvailableCv {
  label: string
  href: string
  path: string
}

/** Why a CV cannot be published, or undefined when it can. */
function cvBlocker(source: string): string | undefined {
  const path = resolve(CV_ROOT, source)
  if (!existsSync(path)) return 'it has not been built'
  const tex = path.replace(/\.pdf$/, '.tex')
  if (existsSync(tex) && UNVERIFIED_PLACEHOLDER.test(readFileSync(tex, 'utf8'))) {
    return 'its .tex source still contains unverified [number] placeholders'
  }
  return undefined
}

/**
 * CV PDFs are gitignored LaTeX outputs: link only the ones that exist and are
 * free of unverified placeholders.
 */
function findAvailableCvs(): AvailableCv[] {
  return cvDownloads.flatMap(({ label, source }) => {
    const path = resolve(CV_ROOT, source)
    return cvBlocker(source) ? [] : [{ label, path, href: `/cv/${basename(path)}` }]
  })
}

/**
 * Renders portfolio copy into index.html at build/dev time and publishes the
 * CV PDFs under stable `/cv/<file>.pdf` URLs.
 */
function portfolioContent(blogOrigin: string | undefined): Plugin {
  return {
    name: 'portfolio-content',
    transformIndexHtml(html) {
      if (!html.includes(CONTENT_PLACEHOLDER)) {
        throw new Error(`index.html is missing the ${CONTENT_PLACEHOLDER} placeholder.`)
      }
      const cvLinks = findAvailableCvs().map(({ label, href }) => ({ label, href }))
      return html.replace(CONTENT_PLACEHOLDER, () => renderPortfolio({ cvLinks, blogOrigin }))
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const cv = findAvailableCvs().find(({ href }) => request.url === href)
        if (!cv) return next()
        response.setHeader('Content-Type', 'application/pdf')
        response.end(readFileSync(cv.path))
      })
    },
    buildStart() {
      for (const { label, source } of cvDownloads) {
        const blocker = cvBlocker(source)
        if (blocker) this.warn(`${label} is not linked: cv/${source} is skipped because ${blocker}.`)
      }
    },
    generateBundle() {
      for (const cv of findAvailableCvs()) {
        this.emitFile({ type: 'asset', fileName: cv.href.slice(1), source: readFileSync(cv.path) })
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, APP_ROOT, 'VITE_')
  return {
    plugins: [portfolioContent(getExternalOrigin(env.VITE_BLOG_ORIGIN))],
  }
})
