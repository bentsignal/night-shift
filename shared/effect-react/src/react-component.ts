import type { FunctionComponent } from "react";

import type {
  Component,
  ComponentRequirements,
  ComponentWithProps,
} from "./create-component";

type EmptyProps = Record<string, never>;
type NoRequirements = ComponentRequirements<never>;

interface ToReactComponent {
  (component: Component<NoRequirements>): FunctionComponent<EmptyProps>;
  <Props>(
    component: ComponentWithProps<Props, NoRequirements>,
  ): FunctionComponent<Props>;
}

/**
 * Closes an Effect React component tree at a framework boundary.
 *
 * Components with unresolved store requirements fail this function's input
 * type, so routes receive an ordinary React component only after every
 * requirement has been provided.
 */
export const toReactComponent = ((component: unknown) =>
  component) as ToReactComponent;
