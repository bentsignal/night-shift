import { Data } from "effect";

import type {
  RuntimeAdapter,
  RuntimeInput,
  RuntimeMilestone,
  RuntimeResult,
  RuntimeSelection,
} from "./types.ts";

export class UnsupportedRuntimeAdapterError extends Data.TaggedError(
  "UnsupportedRuntimeAdapterError",
)<{
  readonly adapter: string;
}> {
  override get message(): string {
    return `This host does not support the ${this.adapter} runtime adapter`;
  }
}

export class RuntimeRouter implements RuntimeAdapter {
  readonly #adapters: ReadonlyMap<string, RuntimeAdapter>;

  constructor(adapters: Iterable<readonly [string, RuntimeAdapter]>) {
    this.#adapters = new Map(adapters);
  }

  execute(
    input: RuntimeInput,
    selection: RuntimeSelection,
    signal: AbortSignal,
    emit: (milestone: RuntimeMilestone) => Promise<void>,
  ): Promise<RuntimeResult> {
    const runtime = this.#adapters.get(selection.adapter);
    if (!runtime) {
      return Promise.reject(
        new UnsupportedRuntimeAdapterError({ adapter: selection.adapter }),
      );
    }
    return runtime.execute(input, selection, signal, emit);
  }
}
