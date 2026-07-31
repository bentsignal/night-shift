import { createComponent } from "@night-shift/effect-react";

import { CounterInstrument } from "./counter";
import { RuntimeTrace } from "./runtime-trace";

export const WorkspaceFrame = createComponent({
  ui: () => (
    <main className="workspace">
      <CounterInstrument />
      <RuntimeTrace />
    </main>
  ),
});

export const EffectLab = createComponent({
  ui: () => (
    <div className="lab-shell">
      <header className="topbar">
        <div className="wordmark">
          <span className="wordmark-mark">E</span>
          <span>effect / react</span>
        </div>
        <nav aria-label="Lab examples" className="lab-nav">
          <a aria-current="page" href="/">
            counter
          </a>
          <a href="/multiple-stores">three stores</a>
          <a href="/props">props</a>
        </nav>
        <div className="topbar-status">
          <span>LAB 01</span>
          <span className="divider" />
          <span>DIRECT JSX</span>
        </div>
      </header>
      <WorkspaceFrame />
      <footer className="lab-footer">
        <span>React boundary</span>
        <span className="footer-line" />
        <span>Effect requirements resolved</span>
      </footer>
    </div>
  ),
});
