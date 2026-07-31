import type { ReactElement } from "react";
import { Cause, Effect, Effectable, Exit, Option } from "effect";

import type { StoreProvider, StoreRequirement } from "./provider-store";
import { provideServiceContext, useServiceContext } from "./service-context";

type RenderResult = ReactElement | null;

export declare const EffectComponentTypeId: unique symbol;
export declare const EffectReactAnalysisRequiredTypeId: unique symbol;

export interface EffectReactAnalysisRequired {
  readonly [EffectReactAnalysisRequiredTypeId]: "Effect React compiler analysis is not active";
}

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
  readonly __effectReactAnalyzed: () => EffectComponent<
    Props,
    Error,
    Exclude<Requirements, EffectReactAnalysisRequired>
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

type StatefulComponentInput<Props, State> = {
  readonly props: Props;
  readonly state: State;
};

type StatelessComponentInput<Props> = {
  readonly props: Props;
};

type ComponentErrors<DependenciesError, StateError> =
  DependenciesError | StateError;

type ComponentCommon<Error> = {
  readonly displayName?: string;
  readonly onDefect?: (defect: unknown) => RenderResult;
} & FailureRenderer<Error>;

export type StatefulComponentDefinition<
  Props,
  Dependencies,
  State,
  DependenciesError,
  StateError,
  Requirements,
> = {
  readonly state: ComponentState<Props, Dependencies, State, StateError>;
  readonly ui: (input: StatefulComponentInput<Props, State>) => RenderResult;
} & ComponentCommon<ComponentErrors<DependenciesError, StateError>> &
  DependencyInput<Dependencies, DependenciesError, Requirements>;

export type StatelessComponentDefinition<
  Props,
  Dependencies,
  DependenciesError,
  Requirements,
> = {
  readonly state?: never;
  readonly ui: (input: StatelessComponentInput<Props>) => RenderResult;
} & ComponentCommon<DependenciesError> &
  DependencyInput<Dependencies, DependenciesError, Requirements>;

type DependencyInput<Dependencies, Error, Requirements> = [void] extends [
  Dependencies,
]
  ? {
      readonly deps?: never;
    }
  : {
      readonly deps: Effect.Effect<Dependencies, Error, Requirements>;
    };

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
> =
  | StatefulComponentDefinition<
      Props,
      Dependencies,
      State,
      DependenciesError,
      StateError,
      Requirements
    >
  | StatelessComponentDefinition<
      Props,
      Dependencies,
      DependenciesError,
      Requirements
    >;

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
  Requirements = EffectReactAnalysisRequired,
>(
  definition: StatefulComponentDefinition<
    Props,
    Dependencies,
    State,
    DependenciesError,
    StateError,
    Requirements
  >,
): EffectComponent<
  Props,
  ComponentErrors<DependenciesError, StateError>,
  Requirements | EffectReactAnalysisRequired
>;
export function createComponent<
  Props = Record<string, never>,
  Dependencies = void,
  DependenciesError = never,
  Requirements = EffectReactAnalysisRequired,
>(
  definition: StatelessComponentDefinition<
    Props,
    Dependencies,
    DependenciesError,
    Requirements
  >,
): EffectComponent<
  Props,
  DependenciesError,
  Requirements | EffectReactAnalysisRequired
>;
export function createComponent<
  Props = Record<string, never>,
  Dependencies = void,
  State = never,
  DependenciesError = never,
  StateError = never,
  Requirements = EffectReactAnalysisRequired,
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

    return definition.state ? (
      <EvaluatedState
        deps={dependencies.value}
        definition={definition}
        props={props}
      />
    ) : (
      <EvaluatedUI definition={definition} props={props} />
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
    __effectReactAnalyzed: () => effectComponent,
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
  Requirements,
>({
  deps,
  definition,
  props,
}: {
  deps: Dependencies;
  definition: StatefulComponentDefinition<
    Props,
    Dependencies,
    State,
    DependenciesError,
    StateError,
    Requirements
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

function EvaluatedUI<Props, Dependencies, DependenciesError, Requirements>({
  definition,
  props,
}: {
  definition: StatelessComponentDefinition<
    Props,
    Dependencies,
    DependenciesError,
    Requirements
  >;
  props: Props;
}) {
  return definition.ui({ props });
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
