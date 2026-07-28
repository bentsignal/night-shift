import type { ReactNode } from "react";
import { createContext, use } from "react";
import { Context, Effect } from "effect";

export const ServiceContext = createContext<Context.Context<never>>(
  Context.empty(),
);

export function useServiceContext() {
  return use(ServiceContext);
}

export function provideServiceContext<Success, Error, Requirements>(
  effect: Effect.Effect<Success, Error, Requirements>,
  services: Context.Context<never>,
) {
  return Effect.provide(effect, services as Context.Context<Requirements>);
}

export function ServiceContextProvider({
  children,
  services,
}: {
  children?: ReactNode;
  services: Context.Context<never>;
}) {
  return <ServiceContext value={services}>{children}</ServiceContext>;
}
