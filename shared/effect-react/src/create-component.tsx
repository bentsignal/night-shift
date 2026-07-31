import type { ReactElement } from "react";
import { useSyncExternalStore } from "react";
import { Cause, Effect, Effectable, Exit } from "effect";

import type { HotComponentSignatures, HotComponentState } from "./hot-runtime";
import type {
  StoreDependency,
  StoreRequirement,
  StoreTypeId,
} from "./provider-store";
import type { ReadableStore } from "./store";
import { makeHotComponentState, registerHotComponent } from "./hot-runtime";
import { provideServiceContext, useServiceContext } from "./service-context";

type RenderResult = ReactElement | null;
type EmptyProps = Record<string, never>;

export declare const ComponentTypeId: unique symbol;
export declare const ComponentPropsTypeId: unique symbol;
export declare const EffectReactAnalysisRequiredTypeId: unique symbol;

export interface ComponentProps<Props> {
  readonly [ComponentPropsTypeId]: (props: Props) => Props;
}

const componentProps = Object.freeze({});

export const defineProps = <Props,>() =>
  componentProps as ComponentProps<Props>;

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
  readonly __effectReactHot: (
    id: string,
    signatures: HotComponentSignatures,
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

type StatefulComponentInput<State> = {
  readonly state: State;
};

export type StatefulComponentDefinition<
  Props,
  Dependencies extends StoreDependencies,
  State,
> = {
  readonly props: ComponentProps<Props>;
  readonly deps: readonly [...Dependencies];
  readonly state: ComponentState<Props, Dependencies, State>;
  readonly ui: (input: StatefulComponentInput<State>) => RenderResult;
};

type StatefulComponentWithoutPropsDefinition<
  Dependencies extends StoreDependencies,
  State,
> = {
  readonly props?: never;
  readonly deps: readonly [...Dependencies];
  readonly state: ComponentState<EmptyProps, Dependencies, State>;
  readonly ui: (input: StatefulComponentInput<State>) => RenderResult;
};

export type StatelessComponentDefinition<
  Dependencies extends StoreDependencies,
> = {
  readonly props?: never;
  readonly deps: readonly [...Dependencies];
  readonly state?: never;
  readonly ui: () => RenderResult;
};

type StatefulComponentWithoutDependencies<Props, State> = {
  readonly props: ComponentProps<Props>;
  readonly deps?: never;
  readonly state: (input: { readonly props: Props }) => State;
  readonly ui: (input: StatefulComponentInput<State>) => RenderResult;
};

type StatefulComponentWithoutPropsOrDependencies<State> = {
  readonly props?: never;
  readonly deps?: never;
  readonly state: (input: { readonly props: EmptyProps }) => State;
  readonly ui: (input: StatefulComponentInput<State>) => RenderResult;
};

type StatelessComponentWithoutDependencies = {
  readonly props?: never;
  readonly deps?: never;
  readonly state?: never;
  readonly ui: () => RenderResult;
};

export function createComponent<
  Props,
  const Dependencies extends StoreDependencies,
  State,
>(
  definition: StatefulComponentDefinition<Props, Dependencies, State>,
): CreatedComponent<
  Props,
  DependencyRequirements<Dependencies> | EffectReactAnalysisRequired
>;
export function createComponent<
  const Dependencies extends StoreDependencies,
  State,
>(
  definition: StatefulComponentWithoutPropsDefinition<Dependencies, State>,
): Component<
  DependencyRequirements<Dependencies> | EffectReactAnalysisRequired
>;
export function createComponent<const Dependencies extends StoreDependencies>(
  definition: StatelessComponentDefinition<Dependencies>,
): Component<
  DependencyRequirements<Dependencies> | EffectReactAnalysisRequired
>;
export function createComponent<Props, State>(
  definition: StatefulComponentWithoutDependencies<Props, State>,
): CreatedComponent<Props, EffectReactAnalysisRequired>;
export function createComponent<State>(
  definition: StatefulComponentWithoutPropsOrDependencies<State>,
): Component<EffectReactAnalysisRequired>;
export function createComponent(
  definition: StatelessComponentWithoutDependencies,
): Component<EffectReactAnalysisRequired>;
export function createComponent(definition: unknown) {
  const hotState = makeHotComponentState(
    definition as RuntimeComponentDefinition,
  );
  const CreatedComponent = (props: object) => {
    const hotSnapshot = useSyncExternalStore(
      hotState.subscribe,
      hotState.getSnapshot,
      hotState.getSnapshot,
    );
    const componentDefinition = hotSnapshot.definition;
    const services = useServiceContext();
    const dependencies = resolveDependencies(
      componentDefinition.deps ?? [],
      services,
    );

    return componentDefinition.state ? (
      <EvaluatedState
        key={hotSnapshot.stateGeneration}
        deps={dependencies}
        props={props}
        state={componentDefinition.state}
        ui={componentDefinition.ui}
        uiGeneration={hotSnapshot.uiGeneration}
      />
    ) : (
      <EvaluatedUI key={hotSnapshot.uiGeneration} ui={componentDefinition.ui} />
    );
  };
  CreatedComponent.displayName = "Component";
  return eraseComponentType(
    makeComponent<object, never>(CreatedComponent, hotState),
  );
}

function eraseComponentType(component: unknown) {
  return component;
}

function makeComponent<Props, Requirements>(
  component: (props: Props) => RenderResult,
  hotState: HotComponentState<RuntimeComponentDefinition>,
) {
  const created = component as CreatedComponent<Props, Requirements>;
  const effectPrototype = Effectable.Prototype<
    Effect.Effect<CreatedComponent<Props, Requirements>, never, Requirements>
  >({
    label: "EffectReactComponent",
    evaluate: () => Effect.context<Requirements>().pipe(Effect.as(created)),
  });
  Object.assign(created, effectPrototype, {
    __effectReactAnalyzed: () => created,
    __effectReactHot: (id: string, signatures: HotComponentSignatures) =>
      registerHotComponent({
        component: created,
        id,
        signatures,
        state: hotState,
      }),
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
  readonly ui: (input: { readonly state: unknown }) => RenderResult;
};

function EvaluatedState({
  deps,
  props,
  state: evaluateState,
  ui,
  uiGeneration,
}: {
  deps: ResolvedRuntimeDependencies;
  props: object;
  state: NonNullable<RuntimeComponentDefinition["state"]>;
  ui: RuntimeComponentDefinition["ui"];
  uiGeneration: number;
}) {
  "use no memo";

  const state = evaluateState({ deps, props });
  return <EvaluatedUI key={uiGeneration} state={state} ui={ui} />;
}

function EvaluatedUI({
  state,
  ui,
}: {
  state?: unknown;
  ui: RuntimeComponentDefinition["ui"];
}) {
  "use no memo";

  return ui({ state });
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
