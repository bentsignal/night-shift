import { createComponent, createStore, useStore } from "../src";

export interface FirstState {
  readonly value: number;
}

export interface SecondState {
  readonly label: string;
}

export const first = createStore("First")<FirstState>();
export const second = createStore("Second")<SecondState>();

function useFirstImplementation() {
  return { value: 1 };
}

function useSecondImplementation() {
  return { label: "second" };
}

const FirstValue = createComponent({
  deps: [first.store],
  state: ({ deps: [store] }) => ({
    value: useStore(store, (state) => state.value),
  }),
  ui: ({ state }) => <span>{state.value}</span>,
});

const SecondValue = createComponent({
  deps: [second.store],
  state: ({ deps: [store] }) => ({
    label: useStore(store, (state) => state.label),
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
    <first.Store implements={useFirstImplementation}>
      <FirstValue />
      <SecondValue />
    </first.Store>
  ),
});

export const BothProvidedPair = createComponent({
  ui: () => (
    <first.Store implements={useFirstImplementation}>
      <second.Store implements={useSecondImplementation}>
        <FirstValue />
        <SecondValue />
      </second.Store>
    </first.Store>
  ),
});
