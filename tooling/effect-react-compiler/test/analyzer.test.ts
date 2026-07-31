import { describe, expect, it } from "vitest";

import { analyzeEffectReact, lowerEffectReactSources } from "../src";

describe("analyzeEffectReact", () => {
  it("propagates nested JSX requirements and subtracts a root provider", () => {
    const analysis = analyzeEffectReact({
      sources: [
        {
          fileName: "/project/counter.tsx",
          source: `
            import { createComponent, createStore } from "@night-shift/effect-react";
            import { Effect } from "effect";

            const counter = createStore("Counter")<{
              count: number;
            }>();

            const Button = createComponent({
              deps: Effect.gen(function* () {
                yield* counter.service;
                return {};
              }),
              state: () => Effect.succeed({}),
              ui: () => <button />,
            });

            const Row = createComponent({
              state: () => Effect.succeed({}),
              ui: () => <Button />,
            });

            const Panel = createComponent({
              state: () => Effect.succeed({}),
              ui: () => (
                <counter.Store implements={() => ({ count: 0 })}>
                  <Row />
                </counter.Store>
              ),
            });

            export function Root() {
              return <Panel />;
            }
          `,
        },
      ],
    });

    expect(requirementsOf(analysis, "Button")).toEqual(["Counter"]);
    expect(requirementsOf(analysis, "Row")).toEqual(["Counter"]);
    expect(requirementsOf(analysis, "Panel")).toEqual([]);
    expect(analysis.diagnostics).toEqual([]);
    expect(analysis.boundaries).toHaveLength(1);
    expect(analysis.boundaries[0]?.requirements).toEqual([]);
  });

  it("subtracts a provider halfway through a nested graph", () => {
    const analysis = analyzeEffectReact({
      sources: [
        {
          fileName: "/project/panel.tsx",
          source: `
            import { createComponent, createStore } from "@night-shift/effect-react";
            import { Effect } from "effect";

            const session = createStore("Session")<{ id: string }>();
            const theme = createStore("Theme")<{ dark: boolean }>();

            const Leaf = createComponent({
              deps: Effect.gen(function* () {
                yield* session.service;
                yield* theme.service;
                return {};
              }),
              state: () => Effect.succeed({}),
              ui: () => <span />,
            });

            const Panel = createComponent({
              state: () => Effect.succeed({}),
              ui: () => (
                <session.Store implements={() => ({ id: "one" })}>
                  <Leaf />
                </session.Store>
              ),
            });

            function Root() {
              return <Panel />;
            }
          `,
        },
      ],
    });

    expect(requirementsOf(analysis, "Leaf")).toEqual(["Session", "Theme"]);
    expect(requirementsOf(analysis, "Panel")).toEqual(["Theme"]);
    expect(analysis.diagnostics).toHaveLength(1);
    expect(analysis.diagnostics[0]).toMatchObject({
      code: "unresolved-root",
    });
    expect(analysis.diagnostics[0]?.message).toContain(
      "Theme via Panel -> Leaf",
    );
  });

  it("subtracts providers only from their JSX subtree", () => {
    const analysis = analyzeEffectReact({
      sources: [
        {
          fileName: "/project/scoped.tsx",
          source: `
            import { createComponent, createStore } from "@night-shift/effect-react";
            import { Effect } from "effect";

            const counter = createStore("Counter")<{ count: number }>();
            const CounterValue = createComponent({
              deps: Effect.gen(function* () {
                yield* counter.service;
                return {};
              }),
              state: () => Effect.succeed({}),
              ui: () => <output />,
            });
            const DirectConsumer = createComponent({
              deps: Effect.gen(function* () {
                yield* counter.service;
                return {};
              }),
              state: () => Effect.succeed({}),
              ui: () => (
                <counter.Store implements={() => ({ count: 0 })}>
                  <CounterValue />
                </counter.Store>
              ),
            });
            const Mixed = createComponent({
              state: () => Effect.succeed({}),
              ui: () => (
                <>
                  <counter.Store implements={() => ({ count: 0 })}>
                    <CounterValue />
                  </counter.Store>
                  <CounterValue />
                </>
              ),
            });
          `,
        },
      ],
    });

    expect(requirementsOf(analysis, "DirectConsumer")).toEqual(["Counter"]);
    expect(requirementsOf(analysis, "Mixed")).toEqual(["Counter"]);
  });

  it("rejects an unresolved ordinary React root", () => {
    const analysis = analyzeEffectReact({
      sources: [
        {
          fileName: "/project/root.tsx",
          source: `
            import { createComponent, createStore } from "@night-shift/effect-react";
            import { Effect } from "effect";

            const auth = createStore("Auth")<{ userId: string }>();
            const Protected = createComponent({
              deps: Effect.gen(function* () {
                yield* auth.service;
                return {};
              }),
              state: () => Effect.succeed({}),
              ui: () => <main />,
            });

            export const App = () => <Protected />;
          `,
        },
      ],
    });

    expect(analysis.hasErrors).toBe(true);
    expect(analysis.diagnostics).toEqual([
      expect.objectContaining({
        code: "unresolved-root",
        message: expect.stringContaining("Auth via Protected"),
      }),
    ]);
  });

  it("detects component cycles without losing propagated requirements", () => {
    const analysis = analyzeEffectReact({
      sources: [
        {
          fileName: "/project/cycle.tsx",
          source: `
            import { createComponent, createStore } from "@night-shift/effect-react";
            import { Effect } from "effect";

            const clock = createStore("Clock")<{ now: number }>();
            const A = createComponent({
              deps: Effect.gen(function* () {
                yield* clock.service;
                return {};
              }),
              state: () => Effect.succeed({}),
              ui: () => <B />,
            });
            const B = createComponent({
              state: () => Effect.succeed({}),
              ui: () => <A />,
            });
          `,
        },
      ],
    });

    expect(requirementsOf(analysis, "A")).toEqual(["Clock"]);
    expect(requirementsOf(analysis, "B")).toEqual(["Clock"]);
    expect(analysis.diagnostics).toEqual([
      expect.objectContaining({
        code: "component-cycle",
        message: expect.stringContaining("A -> B -> A"),
      }),
    ]);
  });

  it("resolves aliased imports and requirements across files", () => {
    const analysis = analyzeEffectReact({
      sources: [
        {
          fileName: "/project/stores.ts",
          source: `
            import { createStore } from "@night-shift/effect-react";
            export const auth = createStore("Auth")<{ userId: string }>();
          `,
        },
        {
          fileName: "/project/button.tsx",
          source: `
            import { createComponent } from "@night-shift/effect-react";
            import { Effect } from "effect";
            import { auth as authentication } from "./stores";

            export const Button = createComponent({
              deps: Effect.gen(function* () {
                yield* authentication.service;
                return {};
              }),
              state: () => Effect.succeed({}),
              ui: () => <button />,
            });
          `,
        },
        {
          fileName: "/project/panel.tsx",
          source: `
            import { createComponent } from "@night-shift/effect-react";
            import { Effect } from "effect";
            import { Button as Action } from "./button";

            export const Panel = createComponent({
              state: () => Effect.succeed({}),
              ui: () => <Action />,
            });
          `,
        },
        {
          fileName: "/project/app.tsx",
          source: `
            import { Panel } from "./panel";
            export function App() {
              return <Panel />;
            }
          `,
        },
      ],
    });

    expect(requirementsOf(analysis, "Button")).toEqual(["Auth"]);
    expect(requirementsOf(analysis, "Panel")).toEqual(["Auth"]);
    expect(analysis.diagnostics[0]?.message).toContain(
      "Auth via Panel -> Button",
    );
    expect(
      analysis.diagnostics.some(
        (diagnostic) => diagnostic.code === "unresolved-analysis-reference",
      ),
    ).toBe(false);
  });
});

