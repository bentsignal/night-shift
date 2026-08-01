// eslint-disable-next-line no-restricted-imports -- React.memo is the observation boundary that proves compiler-generated values stay referentially stable.
import { memo, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { createComponent, defineProps } from "@night-shift/effect-react";

interface ProbeProps {
  readonly onComponentValue: () => void;
  readonly onStateValue: () => void;
}

const StateValue = memo(function StateValue({
  onRender,
  value,
}: {
  readonly onRender: () => void;
  readonly value: unknown;
}) {
  onRender();
  return <span data-value={String(value)}>state</span>;
});

const ComponentValue = memo(function ComponentValue({
  onRender,
  value,
}: {
  readonly onRender: () => void;
  readonly value: unknown;
}) {
  onRender();
  return <span data-value={String(value)}>component</span>;
});

/**
 * This fixture intentionally contains no React Compiler directives.
 *
 * The Effect React compiler must identify both callbacks as React functions
 * before Babel runs. React Compiler then keeps the state update closure and
 * component value allocation stable when only `revision` changes.
 */
const CompilerProof = createComponent({
  props: defineProps<ProbeProps>(),
  state: ({ props }) => {
    const [revision, setRevision] = useState(0);

    return {
      revision,
      props,
      update: () => setRevision((current) => current + 1),
    };
  },
  ui: ({ state }) => {
    const componentValue = { source: "component" };

    return (
      <section>
        <StateValue onRender={state.props.onStateValue} value={state.update} />
        <ComponentValue
          onRender={state.props.onComponentValue}
          value={componentValue}
        />
        <button type="button" onClick={state.update}>
          revision {state.revision}
        </button>
      </section>
    );
  },
});

const runtimeComponentFactory = createComponent;
const runtimeHotId = "test:effect-lab:compiled-hot-component";

function useRuntimeHotProbeState() {
  const [count, setCount] = useState(0);
  return { count, setCount };
}

const RuntimeHotProbe = runtimeComponentFactory({
  state: useRuntimeHotProbeState,
  ui: ({ state }) => (
    <button type="button" onClick={() => state.setCount((count) => count + 1)}>
      {`Before ${state.count}`}
    </button>
  ),
}).__effectReactHot(runtimeHotId, {
  state: "stable-counter-state",
  ui: "before-counter-ui",
});

describe("Effect React Compiler", () => {
  test("memoizes values created by authored state and ui callbacks", () => {
    const onComponentValue = vi.fn();
    const onStateValue = vi.fn();

    render(
      <CompilerProof
        onComponentValue={onComponentValue}
        onStateValue={onStateValue}
      />,
    );

    expect([
      onStateValue.mock.calls.length,
      onComponentValue.mock.calls.length,
    ]).toEqual([1, 1]);

    act(() => {
      screen.getByRole("button", { name: "revision 0" }).click();
    });

    expect(screen.getByRole("button", { name: "revision 1" })).toBeVisible();
    expect([
      onStateValue.mock.calls.length,
      onComponentValue.mock.calls.length,
    ]).toEqual([1, 1]);
  });

  test("does not let compiler caches swallow a hot definition", () => {
    render(<RuntimeHotProbe />);
    act(() => screen.getByRole("button", { name: "Before 0" }).click());
    expect(screen.getByRole("button", { name: "Before 1" })).toBeVisible();

    act(() => {
      runtimeComponentFactory({
        state: useRuntimeHotProbeState,
        ui: ({ state }) => (
          <button
            type="button"
            onClick={() => state.setCount((count) => count + 1)}
          >
            {`After ${state.count}`}
          </button>
        ),
      }).__effectReactHot(runtimeHotId, {
        state: "stable-counter-state",
        ui: "after-counter-ui",
      });
    });

    expect(screen.getByRole("button", { name: "After 1" })).toBeVisible();
  });
});
