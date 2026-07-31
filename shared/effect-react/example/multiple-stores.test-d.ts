import type { Effect } from "effect";

import type { ComponentEffect, StoreRequirement } from "../src";
import type { FirstState, SecondState } from "./multiple-stores";
import {
  BothProvidedPair,
  FirstProvidedPair,
  UnprovidedPair,
} from "./multiple-stores";

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

type FirstRequirement = StoreRequirement<"First", FirstState>;
type SecondRequirement = StoreRequirement<"Second", SecondState>;

type _UnprovidedRequiresBoth = Expect<
  Equal<
    Requirements<typeof UnprovidedPair>,
    FirstRequirement | SecondRequirement
  >
>;
type _ProvidingFirstLeavesSecond = Expect<
  Equal<Requirements<typeof FirstProvidedPair>, SecondRequirement>
>;
type _ProvidingBothLeavesNothing = Expect<
  Equal<Requirements<typeof BothProvidedPair>, never>
>;
