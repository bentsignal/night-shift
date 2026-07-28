import type { ComponentType } from "react";
import { Context, Effect } from "effect";

import { createComponent } from "../src";

class NumberService extends Context.Tag("NumberService")<
  NumberService,
  number
>() {}

class TextService extends Context.Tag("TextService")<TextService, string>() {}

const requiredState = Effect.gen(function* () {
  const number = yield* NumberService;
  const text = yield* TextService;
  return () => Effect.succeed({ label: `${text}:${number}` });
});

createComponent({
  // @ts-expect-error component state still requires both tagged services
  state: requiredState,
  component: ({ label }) => {
    label satisfies string;
    return null;
  },
});

const Ready = createComponent({
  state: requiredState.pipe(
    Effect.provideService(NumberService, 1),
    Effect.provideService(TextService, "ready"),
  ),
  component: ({ label }) => {
    label satisfies string;
    return null;
  },
});

Ready satisfies ComponentType;

const Failed = createComponent({
  state: Effect.fail("typed-failure" as const).pipe(
    Effect.as(() => Effect.succeed({ ready: false })),
  ),
  component: ({ ready }) => {
    ready satisfies boolean;
    return null;
  },
  onFailure: (error) => {
    error satisfies "typed-failure";
    return null;
  },
});

Failed satisfies ComponentType;

const StateFailed = createComponent({
  state: Effect.succeed(() => Effect.fail("state-failure" as const)),
  component: () => null,
  onFailure: (error) => {
    error satisfies "state-failure";
    return null;
  },
});

StateFailed satisfies ComponentType;

createComponent({
  state: Effect.succeed(() => Effect.succeed({ ready: true })),
  // @ts-expect-error views render JSX or null, not arbitrary React nodes
  component: () => "business logic leaked into the view",
});
