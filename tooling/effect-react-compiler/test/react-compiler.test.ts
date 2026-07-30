import type { LoggerEvent } from "babel-plugin-react-compiler";
import { transformAsync } from "@babel/core";
import reactCompiler from "babel-plugin-react-compiler";
import { describe, expect, it } from "vitest";

import { lowerEffectReactSources } from "../src";

describe("React Compiler lowering", () => {
  it("compiles component state, UI, and provider hooks", async () => {
    const source = `
      import { useState } from "react";
      import { Effect } from "effect";
      import {
        createComponent,
        createStore,
        useStoreSelector,
      } from "@night-shift/effect-react";

      const counter = createStore("Counter")<{ count: number }>();

      const CounterValue = createComponent({
        deps: Effect.gen(function* () {
          const store = yield* counter.service;
          return { store };
        }),
        state: ({ deps }) => Effect.succeed({
          count: useStoreSelector(deps.store, (state) => state.count),
        }),
        UI: ({ state }) => <output>{state.count}</output>,
      });

      function useCounterImplementation() {
        const [count] = useState(0);
        return { count };
      }

      const CounterPanel = createComponent({
        state: () => Effect.succeed({}),
        UI: () => (
          <counter.Store implements={useCounterImplementation}>
            <CounterValue />
          </counter.Store>
        ),
      });
    `;
    const result = await compile(source, "/project/counter.tsx");

    expect(source).not.toContain('"use memo"');
    expect(result.lowered).toContain('"use memo"');
    expect(result.lowered).toContain(
      ".__effectReactProvidedRequirements([counter.Store], CounterValue)",
    );
    expect(result.lowered).toContain(
      "implements={counter.Store.__effectReactImplementation(useCounterImplementation())}",
    );
    expect(result.code).toContain('from "react/compiler-runtime"');
    expect(result.code.match(/\b_c\(/gu)).toHaveLength(4);
    expect(
      result.events.filter((event) => event.kind === "CompileSuccess"),
    ).toHaveLength(5);
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
      import { Effect } from "effect";
      import { createComponent } from "@night-shift/effect-react";

      function formState({ deps }) {
        const [submitting] = useState(false);
        return Effect.succeed({ navigate: deps.navigate, submitting });
      }

      export const Form = createComponent({
        deps: Effect.succeed({ navigate: () => {} }),
        state: formState,
        UI: ({ state }) => <output>{String(state.submitting)}</output>,
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
