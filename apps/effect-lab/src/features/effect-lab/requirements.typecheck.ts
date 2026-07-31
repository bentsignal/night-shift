import type { Effect } from "effect";

import type {
  ComponentEffect,
  StoreRequirement,
} from "@night-shift/effect-react";

import type { CounterState } from "./counter";
import { CounterInstrument, CounterReadout, TestComponent } from "./counter";

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
