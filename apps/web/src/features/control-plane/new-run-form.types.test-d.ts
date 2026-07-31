import { Effect } from "effect";

import type {
  ComponentEffect,
  StoreRequirement,
} from "@night-shift/effect-react";
import { createComponent } from "@night-shift/effect-react";

import type { ControlPlaneState } from "../../control-plane/client";
import { ControlPlane } from "../../control-plane/client";

type Includes<Union, Member> = Member extends Union ? true : false;
type Expect<Value extends true> = Value;

const _NewRunFormRequirements = createComponent({
  deps: [ControlPlane],
  ui: () => null,
});

type Requirements = Effect.Effect.Context<
  ComponentEffect<typeof _NewRunFormRequirements>
>;

type _RequiresControlPlane = Expect<
  Includes<Requirements, StoreRequirement<"ControlPlane", ControlPlaneState>>
>;
