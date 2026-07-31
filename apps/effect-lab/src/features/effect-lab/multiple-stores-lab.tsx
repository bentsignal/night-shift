import { createComponent } from "@night-shift/effect-react";

import { FullyProvidedDashboard } from "../../../../../shared/effect-react/example/multiple-stores";

const providerSteps = [
  { name: "Viewer", remaining: "Theme + Workspace" },
  { name: "Theme", remaining: "Workspace" },
  { name: "Workspace", remaining: "none" },
] as const;

export const MultipleStoresLab = createComponent({
  ui: () => (
    <div className="lab-shell">
      <header className="topbar">
        <div className="wordmark">
          <span className="wordmark-mark">E</span>
          <span>effect / react</span>
        </div>
        <nav aria-label="Lab examples" className="lab-nav">
          <a href="/">counter</a>
          <a href="/multiple-stores">three stores</a>
        </nav>
        <div className="topbar-status">
          <span>LAB 02</span>
          <span className="divider" />
          <span>NESTED PROVIDERS</span>
        </div>
      </header>

      <main className="multi-store-workspace">
        <section className="multi-store-stage">
          <header>
            <p className="eyebrow">Resolved output</p>
            <h1>Three stores</h1>
          </header>
          <div className="multi-store-output">
            <FullyProvidedDashboard />
          </div>
        </section>

        <aside className="provider-stack">
          <header>
            <p className="eyebrow">Requirement ladder</p>
            <h2>Providers</h2>
          </header>
          <ol>
            {providerSteps.map((step, index) => (
              <li key={step.name}>
                <span className="provider-index">0{index + 1}</span>
                <span className="provider-name">{step.name}</span>
                <span className="provider-remaining">{step.remaining}</span>
              </li>
            ))}
          </ol>
          <div className="provider-result">
            <span>Final requirement</span>
            <strong>never</strong>
          </div>
        </aside>
      </main>

      <footer className="lab-footer">
        <span>3 stores</span>
        <span className="footer-line" />
        <span>3 provider boundaries</span>
      </footer>
    </div>
  ),
});
