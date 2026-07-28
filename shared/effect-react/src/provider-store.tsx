import type { ComponentType, ReactNode } from "react";
import { createContext, use, useLayoutEffect, useState } from "react";
import { Context } from "effect";

import type { EffectComponent } from "./create-component";
import type { ReadableStore, SelectorOptions } from "./store";
import { ServiceContextProvider, useServiceContext } from "./service-context";
import { makeStore, useStoreSelector } from "./store";

type StoreProps<State extends object> = {
  readonly children?: ReactNode;
  readonly value: State;
};

export declare const StoreRequirementTypeId: unique symbol;

export interface StoreRequirement<Name extends string, State extends object> {
  readonly [StoreRequirementTypeId]: {
    readonly name: Name;
    readonly state: (state: State) => State;
  };
}

export type StoreSelector<State> = <Selected>(
  selector: (state: State) => Selected,
  options?: SelectorOptions<Selected>,
) => Selected;

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
    const missingProvider = () => {
      throw new Error("useStore must be used within its Store");
    };
    const missingStore = {
      getServerSnapshot: missingProvider,
      getSnapshot: missingProvider,
      subscribe: () => () => undefined,
    } satisfies ReadableStore<State>;
    const StoreContext = createContext<ReadableStore<State>>(missingStore);
    const service = Context.GenericTag<
      StoreRequirement<Name, State>,
      StoreSelector<State>
    >(`@night-shift/effect-react/store/${name}`);

    function Store({ children, value }: StoreProps<State>) {
      const [store] = useState(() => makeStore(value));
      const parentServices = useServiceContext();
      const [services] = useState(() =>
        Context.add(parentServices, service, useStore),
      );

      useLayoutEffect(() => {
        store.set(value);
      }, [store, value]);

      return (
        <ServiceContextProvider services={services}>
          <StoreContext value={store}>{children}</StoreContext>
        </ServiceContextProvider>
      );
    }

    function useStore<Selected>(
      selector: (state: State) => Selected,
      options: SelectorOptions<Selected> = {},
    ) {
      const store = use(StoreContext);
      return useStoreSelector(store, selector, options);
    }

    function provide<ComponentProps extends object, Error, Requirements>({
      component,
      implementation: useImplementation,
    }: {
      readonly component: EffectComponent<ComponentProps, Error, Requirements>;
      readonly implementation: (props: ComponentProps) => State;
    }) {
      const Component = component as ComponentType<ComponentProps>;

      function ProvidedStore(props: ComponentProps) {
        const value = useImplementation(props);
        return (
          <Store value={value}>
            <Component {...props} />
          </Store>
        );
      }

      ProvidedStore.displayName = `Provide${name}`;
      return ProvidedStore as unknown as EffectComponent<
        ComponentProps,
        Error,
        Exclude<Requirements, StoreRequirement<Name, State>>
      >;
    }

    return { provide, service, Store, useStore };
  };
}
