import { Effect } from "effect";

import type {
  ComponentEffect,
  StoreRequirement,
} from "@night-shift/effect-react";
import { createComponent } from "@night-shift/effect-react";

import type { ControlPlaneState } from "../../control-plane/client";
import { newRunFormState } from "./new-run-form-state";

type Includes<Union, Member> = Member extends Union ? true : false;
type Expect<Value extends true> = Value;

const _NewRunFormRequirements = createComponent({
  state: newRunFormState,
  component: () => null,
});

type Requirements = Effect.Effect.Context<
  ComponentEffect<typeof _NewRunFormRequirements>
>;

type _RequiresControlPlane = Expect<
  Includes<Requirements, StoreRequirement<"ControlPlane", ControlPlaneState>>
>;
type _RequiresNavigation = Expect<
  Includes<Requirements, import("./new-run-form-state").NewRunNavigation>
>;
type _RequiresPreferences = Expect<
  Includes<Requirements, import("./new-run-form-state").NewRunPreferences>
>;
