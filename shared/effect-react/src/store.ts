import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

type Listener = () => void;

export interface ReadableStore<State> {
  readonly getServerSnapshot: () => State;
  readonly getSnapshot: () => State;
  readonly subscribe: (listener: Listener) => () => void;
}

export interface Store<State> extends ReadableStore<State> {
  readonly set: (next: State) => void;
  readonly update: (update: (current: State) => State) => void;
}

export interface StoreOptions<State> {
  readonly getServerSnapshot?: () => State;
}

export interface SelectorOptions<Selected> {
  readonly isEqual?: (previous: Selected, next: Selected) => boolean;
}

/**
 * Creates an immutable-snapshot external store suitable for Effect injection.
 */
export function makeStore<State>(
  initialState: State,
  options: StoreOptions<State> = {},
) {
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
    subscribe(listener: Listener) {
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

/**
 * Selects one store slice using React's maintained external-store selector.
 * Equal selections retain their identity and do not rerender the consumer.
 */
export function useStore<State, Selected>(
  store: ReadableStore<State>,
  selector: (state: State) => Selected,
  options: SelectorOptions<Selected> = {},
) {
  return useSyncExternalStoreWithSelector(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
    selector,
    options.isEqual,
  );
}
