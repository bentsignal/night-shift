export type HotComponentSignatures = {
  readonly state: string;
  readonly ui: string;
};

export type HotComponentSnapshot<Definition> = {
  readonly definition: Definition;
  readonly revision: number;
  readonly signatures: HotComponentSignatures;
  readonly stateGeneration: number;
  readonly uiGeneration: number;
};

export type HotComponentState<Definition> = {
  readonly getSnapshot: () => HotComponentSnapshot<Definition>;
  readonly initialize: (signatures: HotComponentSignatures) => void;
  readonly publish: (
    definition: Definition,
    signatures: HotComponentSignatures,
  ) => void;
  readonly subscribe: (listener: () => void) => () => void;
};

type HotComponentRecord = {
  readonly component: unknown;
  readonly publish: (
    definition: unknown,
    signatures: HotComponentSignatures,
  ) => void;
};

type HotRegistry = {
  readonly components: Map<string, HotComponentRecord>;
  readonly stores: Map<string, unknown>;
};

const hotRegistryKey = Symbol.for("@night-shift/effect-react/hot-registry");
const globalScope = globalThis as unknown as { [key: symbol]: unknown };
const hotRegistry = (globalScope[hotRegistryKey] ??= {
  components: new Map(),
  stores: new Map(),
}) as HotRegistry;

export function makeHotComponentState<Definition>(definition: Definition) {
  let snapshot = {
    definition,
    revision: 0,
    signatures: { state: "unregistered", ui: "unregistered" },
    stateGeneration: 0,
    uiGeneration: 0,
  } satisfies HotComponentSnapshot<Definition>;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => snapshot,
    initialize: (signatures) => {
      snapshot = { ...snapshot, signatures };
    },
    publish: (nextDefinition, signatures) => {
      snapshot = {
        definition: nextDefinition,
        revision: snapshot.revision + 1,
        signatures,
        stateGeneration:
          signatures.state === snapshot.signatures.state
            ? snapshot.stateGeneration
            : snapshot.stateGeneration + 1,
        uiGeneration:
          signatures.ui === snapshot.signatures.ui
            ? snapshot.uiGeneration
            : snapshot.uiGeneration + 1,
      };
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies HotComponentState<Definition>;
}

export function registerHotComponent<Component, Definition>({
  component,
  id,
  signatures,
  state,
}: {
  readonly component: Component;
  readonly id: string;
  readonly signatures: HotComponentSignatures;
  readonly state: HotComponentState<Definition>;
}) {
  const existing = hotRegistry.components.get(id);
  if (existing) {
    existing.publish(state.getSnapshot().definition, signatures);
    return existing.component as Component;
  }

  state.initialize(signatures);
  hotRegistry.components.set(id, {
    component,
    publish: (definition, nextSignatures) => {
      state.publish(definition as Definition, nextSignatures);
    },
  });
  return component;
}

export function registerHotStore<Store>(id: string, store: Store) {
  const existing = hotRegistry.stores.get(id);
  if (existing) return existing as Store;
  hotRegistry.stores.set(id, store);
  return store;
}
