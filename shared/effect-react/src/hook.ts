import { Effect } from "effect";

export type Hook<Arguments extends ReadonlyArray<unknown>, Value> = (
  ...arguments_: Arguments
) => Value;

export type HookFactory<
  Arguments extends ReadonlyArray<unknown>,
  Value,
  Error,
  Requirements,
> = Effect.Effect<Hook<Arguments, Value>, Error, Requirements>;

/**
 * Declares an Effect-built hook factory. The Effect resolves dependencies and
 * returns an ordinary React hook; it must not execute React hooks itself.
 */
export function make<
  Arguments extends ReadonlyArray<unknown>,
  Value,
  Error,
  Requirements,
>(
  factory: HookFactory<Arguments, Value, Error, Requirements>,
): HookFactory<Arguments, Value, Error, Requirements> {
  return factory;
}

export const Hook = {
  make,
};
