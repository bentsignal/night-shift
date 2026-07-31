import { createComponent } from "../src";

export interface GreetingProps {
  readonly name: string;
  readonly punctuation?: "!" | ".";
}

export const Greeting = createComponent({
  state: ({ props }: { props: GreetingProps }) => ({
    message: `Hello, ${props.name}${props.punctuation ?? "."}`,
  }),
  ui: ({ state }) => <p>{state.message}</p>,
});

export const PropsExample = createComponent({
  ui: () => <Greeting name="Ada" punctuation="!" />,
});
