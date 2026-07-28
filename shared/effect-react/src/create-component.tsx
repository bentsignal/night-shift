import type { ReactElement } from "react";
import { Cause, Effect, Exit, Option } from "effect";

import { provideServiceContext, useServiceContext } from "./service-context";

type RenderResult = ReactElement | null;

export declare const EffectComponentTypeId: unique symbol;

export interface EffectComponent<Props, Error, Requirements> {
  (props: Props): RenderResult;
  readonly [EffectComponentTypeId]: Effect.Effect<
    RenderResult,
    Error,
    Requirements
  >;
}

export type ComponentEffect<Component> =
  Component extends EffectComponent<
    infer _Props,
    infer Error,
    infer Requirements
  >
    ? Effect.Effect<RenderResult, Error, Requirements>
    : never;

export function requireComponent<Props, Error, Requirements>(
  component: EffectComponent<Props, Error, Requirements>,
) {
  return Effect.context<Requirements>().pipe(Effect.as(component));
}

export type StateHook<Props, State, Error> = (
  props: Props,
) => Effect.Effect<State, Error>;

export type ComponentState<Props, State, Error, Requirements> = Effect.Effect<
  StateHook<Props, State, Error>,
  Error,
  Requirements
>;

type FailureRenderer<Error> = [Error] extends [never]
  ? {
      readonly onFailure?: never;
    }
  : {
      readonly onFailure: (error: Error) => RenderResult;
    };

export type ComponentDefinition<Props, State, Error, Requirements> = {
  readonly component: (input: {
    readonly props: Props;
    readonly state: State;
  }) => RenderResult;
  readonly displayName?: string;
  readonly onDefect?: (defect: unknown) => RenderResult;
  readonly state: ComponentState<Props, State, Error, Requirements>;
} & FailureRenderer<Error>;

type RenderDefinition<Props, State, Error> = {
  readonly component: (input: {
    readonly props: Props;
    readonly state: State;
  }) => RenderResult;
  readonly onDefect?: (defect: unknown) => RenderResult;
} & FailureRenderer<Error>;

export class AsyncComponentStateError extends Error {
  override readonly name = "AsyncComponentStateError";

  constructor(options?: ErrorOptions) {
    super(
      "Component state must run synchronously. Move asynchronous work into a route loader or state action.",
      options,
    );
  }
}

export function createComponent<
  Props = Record<string, never>,
  State = never,
  Error = never,
  Requirements = never,
>(definition: ComponentDefinition<Props, State, Error, Requirements>) {
  const CreatedComponent = (props: Props) => {
    const services = useServiceContext();
    const factory = runState(provideServiceContext(definition.state, services));

    if (Exit.isFailure(factory)) {
      return renderFailure(definition, factory.cause);
    }

    return (
      <EvaluatedState
        definition={definition}
        props={props}
        useState={factory.value}
      />
    );
  };
  CreatedComponent.displayName =
    definition.displayName ?? definition.component.name ?? "EffectComponent";
  return CreatedComponent as unknown as EffectComponent<
    Props,
    Error,
    Requirements
  >;
}

function EvaluatedState<Props, State, Error>({
  definition,
  props,
  useState,
}: {
  definition: RenderDefinition<Props, State, Error>;
  props: Props;
  useState: StateHook<Props, State, Error>;
}) {
  const state = runState(useState(props));
  if (Exit.isFailure(state)) {
    return renderFailure(definition, state.cause);
  }
  return definition.component({ props, state: state.value });
}

function runState<Success, Error>(effect: Effect.Effect<Success, Error>) {
  try {
    return Effect.runSyncExit(effect);
  } catch (cause) {
    throw new AsyncComponentStateError({ cause });
  }
}

function renderFailure<Error>(
  definition: FailureRenderer<Error> & {
    readonly onDefect?: (defect: unknown) => RenderResult;
  },
  cause: Cause.Cause<Error>,
) {
  const failure = Cause.failureOption(cause);
  if (Option.isSome(failure) && definition.onFailure) {
    return definition.onFailure(failure.value);
  }

  const defect = Cause.squash(cause);
  rejectAsyncState(cause);

  if (definition.onDefect) {
    return definition.onDefect(defect);
  }

  throw defect;
}

function rejectAsyncState<Error>(cause: Cause.Cause<Error>) {
  const defect = Cause.squash(cause);
  if (defect instanceof Error && defect.name === "AsyncFiberException") {
    throw new AsyncComponentStateError({ cause: defect });
  }
}
