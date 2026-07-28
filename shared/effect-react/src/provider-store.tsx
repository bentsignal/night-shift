import type { ReactNode } from "react";
import { createContext, use, useLayoutEffect, useState } from "react";

import type { ReadableStore, SelectorOptions } from "./store";
import { makeStore, useStoreSelector } from "./store";

type StoreProps<Props extends object> = Props & {
  readonly children?: ReactNode;
};

/**
 * Creates a provider-scoped selector store from one ordinary state hook.
 *
 * This preserves Rostra's Store/useStore API while using React's external-store
 * contract for concurrent rendering.
 */
export function createStore<Props extends object, State extends object>(
  useInternalStore: (props: Props) => State,
) {
  const missingProvider = () => {
    throw new Error("useStore must be used within its Store");
  };
  const missingStore = {
    getServerSnapshot: missingProvider,
    getSnapshot: missingProvider,
    subscribe: () => () => undefined,
  } satisfies ReadableStore<State>;
  const StoreContext = createContext<ReadableStore<State>>(missingStore);

  function Store(props: StoreProps<Props>) {
    const { children, ...storeProps } = props;
    const state = useInternalStore(storeProps as Props);
    const [store] = useState(() => makeStore(state));

    useLayoutEffect(() => {
      store.set(state);
    }, [state, store]);

    return <StoreContext value={store}>{children}</StoreContext>;
  }

  function useStore<Selected>(
    selector: (state: State) => Selected,
    options: SelectorOptions<Selected> = {},
  ) {
    const store = use(StoreContext);
    return useStoreSelector(store, selector, options);
  }

  return { Store, useStore };
}
