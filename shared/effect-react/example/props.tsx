import { createComponent, createStore, defineProps, useStore } from "../src";

interface GreetingStyleState {
  readonly salutation: string;
}

export const GreetingStyle = createStore<GreetingStyleState>();

export const Greeting = createComponent({
  props: defineProps<{
    readonly name: string;
    readonly punctuation?: "!" | ".";
  }>(),
  deps: [GreetingStyle],
  state: ({ deps, props }) => {
    const salutation = useStore(
      deps.greetingStyle,
      (style) => style.salutation,
    );

    return {
      message: `${salutation}, ${props.name}${props.punctuation ?? "."}`,
    };
  },
  ui: ({ state }) => <p>{state.message}</p>,
});

export const PropsExample = createComponent({
  ui: () => (
    <GreetingStyle implements={() => ({ salutation: "Hello" })}>
      <Greeting name="Ada" punctuation="!" />
    </GreetingStyle>
  ),
});
