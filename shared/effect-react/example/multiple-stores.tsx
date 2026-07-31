import { createComponent, createStore, useStore } from "../src";

export interface FirstState {
  readonly value: number;
}

export interface SecondState {
  readonly label: string;
}

export const First = createStore("First")<FirstState>();
export const Second = createStore("Second")<SecondState>();

function useFirstImplementation() {
  return { value: 1 };
}

function useSecondImplementation() {
  return { label: "second" };
}

const FirstValue = createComponent({
  deps: [First],
  state: ({ deps }) => ({
    value: useStore(deps.first, (state) => state.value),
  }),
  ui: ({ state }) => <span>{state.value}</span>,
});

const SecondValue = createComponent({
  deps: [Second],
  state: ({ deps }) => ({
    label: useStore(deps.second, (state) => state.label),
  }),
  ui: ({ state }) => <span>{state.label}</span>,
});

export const UnprovidedPair = createComponent({
  ui: () => (
    <>
      <FirstValue />
      <SecondValue />
    </>
  ),
});

export const FirstProvidedPair = createComponent({
  ui: () => (
    <First implements={useFirstImplementation}>
      <FirstValue />
      <SecondValue />
    </First>
  ),
});

export const BothProvidedPair = createComponent({
  ui: () => (
    <First implements={useFirstImplementation}>
      <Second implements={useSecondImplementation}>
        <FirstValue />
        <SecondValue />
      </Second>
    </First>
  ),
});
