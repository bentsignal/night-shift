// eslint-disable-next-line no-restricted-imports -- React.memo is the observation boundary that proves compiler-generated values stay referentially stable.
import { memo, useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, test, vi } from "vitest";

import { createComponent } from "@night-shift/effect-react";

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
  displayName: "CompilerProof",
  state: Effect.succeed((props: ProbeProps) => {
    const [revision, setRevision] = useState(0);

    return Effect.succeed({
      revision,
      props,
      update: () => setRevision((current) => current + 1),
    });
  }),
  component: ({ state }) => {
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

describe("Effect React Compiler", () => {
  test("memoizes authored state and component callbacks without directives", () => {
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
});
