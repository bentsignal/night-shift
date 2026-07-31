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
            const counter = createStore("Counter")<{
              count: number;
            }>();

            const Button = createComponent({
              deps: [counter.store],
              state: () => ({}),
              ui: () => <button />,
            });

            const Row = createComponent({
              state: () => ({}),
              ui: () => <Button />,
            });

            const Panel = createComponent({
              state: () => ({}),
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
            const session = createStore("Session")<{ id: string }>();
            const theme = createStore("Theme")<{ dark: boolean }>();

            const Leaf = createComponent({
              deps: [session.store, theme.store],
              state: () => ({}),
              ui: () => <span />,
            });

            const Panel = createComponent({
              state: () => ({}),
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
            const counter = createStore("Counter")<{ count: number }>();
            const CounterValue = createComponent({
              deps: [counter.store],
              state: () => ({}),
              ui: () => <output />,
            });
            const DirectConsumer = createComponent({
              deps: [counter.store],
              state: () => ({}),
              ui: () => (
                <counter.Store implements={() => ({ count: 0 })}>
                  <CounterValue />
                </counter.Store>
              ),
            });
            const Mixed = createComponent({
              state: () => ({}),
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
            const auth = createStore("Auth")<{ userId: string }>();
            const Protected = createComponent({
              deps: [auth.store],
              state: () => ({}),
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
            const clock = createStore("Clock")<{ now: number }>();
            const A = createComponent({
              deps: [clock.store],
              state: () => ({}),
              ui: () => <B />,
            });
            const B = createComponent({
              state: () => ({}),
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
            import { auth as authentication } from "./stores";

            export const Button = createComponent({
              deps: [authentication.store],
              state: () => ({}),
              ui: () => <button />,
            });
          `,
        },
        {
          fileName: "/project/panel.tsx",
          source: `
            import { createComponent } from "@night-shift/effect-react";
            import { Button as Action } from "./button";

            export const Panel = createComponent({
              state: () => ({}),
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
          const Child = createComponent({
            state: () => ({}),
            ui: () => null,
          });
          const Parent = createComponent({
            state: () => ({}),
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
          const counter = createStore("Counter")<{ count: number }>();
          const Child = createComponent({
            deps: [counter.store],
            state: () => ({}),
            ui: () => null,
          });
          const Parent = createComponent({
            state: () => ({}),
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
