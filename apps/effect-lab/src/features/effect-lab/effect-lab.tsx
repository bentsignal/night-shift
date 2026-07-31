import { createComponent } from "@night-shift/effect-react";

import { CounterInstrument } from "./counter";
import { RuntimeTrace } from "./runtime-trace";

export const WorkspaceFrame = createComponent({
  displayName: "WorkspaceFrame",
  ui: () => (
    <main className="workspace">
      <CounterInstrument />
      <RuntimeTrace />
    </main>
  ),
});

export const EffectLab = createComponent({
  displayName: "EffectLab",
  ui: () => (
    <div className="lab-shell">
      <header className="topbar">
        <div className="wordmark">
          <span className="wordmark-mark">E</span>
          <span>effect / react</span>
        </div>
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
