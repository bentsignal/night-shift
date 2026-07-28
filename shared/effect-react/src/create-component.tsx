import type { ReactElement } from "react";
import { Cause, Effect, Exit, Option } from "effect";

type RenderResult = ReactElement | null;

export type StateHook<Props, State, Error> = (
  props: Props,
) => Effect.Effect<State, Error>;

export type ComponentState<Props, State, Error, Requirements> = Effect.Effect<
  StateHook<Props, State, Error>,
  Error,
  Requirements
>;

type NoRequirements<Requirements> = [Requirements] extends [never]
  ? unknown
  : {
      readonly __unresolvedEffectRequirements: Requirements;
    };

type FailureRenderer<Error> = [Error] extends [never]
  ? {
      readonly onFailure?: never;
    }
  : {
      readonly onFailure: (error: Error) => RenderResult;
    };

export type ComponentDefinition<Props, State, Error, Requirements> = {
  readonly component: (state: State) => RenderResult;
  readonly displayName?: string;
  readonly onDefect?: (defect: unknown) => RenderResult;
  readonly state: ComponentState<Props, State, Error, Requirements> &
    NoRequirements<Requirements>;
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
  const factory = runState(
    definition.state as ComponentState<Props, State, Error, never>,
  );

  if (Exit.isSuccess(factory)) {
    const useState = factory.value;
    const CreatedComponent = (props: Props) => {
      const state = runState(useState(props));
      if (Exit.isSuccess(state)) {
        return definition.component(state.value);
      }
      return renderFailure(definition, state.cause);
    };
    CreatedComponent.displayName =
      definition.displayName ?? definition.component.name ?? "EffectComponent";
    return CreatedComponent;
  }

  rejectAsyncState(factory.cause);
  const FailedComponent = () => renderFailure(definition, factory.cause);
  FailedComponent.displayName = definition.displayName ?? "EffectFailure";
  return FailedComponent;
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
