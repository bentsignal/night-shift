import type { Effect } from "effect";

import type { ComponentEffect } from "@night-shift/effect-react";

import {
  CounterInstrument,
  CounterReadout,
  ProvidedCounterInstrument,
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

type _CounterInstrumentBubblesChildRequirement = Expect<
  Equal<
    Requirements<typeof CounterInstrument>,
    Requirements<typeof CounterReadout>
  >
>;
type _ProviderDischargesCounterRequirement = Expect<
  Equal<Requirements<typeof ProvidedCounterInstrument>, never>
>;
