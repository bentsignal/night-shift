import { useCallback, useMemo, useSyncExternalStore } from "react";

type Listener = () => void;

export interface Store<State> {
  readonly getServerSnapshot: () => State;
  readonly getSnapshot: () => State;
  readonly set: (next: State) => void;
  readonly subscribe: (listener: Listener) => () => void;
  readonly update: (update: (current: State) => State) => void;
}

export interface StoreOptions<State> {
  readonly getServerSnapshot?: () => State;
}

export interface SelectorOptions<Selected> {
  readonly isEqual?: (previous: Selected, next: Selected) => boolean;
}

/**
 * Creates an immutable-snapshot external store suitable for Effect services.
 */
export function makeStore<State>(
  initialState: State,
  options: StoreOptions<State> = {},
): Store<State> {
  let state = initialState;
  const listeners = new Set<Listener>();

  const getSnapshot = () => state;

  const set = (next: State) => {
    if (Object.is(state, next)) {
      return;
    }

    state = next;
    listeners.forEach((listener) => {
      listener();
    });
  };

  return {
    getServerSnapshot: options.getServerSnapshot ?? getSnapshot,
    getSnapshot,
    set,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update,
  };

  function update(updateState: (current: State) => State) {
    set(updateState(state));
  }
}

interface SelectionCache<Selected> {
  readonly getServerSnapshot: () => Selected;
  readonly getSnapshot: () => Selected;
}

function makeSelectionCache<State, Selected>(
  store: Store<State>,
  selector: (state: State) => Selected,
  isEqual: (previous: Selected, next: Selected) => boolean,
): SelectionCache<Selected> {
  let hasSelection = false;
  let previousSnapshot: State;
  let previousSelection: Selected;

  const select = (snapshot: State) => {
    if (hasSelection && Object.is(previousSnapshot, snapshot)) {
      return previousSelection;
    }

    const nextSelection = selector(snapshot);
    if (hasSelection && isEqual(previousSelection, nextSelection)) {
      previousSnapshot = snapshot;
      return previousSelection;
    }

    hasSelection = true;
    previousSnapshot = snapshot;
    previousSelection = nextSelection;
    return nextSelection;
  };

  return {
    getServerSnapshot: () => select(store.getServerSnapshot()),
    getSnapshot: () => select(store.getSnapshot()),
  };
}

/**
 * Selects one store slice using React's concurrent-safe external-store bridge.
 * Equal selections retain their identity and do not rerender the consumer.
 */
export function useStoreSelector<State, Selected>(
  store: Store<State>,
  selector: (state: State) => Selected,
  options: SelectorOptions<Selected> = {},
): Selected {
  const isEqual = options.isEqual ?? Object.is;
  const selection = useMemo(
    () => makeSelectionCache(store, selector, isEqual),
    [isEqual, selector, store],
  );
  const subscribe = useCallback(
    (listener: Listener) => store.subscribe(listener),
    [store],
  );

  return useSyncExternalStore(
    subscribe,
    selection.getSnapshot,
    selection.getServerSnapshot,
  );
}
