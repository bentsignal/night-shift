import { useState } from "react";

import { createComponent } from "@night-shift/effect-react";

import {
  Greeting,
  GreetingStyle,
} from "../../../../../shared/effect-react/example/props";

const GreetingWorkbench = createComponent({
  state: () => {
    const [name, setName] = useState("Ada");
    const [salutation, setSalutation] = useState("Hello");

    return { name, salutation, setName, setSalutation };
  },
  ui: ({ state }) => (
    <main className="props-workspace">
      <section className="props-stage">
        <header>
          <p className="eyebrow">Rendered component</p>
          <h1>Props + deps</h1>
        </header>

        <div className="props-output">
          <GreetingStyle implements={() => ({ salutation: state.salutation })}>
            <Greeting name={state.name || "Anonymous"} punctuation="!" />
          </GreetingStyle>
        </div>
      </section>

      <aside className="props-controls">
        <header>
          <p className="eyebrow">Live inputs</p>
          <h2>State pipeline</h2>
        </header>

        <label htmlFor="props-name">
          <span>Prop · name</span>
          <input
            id="props-name"
            onChange={(event) => state.setName(event.currentTarget.value)}
            value={state.name}
          />
        </label>

        <label htmlFor="props-salutation">
          <span>Dependency · salutation</span>
          <input
            id="props-salutation"
            onChange={(event) => state.setSalutation(event.currentTarget.value)}
            value={state.salutation}
          />
        </label>

        <ol className="props-pipeline">
          <li>
            <span>01</span>
            props + deps
          </li>
          <li>
            <span>02</span>
            state
          </li>
          <li>
            <span>03</span>
            ui
          </li>
        </ol>
      </aside>
    </main>
  ),
});

export const PropsLab = createComponent({
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
          <a aria-current="page" href="/props">
            props
          </a>
        </nav>
        <div className="topbar-status">
          <span>LAB 03</span>
          <span className="divider" />
          <span>PROPS + DEPS</span>
        </div>
      </header>

      <GreetingWorkbench />

      <footer className="lab-footer">
        <span>Typed JSX props</span>
        <span className="footer-line" />
        <span>Store requirement provided</span>
      </footer>
    </div>
  ),
});
