import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

function App() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="site-header">
        <p className="site-title">Portfolio</p>
        <nav aria-label="Primary navigation">
          <ul>
            <li>
              <a href="#work">Work</a>
            </li>
            <li>
              <a href="#about">About</a>
            </li>
            <li>
              <a href="#contact">Contact</a>
            </li>
          </ul>
        </nav>
      </header>
      <main id="main-content">
        <section id="work" aria-labelledby="work-heading">
          <h1 id="work-heading">Work</h1>
        </section>
        <section id="about" aria-labelledby="about-heading">
          <h2 id="about-heading">About</h2>
        </section>
        <section id="contact" aria-labelledby="contact-heading">
          <h2 id="contact-heading">Contact</h2>
        </section>
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
