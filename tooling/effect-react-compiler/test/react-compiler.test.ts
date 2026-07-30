import type { LoggerEvent } from "babel-plugin-react-compiler";
import { transformAsync } from "@babel/core";
import reactCompiler from "babel-plugin-react-compiler";
import { describe, expect, it } from "vitest";

import { lowerEffectReactSources } from "../src";

describe("React Compiler lowering", () => {
  it("compiles component views, returned state hooks, and provider hooks", async () => {
    const source = `
      import { useState } from "react";
      import { Effect } from "effect";
      import {
        createComponent,
        createStore,
      } from "@night-shift/effect-react";

      const counter = createStore("Counter")<{ count: number }>();

      const CounterValue = createComponent({
        state: Effect.gen(function* () {
          const useCounter = yield* counter.service;
          return function useCounterValue() {
            const count = useCounter((store) => store.count);
            return Effect.succeed({ count });
          };
        }),
        component: ({ state }) => <output>{state.count}</output>,
      });

      function useCounterImplementation() {
        const [count] = useState(0);
        return { count };
      }

      const CounterPanel = createComponent({
        state: Effect.succeed(() => Effect.succeed({})),
        component: () => (
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
    expect(result.code.match(/\b_c\(/gu)).toHaveLength(5);
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

  it("compiles named hooks returned by external Effect state programs", async () => {
    const source = `
      import { useState } from "react";
      import { Effect as Fx } from "effect";

      export const formState = Fx.gen(function* () {
        const useNavigation = yield* Navigation;
        return function useFormState() {
          const navigate = useNavigation();
          const [submitting] = useState(false);
          return Fx.succeed({ navigate, submitting });
        };
      });

      export const unrelated = Other.gen(function* () {
        return function useUnrelatedCallback() {
          return {};
        };
      });
    `;
    const result = await compile(source, "/project/form-state.ts");

    expect(result.lowered).toContain('function useFormState() {\n"use memo";');
    expect(result.lowered).not.toContain(
      'function useUnrelatedCallback() {\n"use memo";',
    );
    expect(result.code).toContain("_c(");
    expect(
      result.events.some(
        (event) =>
          event.kind === "CompileSuccess" &&
          event.fnName === "useFormState" &&
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
