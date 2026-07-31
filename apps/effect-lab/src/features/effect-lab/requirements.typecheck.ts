import type { Effect } from "effect";

import type {
  ComponentEffect,
  Store,
  StoreRequirement,
} from "@night-shift/effect-react";

import {
  Counter,
  CounterInstrument,
  CounterReadout,
  TestComponent,
} from "./counter";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;

type Expect<Value extends true> = Value;
type StoreState<Value> =
  Value extends Store<infer _Name, infer State> ? State : never;
type Requirements<Component> = Effect.Effect.Context<
  ComponentEffect<Component>
>;
type CounterState = StoreState<typeof Counter>;

type _CounterReadoutRequiresTheCounter = Expect<
  Equal<
    Requirements<typeof CounterReadout>,
    StoreRequirement<"Counter", CounterState>
  >
>;
type _CounterInstrumentDischargesChildRequirements = Expect<
  Equal<Requirements<typeof CounterInstrument>, never>
>;
type _StatelessComponentKeepsChildRequirements = Expect<
  Equal<
    Requirements<typeof TestComponent>,
    StoreRequirement<"Counter", CounterState>
  >
>;
