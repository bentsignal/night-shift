import type { Effect } from "effect";

import type { ComponentEffect, StoreRequirement } from "../src";
import type { CounterState } from "./counter";
import {
  CounterButton,
  CounterExample,
  CounterPanel,
  CounterRow,
} from "./counter";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;

type Requirements<Component> = Effect.Effect.Context<
  ComponentEffect<Component>
>;

type CounterRequirement = StoreRequirement<"Counter", CounterState>;

type _ButtonRequiresCounter = Expect<
  Equal<Requirements<typeof CounterButton>, CounterRequirement>
>;
type _RowBubblesCounter = Expect<
  Equal<Requirements<typeof CounterRow>, CounterRequirement>
>;
type _PanelBubblesCounterWithoutProvider = Expect<
  Equal<Requirements<typeof CounterPanel>, CounterRequirement>
>;
type _ExampleBubblesCounterWithoutProvider = Expect<
  Equal<Requirements<typeof CounterExample>, CounterRequirement>
>;
