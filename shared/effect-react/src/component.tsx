import type { ComponentType, ReactNode } from "react";
import { Cause, Effect, Exit, Option } from "effect";

export type ComponentFactory<Props, Error, Requirements> = Effect.Effect<
  ComponentType<Props>,
  Error,
  Requirements
>;

export interface MountOptions<Error> {
  readonly displayName?: string;
  readonly onDefect?: (defect: unknown) => ReactNode;
  readonly onFailure: (error: Error) => ReactNode;
}

export class AsyncComponentFactoryError extends Error {
  override readonly name = "AsyncComponentFactoryError";

  constructor(options?: ErrorOptions) {
    super(
      "Component factories must complete synchronously. Move asynchronous work into an Effect service, route loader, or event handler.",
      options,
    );
  }
}

type NoRequirements<Requirements> = [Requirements] extends [never]
  ? unknown
  : {
      readonly __unresolvedEffectRequirements: Requirements;
    };

export function make<Props, Error, Requirements>(
  factory: ComponentFactory<Props, Error, Requirements>,
): ComponentFactory<Props, Error, Requirements> {
  return factory;
}

/**
 * Resolves a fully provided component factory at the React boundary.
 *
 * Requirements inferred from yielded Effect services must be provided before
 * this function can be called. Factories intentionally run synchronously so
 * React hooks remain inside the ordinary component they return.
 */
export function mount<Props, Error, Requirements>(
  factory: ComponentFactory<Props, Error, Requirements> &
    NoRequirements<Requirements>,
  options: MountOptions<Error>,
): ComponentType<Props> {
  let exit: Exit.Exit<ComponentType<Props>, Error>;

  try {
    exit = Effect.runSyncExit(factory as ComponentFactory<Props, Error, never>);
  } catch (cause) {
    throw new AsyncComponentFactoryError({ cause });
  }

  if (Exit.isSuccess(exit)) {
    const Mounted = exit.value;
    if (options.displayName !== undefined) {
      Mounted.displayName = options.displayName;
    }
    return Mounted;
  }

  const failure = Cause.failureOption(exit.cause);
  if (Option.isSome(failure)) {
    const FailedComponent = () => options.onFailure(failure.value);
    FailedComponent.displayName = options.displayName ?? "EffectFailure";
    return FailedComponent;
  }

  const defect = Cause.squash(exit.cause);
  if (defect instanceof Error && defect.name === "AsyncFiberException") {
    throw new AsyncComponentFactoryError({ cause: defect });
  }

  if (options.onDefect !== undefined) {
    const DefectComponent = () => options.onDefect?.(defect);
    DefectComponent.displayName = options.displayName ?? "EffectDefect";
    return DefectComponent;
  }

  throw defect;
}

export const Component = {
  make,
  mount,
};
