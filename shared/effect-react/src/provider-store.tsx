import type { ReactNode } from "react";
import { useLayoutEffect, useState } from "react";
import { Context } from "effect";

import type { ReadableStore } from "./store";
import { ServiceContextProvider, useServiceContext } from "./service-context";
import { makeStore } from "./store";

type StoreProps<State extends object> = {
  readonly children?: ReactNode;
  readonly implements: (() => State) | StoreImplementation<State>;
};

export declare const StoreRequirementTypeId: unique symbol;
export declare const StoreProviderTypeId: unique symbol;
declare const StoreImplementationTypeId: unique symbol;

export interface StoreRequirement<Name extends string, State extends object> {
  readonly [StoreRequirementTypeId]: {
    readonly name: Name;
    readonly state: (state: State) => State;
  };
}

export interface StoreProvider<Name extends string, State extends object> {
  (props: StoreProps<State>): ReactNode;
  /** @internal Used only by the in-memory Effect React transform. */
  readonly __effectReactImplementation: (
    state: State,
  ) => StoreImplementation<State>;
  readonly [StoreProviderTypeId]: StoreRequirement<Name, State>;
}

interface StoreImplementation<State extends object> {
  readonly [StoreImplementationTypeId]: State;
}

type IsUnion<Value, Original = Value> = Value extends Original
  ? [Original] extends [Value]
    ? false
    : true
  : never;

type StoreName<Name extends string> = string extends Name
  ? never
  : true extends IsUnion<Name>
    ? never
    : Name;

/**
 * Declares one injectable store contract.
 *
 * The literal name is its Effect service identity, so reusing a name means
 * reusing the same State contract.
 */
export function createStore<const Name extends string>(name: StoreName<Name>) {
  return function defineStore<State extends object>() {
    const service = Context.GenericTag<
      StoreRequirement<Name, State>,
      ReadableStore<State>
    >(`@night-shift/effect-react/store/${name}`);

    function Store({
      children,
      implements: implementation,
    }: StoreProps<State>) {
      const value =
        typeof implementation === "function"
          ? implementation()
          : (implementation as unknown as State);
      const [store] = useState(() => makeStore(value));
      const parentServices = useServiceContext();
      const [services] = useState(() =>
        Context.add(parentServices, service, store),
      );

      useLayoutEffect(() => {
        store.set(value);
      }, [store, value]);

      return (
        <ServiceContextProvider services={services}>
          {children}
        </ServiceContextProvider>
      );
    }

    Object.assign(Store, {
      __effectReactImplementation: (state: State) => state,
      displayName: `${name}Store`,
    });

    return {
      service,
      Store: Store as unknown as StoreProvider<Name, State>,
    };
  };
}
