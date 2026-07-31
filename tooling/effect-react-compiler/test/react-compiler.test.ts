import type { LoggerEvent } from "babel-plugin-react-compiler";
import { transformAsync } from "@babel/core";
import reactCompiler from "babel-plugin-react-compiler";
import { describe, expect, it } from "vitest";

import { lowerEffectReactSources } from "../src";

describe("React Compiler lowering", () => {
  it("compiles a stateless component without manufacturing state", async () => {
    const source = `
      import { createComponent } from "@night-shift/effect-react";

      const shell = createComponent({
        ui: () => <main />,
      });
    `;
    const result = await compile(source, "/project/stateless.tsx");

    expect(result.lowered).not.toContain("state:");
    expect(result.lowered).toContain('ui: () => { "use memo";');
    expect(result.code).toContain("_c(");
    expect(
      result.events.filter((event) => event.kind === "CompileSuccess"),
    ).toHaveLength(1);
  });

  it("compiles component state, ui, and provider hooks", async () => {
    const source = `
      import { useState } from "react";
      import {
        createComponent,
        createStore,
        useStore,
      } from "@night-shift/effect-react";

      const Counter = createStore<{ count: number }>();

      const CounterValue = createComponent({
        deps: [Counter],
        state: ({ deps }) => ({
          count: useStore(deps.counter, (state) => state.count),
        }),
        ui: ({ state }) => <output>{state.count}</output>,
      });

      function useCounterImplementation() {
        const [count] = useState(0);
        return { count };
      }

      const CounterPanel = createComponent({
        ui: () => (
          <Counter implements={useCounterImplementation}>
            <CounterValue />
          </Counter>
        ),
      });
    `;
    const result = await compile(source, "/project/counter.tsx");

    expect(source).not.toContain('"use memo"');
    expect(result.lowered).toContain('"use memo"');
    expect(result.lowered).toContain(
      'deps: [Counter.__effectReactDependency("counter")]',
    );
    expect(result.lowered).toContain(
      'createStore<{ count: number }>().__effectReactNamed("Counter").__effectReactHot("store:/project/counter.tsx#Counter")',
    );
    expect(result.lowered).toMatch(
      /\.__effectReactNamed\("CounterValue"\)\.__effectReactHot\("component:\/project\/counter\.tsx#CounterValue", \{"state":"[a-f0-9]{16}","ui":"[a-f0-9]{16}"\}\)/u,
    );
    expect(result.lowered).toContain(
      ".__effectReactProvidedRequirements([Counter], CounterValue)",
    );
    expect(result.lowered).toContain(
      "implements={Counter.__effectReactImplementation(useCounterImplementation())}",
    );
    expect(result.code).toContain('from "react/compiler-runtime"');
    expect(result.code.match(/\b_c\(/gu)).toHaveLength(4);
    expect(
      result.events.filter((event) => event.kind === "CompileSuccess"),
    ).toHaveLength(4);
    expect(
      result.events.some(
        (event) =>
          event.kind === "CompileError" || event.kind === "PipelineError",
      ),
    ).toBe(false);
  });

  it("compiles a named state callback without hook naming conventions", async () => {
    const source = `
      import { useState } from "react";
      import { createComponent, createStore } from "@night-shift/effect-react";

      const Navigation = createStore<{ ready: boolean }>();

      function formState({ deps }) {
        const [submitting] = useState(false);
        return { navigationStore: deps.navigation, submitting };
      }

      export const Form = createComponent({
        deps: [Navigation],
        state: formState,
        ui: ({ state }) => <output>{String(state.submitting)}</output>,
      });
    `;
    const result = await compile(source, "/project/form-state.tsx");

    expect(result.lowered).toContain(
      'function formState({ deps }) {\n"use memo";',
    );
    expect(result.code).toContain("_c(");
    expect(
      result.events.some(
        (event) =>
          event.kind === "CompileSuccess" &&
          event.fnName === "formState" &&
          event.memoSlots > 0,
      ),
    ).toBe(true);
  });
});

async function compile(source: string, fileName: string) {
  const events = Array<LoggerEvent>();
  const [lowered] = lowerEffectReactSources([
    {
      fileName,
      source,
    },
  ]).values();
  const result = await transformAsync(lowered?.source ?? source, {
    babelrc: false,
    configFile: false,
    filename: fileName,
    parserOpts: {
      plugins: ["typescript", "jsx"],
    },
    plugins: [
      [
        reactCompiler,
        {
          logger: {
            logEvent: (_fileName: string | null, event: LoggerEvent) => {
              events.push(event);
            },
          },
        },
      ],
    ],
  });

  return {
    code: result?.code ?? "",
    events,
    lowered: lowered?.source ?? source,
  };
}
