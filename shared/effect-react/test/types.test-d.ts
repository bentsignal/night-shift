import type { ComponentType } from "react";
import { Context, Effect } from "effect";

import { Component, Hook } from "../src";

class NumberService extends Context.Tag("NumberService")<
  NumberService,
  number
>() {}

class TextService extends Context.Tag("TextService")<TextService, string>() {}

const requiredFactory = Component.make(
  Effect.gen(function* () {
    const number = yield* NumberService;
    const text = yield* TextService;
    return (() => `${text}:${number}`) as ComponentType;
  }),
);

// @ts-expect-error unresolved services cannot be mounted
Component.mount(requiredFactory, { onFailure: () => null });

const providedFactory = requiredFactory.pipe(
  Effect.provideService(NumberService, 1),
  Effect.provideService(TextService, "ready"),
);

Component.mount(providedFactory, {
  onFailure: (error: never) => error,
});

const typedFailure = Component.make(
  Effect.fail("typed-failure" as const).pipe(
    Effect.as((() => null) as ComponentType),
  ),
);

Component.mount(typedFailure, {
  onFailure: (error) => {
    const exact: "typed-failure" = error;
    return exact;
  },
});

const requiredHook = Hook.make(
  Effect.gen(function* () {
    const number = yield* NumberService;
    return () => number;
  }),
);

const componentUsingHook = Component.make(
  Effect.gen(function* () {
    const useNumber = yield* requiredHook;
    return (() => useNumber()) as ComponentType;
  }),
);

// @ts-expect-error hook requirements flow into the component factory
Component.mount(componentUsingHook, { onFailure: () => null });