describe("lowerEffectReactSources", () => {
  it("makes ordinary JSX children participate in native component inference", () => {
    const [lowered] = lowerEffectReactSources([
      {
        fileName: "/project/example.tsx",
        source: `
          import { createComponent } from "@night-shift/effect-react";
          import { Effect } from "effect";

          const Child = createComponent({
            state: () => Effect.succeed({}),
            ui: () => null,
          });
          const Parent = createComponent({
            state: () => Effect.succeed({}),
            ui: () => <Child />,
          });
        `,
      },
    ]).values();

    expect(lowered?.insertions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: ".__effectReactRequirements(Child).__effectReactAnalyzed()",
        }),
      ]),
    );
    expect(lowered?.source).toContain(
      "}).__effectReactRequirements(Child).__effectReactAnalyzed();",
    );
    expect(lowered?.source).toContain('"use memo"');
  });

  it("lowers provider subtrees into requirement subtraction", () => {
    const [lowered] = lowerEffectReactSources([
      {
        fileName: "/project/provider.tsx",
        source: `
          import { createComponent, createStore } from "@night-shift/effect-react";
          import { Effect } from "effect";

          const counter = createStore("Counter")<{ count: number }>();
          const Child = createComponent({
            deps: Effect.gen(function* () {
              yield* counter.service;
              return {};
            }),
              state: () => Effect.succeed({}),
            ui: () => null,
          });
          const Parent = createComponent({
            state: () => Effect.succeed({}),
            ui: () => (
              <counter.Store implements={() => ({ count: 0 })}>
                <Child />
              </counter.Store>
            ),
          });
        `,
      },
    ]).values();

    expect(lowered?.source).toContain(
      ".__effectReactProvidedRequirements([counter.Store], Child)",
    );
  });
});

function requirementsOf(
  analysis: ReturnType<typeof analyzeEffectReact>,
  name: string,
) {
  return analysis.components.find((component) => component.name === name)
    ?.requirements;
}
