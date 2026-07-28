import type { ReactNode } from "react";
import { createContext, use, useLayoutEffect, useState } from "react";
import { Context } from "effect";

import type { ReadableStore, SelectorOptions } from "./store";
import { ServiceContextProvider, useServiceContext } from "./service-context";
import { makeStore, useStoreSelector } from "./store";

type StoreProps<Props extends object> = Props & {
  readonly children?: ReactNode;
};

export declare const StoreRequirementTypeId: unique symbol;

export interface StoreRequirement<Name extends string> {
  readonly [StoreRequirementTypeId]: Name;
}

export interface StoreDefinition<
  Name extends string,
  Props extends object,
  State extends object,
> {
  readonly name: Name;
  readonly state: (props: Props) => State;
}

export type StoreSelector<State> = <Selected>(
  selector: (state: State) => Selected,
  options?: SelectorOptions<Selected>,
) => Selected;

const storeNames = new Set<string>();

export function createStore<
  const Name extends string,
  Props extends object,
  State extends object,
>(definition: StoreDefinition<Name, Props, State>) {
  if (storeNames.has(definition.name)) {
    throw new Error(
      `Effect React store names must be unique. "${definition.name}" is already registered.`,
    );
  }
  storeNames.add(definition.name);

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
    StoreRequirement<Name>,
    StoreSelector<State>
  >(`@night-shift/effect-react/store/${definition.name}`);

  function Store(props: StoreProps<Props>) {
    const { children, ...storeProps } = props;
    const state = definition.state(storeProps as Props);
    const [store] = useState(() => makeStore(state));
    const parentServices = useServiceContext();
    const [services] = useState(() =>
      Context.add(parentServices, service, useStore),
    );

    useLayoutEffect(() => {
      store.set(state);
    }, [state, store]);

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

  return { service, Store, useStore };
}
