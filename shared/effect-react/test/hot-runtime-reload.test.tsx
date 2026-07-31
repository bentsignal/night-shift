import { act, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

describe("hot runtime reloads", () => {
  test("updates mounted components across a fresh runtime module instance", async () => {
    vi.resetModules();
    const firstRuntime = await import("../src");
    const storeId = "test:runtime-reload:store";
    const componentId = "test:runtime-reload:component";
    const FirstStore = firstRuntime
      .createStore<{ value: string }>()
      .__effectReactHot(storeId);
    const FirstComponent = firstRuntime
      .createComponent({
        deps: [FirstStore],
        state: ({ deps }) => ({
          value: firstRuntime.useStore(deps.store!, (state) => state.value),
        }),
        ui: ({ state }) => <span>{`Before ${state.value}`}</span>,
      })
      .__effectReactHot(componentId, {
        state: "value-state",
        ui: "before-ui",
      });

    render(
      <FirstStore implements={() => ({ value: "refresh" })}>
        <FirstComponent />
      </FirstStore>,
    );
    expect(screen.getByText("Before refresh")).toBeInTheDocument();

    vi.resetModules();
    const refreshedRuntime = await import("../src");
    let RefreshedStore: typeof FirstStore | undefined;
    let RefreshedComponent: typeof FirstComponent | undefined;
    act(() => {
      RefreshedStore = refreshedRuntime
        .createStore<{ value: string }>()
        .__effectReactHot(storeId);
      RefreshedComponent = refreshedRuntime
        .createComponent({
          deps: [RefreshedStore],
          state: ({ deps }) => ({
            value: refreshedRuntime.useStore(
              deps.store!,
              (state) => state.value,
            ),
          }),
          ui: ({ state }) => <span>{`After ${state.value}`}</span>,
        })
        .__effectReactHot(componentId, {
          state: "value-state",
          ui: "after-ui",
        });
    });

    expect(RefreshedStore).toBe(FirstStore);
    expect(RefreshedComponent).toBe(FirstComponent);
    expect(screen.getByText("After refresh")).toBeInTheDocument();
  });
});
