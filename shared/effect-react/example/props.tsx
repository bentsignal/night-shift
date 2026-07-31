import { createComponent, createStore, defineProps, useStore } from "../src";

export const GreetingStyle = createStore<{
  salutation: string;
}>();

export const Greeting = createComponent({
  deps: [GreetingStyle],
  props: defineProps<{
    name: string;
    punctuation?: "!" | ".";
  }>(),
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
