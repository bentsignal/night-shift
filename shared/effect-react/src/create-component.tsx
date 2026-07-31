import type { ReactElement } from "react";
import { Cause, Effect, Effectable, Exit } from "effect";

import type {
  StoreDependency,
  StoreRequirement,
  StoreTypeId,
} from "./provider-store";
import type { ReadableStore } from "./store";
import { provideServiceContext, useServiceContext } from "./service-context";

type RenderResult = ReactElement | null;
type EmptyProps = Record<string, never>;

export declare const ComponentTypeId: unique symbol;
export declare const EffectReactAnalysisRequiredTypeId: unique symbol;

export interface EffectReactAnalysisRequired {
  readonly [EffectReactAnalysisRequiredTypeId]: "Effect React compiler analysis is not active";
}

interface ComponentProtocol<Props, Requirements, Self> extends Effect.Effect<
  Self,
  never,
  Requirements
> {
  readonly [ComponentTypeId]: {
    readonly props: (props: Props) => Props;
    readonly requirements: (requirements: Requirements) => Requirements;
  };
  readonly __effectReactAnalyzed: () => CreatedComponent<
    Props,
    Exclude<Requirements, EffectReactAnalysisRequired>
  >;
  readonly __effectReactRequirements: <
    const Components extends readonly unknown[],
  >(
    ...components: Components
  ) => CreatedComponent<
    Props,
    Requirements | ComponentRequirements<Components[number]>
  >;
  readonly __effectReactNamed: (
    name: string,
  ) => CreatedComponent<Props, Requirements>;
  readonly __effectReactProvidedRequirements: <
    const Providers extends readonly unknown[],
    const Components extends readonly unknown[],
  >(
    providers: Providers,
    ...components: Components
  ) => CreatedComponent<
    Props,
    | Requirements
    | Exclude<
        ComponentRequirements<Components[number]>,
        ProviderRequirements<Providers[number]>
      >
  >;
}

export interface Component<Requirements = never> extends ComponentProtocol<
  EmptyProps,
  Requirements,
  Component<Requirements>
> {
  (props: EmptyProps): RenderResult;
}

export interface ComponentWithProps<
  Props,
  Requirements = never,
> extends ComponentProtocol<
  Props,
  Requirements,
  ComponentWithProps<Props, Requirements>
> {
  (props: Props): RenderResult;
}

type IsEmptyProps<Props> = [Props] extends [EmptyProps]
  ? [EmptyProps] extends [Props]
    ? true
    : false
  : false;

type CreatedComponent<Props, Requirements> =
  IsEmptyProps<Props> extends true
    ? Component<Requirements>
    : ComponentWithProps<Props, Requirements>;

type ComponentRequirements<Value> =
  Value extends ComponentProtocol<infer _Props, infer Requirements, infer _Self>
    ? Requirements
    : never;

type ProviderRequirements<Provider> = Provider extends {
  readonly [StoreTypeId]: {
    readonly name: infer Name extends string;
    readonly state: infer State extends object;
  };
}
  ? StoreRequirement<Name, State>
  : never;

export type ComponentEffect<Value> = Effect.Effect<
  RenderResult,
  never,
  ComponentRequirements<Value>
>;

type StoreDependencies = readonly {
  readonly [StoreTypeId]: {
    readonly key: string;
    readonly name: string;
    readonly state: object;
  };
}[];

export type ResolvedDependencies<Dependencies extends StoreDependencies> = {
  readonly [
    Dependency in Dependencies[number] as DependencyKey<Dependency>
  ]: ReadableStore<DependencyState<Dependency>>;
};

type DependencyKey<Dependency> = Dependency extends {
  readonly [StoreTypeId]: {
    readonly key: infer Key extends string;
  };
}
  ? Key
  : never;

type DependencyState<Dependency> = Dependency extends {
  readonly [StoreTypeId]: {
    readonly state: infer State extends object;
  };
}
  ? State
  : never;

type DependencyRequirement<Dependency> = Dependency extends {
  readonly [StoreTypeId]: {
    readonly name: infer Name extends string;
    readonly state: infer State extends object;
  };
}
  ? StoreRequirement<Name, State>
  : never;

type DependencyRequirements<Dependencies extends StoreDependencies> =
  DependencyRequirement<Dependencies[number]>;

export type ComponentState<
  Props,
  Dependencies extends StoreDependencies,
  State,
> = (input: {
  readonly deps: ResolvedDependencies<Dependencies>;
  readonly props: Props;
}) => State;

type StatefulComponentInput<Props, State> = {
  readonly props: Props;
  readonly state: State;
};

type StatelessComponentInput<Props> = {
  readonly props: Props;
};

export type StatefulComponentDefinition<
  Props,
  Dependencies extends StoreDependencies,
  State,
