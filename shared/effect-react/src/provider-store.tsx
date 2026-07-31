import type { ReactNode } from "react";
// eslint-disable-next-line no-restricted-imports -- React Refresh can replace a generated store's dependency closure while preserving its hook state, so this identity-sensitive context requires an explicit memo boundary.
import { useLayoutEffect, useMemo, useState } from "react";
import { Context } from "effect";

import type { ReadableStore } from "./store";
import { ServiceContextProvider, useServiceContext } from "./service-context";
import { makeStore } from "./store";

type StoreProps<State extends object> = {
  readonly children?: ReactNode;
  readonly implements: (() => State) | StoreImplementation<State>;
};

export declare const StoreRequirementTypeId: unique symbol;
export declare const StoreTypeId: unique symbol;
declare const StoreImplementationTypeId: unique symbol;

export interface StoreRequirement<Name extends string, State extends object> {
  readonly [StoreRequirementTypeId]: {
    readonly name: Name;
    readonly state: (state: State) => State;
  };
}

export interface StoreDependency<
  Key extends string,
  Name extends string,
  State extends object,
> extends Context.Tag<StoreRequirement<Name, State>, ReadableStore<State>> {
  /** @internal The property used for this dependency in resolved component deps. */
  readonly __effectReactDependencyKey: Key;
  readonly [StoreTypeId]: {
    readonly key: Key;
    readonly name: Name;
    readonly requirement: StoreRequirement<Name, State>;
    readonly state: State;
  };
}

export interface Store<
  Name extends string,
  State extends object,
> extends StoreDependency<Uncapitalize<Name>, Name, State> {
  (props: StoreProps<State>): ReactNode;
  /** @internal Used only by the in-memory Effect React transform. */
  readonly __effectReactDependency: <const Key extends string>(
    key: Key,
  ) => StoreDependency<Key, Name, State>;
  /** @internal Used only by the in-memory Effect React transform. */
  readonly __effectReactImplementation: (
    state: State,
  ) => StoreImplementation<State>;
  /** @internal Used only by the in-memory Effect React transform. */
  readonly __effectReactHot: (id: string) => Store<Name, State>;
  /** @internal Used only by the in-memory Effect React transform. */
  readonly __effectReactNamed: <const InferredName extends string>(
    name: InferredName,
  ) => Store<InferredName, State>;
}

interface StoreImplementation<State extends object> {
  readonly [StoreImplementationTypeId]: State;
}

let nextStoreIdentity = 0;
const hotStores = new Map<string, Store<string, object>>();

/**
 * Declares one injectable store contract.
 */
export function createStore<State extends object>() {
  const identity = nextStoreIdentity++;
  const dependency = Context.GenericTag<
    StoreRequirement<string, State>,
    ReadableStore<State>
  >(`@night-shift/effect-react/store/${identity}`);

  function Store({ children, implements: implementation }: StoreProps<State>) {
    const value =
      typeof implementation === "function"
        ? implementation()
        : (implementation as unknown as State);
    const [storeHandle] = useState(() => makeStore(value));
    const parentServices = useServiceContext();
    const services = useMemo(
      () => Context.add(parentServices, dependency, storeHandle),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- React Refresh replaces this outer dependency identity without remounting the provider; retaining it is the HMR correctness condition.
      [dependency, parentServices, storeHandle],
    );

    useLayoutEffect(() => {
      storeHandle.set(value);
    }, [storeHandle, value]);

    return (
      <ServiceContextProvider services={services}>
        {children}
      </ServiceContextProvider>
    );
  }

  Object.setPrototypeOf(Store, Object.getPrototypeOf(dependency));
  Object.assign(Store, dependency, {
    __effectReactDependency: (key: string) =>
      Object.assign(Object.create(dependency) as object, {
        __effectReactDependencyKey: key,
      }),
    __effectReactDependencyKey: "store",
    __effectReactImplementation: (state: State) => state,
    __effectReactHot: (id: string) => {
      const existing = hotStores.get(id);
      if (existing) return existing as unknown as Store<string, State>;
      hotStores.set(id, Store as unknown as Store<string, object>);
      return Store;
    },
    __effectReactNamed: (name: string) => {
      Object.assign(Store, {
        __effectReactDependencyKey: `${name.slice(0, 1).toLowerCase()}${name.slice(1)}`,
        displayName: `${name}Store`,
      });
      return Store;
    },
    displayName: "Store",
  });

  return Store as unknown as Store<string, State>;
}
