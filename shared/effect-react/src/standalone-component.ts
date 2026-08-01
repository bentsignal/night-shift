import type { FunctionComponent } from "react";

import type {
  Component,
  ComponentRequirements,
  ComponentWithProps,
} from "./create-component";

type EmptyProps = Record<string, never>;
type NoRequirements = ComponentRequirements<never>;

interface ToStandaloneComponent {
  (component: Component<NoRequirements>): FunctionComponent<EmptyProps>;
  <Props>(
    component: ComponentWithProps<Props, NoRequirements>,
  ): FunctionComponent<Props>;
}

/**
 * Converts a fully provided Effect React tree into a standalone component.
 *
 * Components with unresolved store requirements fail this function's input
 * type, so framework boundaries only receive dependency-free components.
 */
export const toStandaloneComponent = ((component: unknown) =>
  component) as ToStandaloneComponent;