> = {
  readonly deps: readonly [...Dependencies];
  readonly state: ComponentState<Props, Dependencies, State>;
  readonly ui: (input: StatefulComponentInput<Props, State>) => RenderResult;
};

export type StatelessComponentDefinition<
  Props,
  Dependencies extends StoreDependencies,
> = {
  readonly deps: readonly [...Dependencies];
  readonly state?: never;
  readonly ui: (input: StatelessComponentInput<Props>) => RenderResult;
};

type StatefulComponentWithoutDependencies<Props, State> = {
  readonly deps?: never;
  readonly state: (input: { readonly props: Props }) => State;
  readonly ui: (input: StatefulComponentInput<Props, State>) => RenderResult;
};

type StatelessComponentWithoutDependencies<Props> = {
  readonly deps?: never;
  readonly state?: never;
  readonly ui: (input: StatelessComponentInput<Props>) => RenderResult;
};

export function createComponent<
  Props = EmptyProps,
  const Dependencies extends StoreDependencies = StoreDependencies,
  State = never,
>(
  definition: StatefulComponentDefinition<Props, Dependencies, State>,
): CreatedComponent<
  Props,
  DependencyRequirements<Dependencies> | EffectReactAnalysisRequired
>;
export function createComponent<
  Props = EmptyProps,
  const Dependencies extends StoreDependencies = StoreDependencies,
>(
  definition: StatelessComponentDefinition<Props, Dependencies>,
): CreatedComponent<
  Props,
  DependencyRequirements<Dependencies> | EffectReactAnalysisRequired
>;
export function createComponent<Props = EmptyProps, State = never>(
  definition: StatefulComponentWithoutDependencies<Props, State>,
): CreatedComponent<Props, EffectReactAnalysisRequired>;
export function createComponent<Props = EmptyProps>(
  definition: StatelessComponentWithoutDependencies<Props>,
): CreatedComponent<Props, EffectReactAnalysisRequired>;
export function createComponent(definition: unknown) {
  const componentDefinition = definition as RuntimeComponentDefinition;
  const CreatedComponent = (props: object) => {
    const services = useServiceContext();
    const dependencies = resolveDependencies(
      componentDefinition.deps ?? [],
      services,
    );

    return componentDefinition.state ? (
      <EvaluatedState
        deps={dependencies}
        definition={componentDefinition}
        props={props}
      />
    ) : (
      <EvaluatedUI definition={componentDefinition} props={props} />
    );
  };
  CreatedComponent.displayName = "Component";
  return eraseComponentType(makeComponent<object, never>(CreatedComponent));
}

function eraseComponentType(component: unknown) {
  return component;
}

function makeComponent<Props, Requirements>(
  component: (props: Props) => RenderResult,
) {
  const created = component as CreatedComponent<Props, Requirements>;
  Object.assign(created, Effectable.CommitPrototype, {
    __effectReactAnalyzed: () => created,
    commit: () => Effect.context<Requirements>().pipe(Effect.as(created)),
    __effectReactNamed: (name: string) => {
      Object.assign(component, { displayName: name });
      return created;
    },
    __effectReactProvidedRequirements: () => created,
    __effectReactRequirements: () => created,
  });
  return created;
}

type RuntimeComponentDefinition = {
  readonly deps?: readonly StoreDependency<string, string, object>[];
  readonly state?: (input: {
    readonly deps: ResolvedRuntimeDependencies;
    readonly props: object;
  }) => unknown;
  readonly ui: (input: {
    readonly props: object;
    readonly state?: unknown;
  }) => RenderResult;
};

function EvaluatedState({
  deps,
  definition,
  props,
}: {
  deps: ResolvedRuntimeDependencies;
  definition: RuntimeComponentDefinition;
  props: object;
}) {
  const state = definition.state?.({ deps, props });
  return definition.ui({ props, state });
}

function EvaluatedUI({
  definition,
  props,
}: {
  definition: RuntimeComponentDefinition;
  props: object;
}) {
  return definition.ui({ props });
}

function resolveDependencies(
  dependencies: readonly StoreDependency<string, string, object>[],
  services: Parameters<typeof provideServiceContext>[1],
) {
  const resolved = Effect.all(dependencies).pipe((effect) =>
    provideServiceContext(effect, services),
  );
  const exit = Effect.runSyncExit(resolved);
  if (Exit.isSuccess(exit)) {
    const entries = dependencies.map((dependency, index) => {
      const store = exit.value[index];
      if (!store) {
        throw new Error("Resolved store count did not match dependencies.");
      }
      return [dependency.__effectReactDependencyKey, store] as const;
    });
    return Object.fromEntries(entries);
  }
  throw Cause.squash(exit.cause);
}

type ResolvedRuntimeDependencies = Readonly<
  Record<string, ReadableStore<object>>
>;
