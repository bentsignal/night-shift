import type { ReactElement } from "react";
import { Cause, Effect, Effectable, Exit, Option } from "effect";

import type { StoreProvider, StoreRequirement } from "./provider-store";
import { provideServiceContext, useServiceContext } from "./service-context";

type RenderResult = ReactElement | null;

export declare const EffectComponentTypeId: unique symbol;

export interface EffectComponent<
  Props,
  Error,
  Requirements,
> extends Effect.Effect<
  EffectComponent<Props, Error, Requirements>,
  never,
  Requirements
> {
  (props: Props): RenderResult;
  readonly [EffectComponentTypeId]: Effect.Effect<
    RenderResult,
    Error,
    Requirements
  >;
  readonly __effectReactRequirements: <
    const Components extends readonly unknown[],
  >(
    ...components: Components
  ) => EffectComponent<
    Props,
    Error | ComponentError<Components[number]>,
    Requirements | ComponentRequirements<Components[number]>
  >;
  readonly __effectReactProvidedRequirements: <
    const Providers extends readonly unknown[],
    const Components extends readonly unknown[],
  >(
    providers: Providers,
    ...components: Components
  ) => EffectComponent<
    Props,
    Error | ComponentError<Components[number]>,
    | Requirements
    | Exclude<
        ComponentRequirements<Components[number]>,
        ProviderRequirements<Providers[number]>
      >
  >;
}

type ComponentError<Component> =
  Component extends EffectComponent<
    infer _Props,
    infer Error,
    infer _Requirements
  >
    ? Error
    : never;

type ComponentRequirements<Component> =
  Component extends EffectComponent<
    infer _Props,
    infer _Error,
    infer Requirements
  >
    ? Requirements
    : never;

type ProviderRequirements<Provider> =
  Provider extends StoreProvider<infer Name, infer State>
    ? StoreRequirement<Name, State>
    : never;

export type ComponentEffect<Component> =
  Component extends EffectComponent<
    infer _Props,
    infer Error,
    infer Requirements
  >
    ? Effect.Effect<RenderResult, Error, Requirements>
    : never;

export type ComponentState<Props, Dependencies, State, Error> = (input: {
  readonly deps: Dependencies;
  readonly props: Props;
}) => Effect.Effect<State, Error>;

type ComponentInput<Props, State> = {
  readonly props: Props;
  readonly state: State;
};

type ComponentUI<Props, State> = (
  input: ComponentInput<Props, State>,
) => RenderResult;

type ComponentErrors<DependenciesError, StateError> =
  DependenciesError | StateError;

type ComponentLifecycle<
  Props,
  Dependencies,
  State,
  DependenciesError,
  StateError,
> = {
  readonly ui: ComponentUI<Props, State>;
  readonly onDefect?: (defect: unknown) => RenderResult;
  readonly state: ComponentState<Props, Dependencies, State, StateError>;
} & FailureRenderer<ComponentErrors<DependenciesError, StateError>>;

type DependencyInput<Dependencies, Error, Requirements> = [void] extends [
  Dependencies,
]
  ? {
      readonly deps?: never;
    }
  : {
      readonly deps: Effect.Effect<Dependencies, Error, Requirements>;
    };

type RuntimeDefinition<
  Props,
  Dependencies,
  State,
  DependenciesError,
  StateError,
> = ComponentLifecycle<
  Props,
  Dependencies,
  State,
  DependenciesError,
  StateError
>;

type FailureRenderer<Error> = [Error] extends [never]
  ? {
      readonly onFailure?: never;
    }
  : {
      readonly onFailure: (error: Error) => RenderResult;
    };

export type ComponentDefinition<
  Props,
  Dependencies,
  State,
  DependenciesError,
  StateError,
  Requirements,
> = ComponentLifecycle<
  Props,
  Dependencies,
  State,
  DependenciesError,
  StateError
> &
  DependencyInput<Dependencies, DependenciesError, Requirements> & {
    readonly displayName?: string;
  };

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
  Dependencies = void,
  State = never,
  DependenciesError = never,
  StateError = never,
  Requirements = never,
>(
  definition: ComponentDefinition<
    Props,
    Dependencies,
    State,
    DependenciesError,
    StateError,
    Requirements
  >,
) {
  const CreatedComponent = (props: Props) => {
    const services = useServiceContext();
    const dependencies = runState(
      provideServiceContext(
        (definition.deps ?? Effect.void) as Effect.Effect<
          Dependencies,
          DependenciesError,
          Requirements
        >,
        services,
      ),
    );

    if (Exit.isFailure(dependencies)) {
      return renderFailure(definition, dependencies.cause);
    }

    return (
      <EvaluatedState
        deps={dependencies.value}
        definition={definition}
        props={props}
      />
    );
  };
  CreatedComponent.displayName =
    definition.displayName ?? definition.ui.name ?? "EffectComponent";
  return makeEffectComponent<
    Props,
    ComponentErrors<DependenciesError, StateError>,
    Requirements
  >(CreatedComponent);
}

export function makeEffectComponent<Props, Error, Requirements>(
  component: (props: Props) => RenderResult,
) {
  const effectComponent = component as EffectComponent<
    Props,
    Error,
    Requirements
  >;
  Object.assign(effectComponent, Effectable.CommitPrototype, {
    commit: () =>
      Effect.context<Requirements>().pipe(Effect.as(effectComponent)),
    __effectReactProvidedRequirements: () => effectComponent,
    __effectReactRequirements: () => effectComponent,
  });
  return effectComponent;
}

function EvaluatedState<
  Props,
  Dependencies,
  State,
  DependenciesError,
  StateError,
>({
  deps,
  definition,
  props,
}: {
  deps: Dependencies;
  definition: RuntimeDefinition<
    Props,
    Dependencies,
    State,
    DependenciesError,
    StateError
  >;
  props: Props;
}) {
  const state = runState(
    definition.state({
      deps,
      props,
    }),
  );
  if (Exit.isFailure(state)) {
    return renderFailure(definition, state.cause);
  }
  return definition.ui({ props, state: state.value });
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
